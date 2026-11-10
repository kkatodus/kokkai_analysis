#!/usr/bin/env python
# coding: utf-8
"""Select POLIS anchor politicians and verify ideological coverage.

See specs/polis-low-resource-persona/README.md §2.1. Anchors are the data-rich
adapters we train and later merge; the merge can only express ideologies *inside
the anchors' span*, so we pick the most speech-rich politician per party/bloc
(LDP→JCP) and then quantitatively verify coverage before committing to training.

Ideology source: s3_mirror/kokkai-doc/ideology/ideology.json.gz — per subtopic a 1D
scaling ("axis") giving each politician an `x` position, keyed by `person_id`.
Each axis has its own arbitrary orientation, so we never average x across axes.
Coverage is measured PER AXIS: the anchors define [min_x, max_x] and a target is
"covered" on that axis iff its x lands inside. We report mean coverage over axes,
the worst axis, and which politicians fall outside the anchor span. (UTAS-based
coverage can be added once name-matching lands; ideology.json needs no matching
because it is already person_id-keyed.)

Speech-richness: line count of repr_speeches_id_organized/{person_id}/all_speeches.jsonl.

Output: data/data/polis/anchors.json — the chosen anchor list for the exporter,
plus printed ready-to-run export commands.

Example:
    python select_polis_anchors.py                        # top-1 per major party (~7 anchors)
    python select_polis_anchors.py --max-anchors 4        # dev-scale, span-preserving trim
    python select_polis_anchors.py --parties 自民,立憲,共産,れ新
"""

import argparse
import gzip
import json
import os
from collections import defaultdict

from paths import DATA_DIR, S3_MIRROR_DIR

IDEOLOGY_PATH = os.path.join(S3_MIRROR_DIR, "kokkai-doc", "ideology", "ideology.json.gz")
ORGANIZED_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
DEFAULT_OUTPUT = os.path.join(DATA_DIR, "polis", "anchors.json")


def load_ideology():
	"""Return (person_meta, axis_positions).

	person_meta[pid]   = {"repr", "hiragana", "house", "party"}  (modal party)
	axis_positions[axis_key][pid] = x   for every axis the politician appears on
	"""
	with gzip.open(IDEOLOGY_PATH, "rt", encoding="utf-8") as f:
		data = json.load(f)["data"]

	party_votes = defaultdict(lambda: defaultdict(int))
	person_meta = {}
	axis_positions = defaultdict(dict)
	for topic in data:
		for st in topic.get("sub_topics", []):
			axis_key = f"{st['topic']}/{st['sub_topic']}"
			for e in st.get("1d", {}).get("data", []):
				pid = e["person_id"]
				axis_positions[axis_key][pid] = e["x"]
				party_votes[pid][e.get("party", "")] += 1
				person_meta.setdefault(pid, {
					"repr": e.get("repr"),
					"hiragana": e.get("hiragana"),
					"house": e.get("house"),
				})
	for pid, votes in party_votes.items():
		person_meta[pid]["party"] = max(votes.items(), key=lambda kv: kv[1])[0]
	return person_meta, axis_positions


def count_speeches(pid):
	path = os.path.join(ORGANIZED_DIR, str(pid), "all_speeches.jsonl")
	if not os.path.isfile(path):
		return 0
	with open(path, "r", encoding="utf-8") as f:
		return sum(1 for _ in f)


def axis_coverage(anchor_ids, population_ids, axis_positions):
	"""Per-axis fraction of the population inside the anchor [min,max] span.

	Only axes where >=2 anchors have a position count (span is otherwise undefined).
	Returns (per_axis: {axis: (coverage, n_targets)}, outside_counts: {pid: n_axes_outside}).
	"""
	anchor_set = set(anchor_ids)
	pop = set(population_ids) - anchor_set
	per_axis = {}
	outside = defaultdict(int)
	for axis, pos in axis_positions.items():
		anchor_xs = [pos[a] for a in anchor_ids if a in pos]
		if len(anchor_xs) < 2:
			continue
		lo, hi = min(anchor_xs), max(anchor_xs)
		targets = [pid for pid in pop if pid in pos]
		if not targets:
			continue
		inside = 0
		for pid in targets:
			if lo <= pos[pid] <= hi:
				inside += 1
			else:
				outside[pid] += 1
		per_axis[axis] = (inside / len(targets), len(targets))
	return per_axis, outside


def mean_coverage(per_axis):
	if not per_axis:
		return 0.0
	return sum(cov for cov, _ in per_axis.values()) / len(per_axis)


def select_top_per_party(candidates, per_party, parties, min_party_size):
	"""candidates: list of dicts with person_id, party, speech_count (desc-sortable).

	Groups by party, keeps parties passing the filter, returns top `per_party` per party.
	"""
	by_party = defaultdict(list)
	for c in candidates:
		by_party[c["party"]].append(c)

	chosen = []
	for party, members in by_party.items():
		if parties is not None and party not in parties:
			continue
		if parties is None and len(members) < min_party_size:
			continue
		members.sort(key=lambda c: -c["speech_count"])
		chosen.extend(members[:per_party])
	return chosen


def greedy_trim(chosen, population_ids, axis_positions, max_anchors):
	"""Drop anchors one at a time, each time removing the one whose removal least
	reduces mean per-axis coverage — i.e. keep the span-defining extremes."""
	kept = list(chosen)
	while len(kept) > max_anchors:
		best = None  # (retained_mean_coverage, index_to_drop)
		for i in range(len(kept)):
			trial = kept[:i] + kept[i + 1:]
			per_axis, _ = axis_coverage([c["person_id"] for c in trial], population_ids, axis_positions)
			cov = mean_coverage(per_axis)
			if best is None or cov > best[0]:
				best = (cov, i)
		kept.pop(best[1])
	return kept


def main():
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--per-party", type=int, default=1, help="Most speech-rich N politicians per party")
	parser.add_argument("--parties", default=None, help="Comma-separated party labels to restrict to (e.g. 自民,立憲,共産,れ新); default = all parties with >= --min-party-size")
	parser.add_argument("--min-party-size", type=int, default=5, help="Ignore parties with fewer positioned politicians (skips fringe parties) when --parties is unset")
	parser.add_argument("--min-speeches", type=int, default=500, help="An anchor must have at least this many speeches (data-rich requirement)")
	parser.add_argument("--max-anchors", type=int, default=None, help="Cap total anchors via span-preserving greedy trim (dev scale ~4)")
	parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Where to write the chosen anchor list")
	args = parser.parse_args()

	parties = set(args.parties.split(",")) if args.parties else None

	print("Loading ideology positions…")
	person_meta, axis_positions = load_ideology()
	population_ids = list(person_meta.keys())
	print(f"  {len(population_ids)} positioned politicians across {len(axis_positions)} axes")

	print("Counting speeches for positioned politicians…")
	candidates = []
	for pid, meta in person_meta.items():
		n = count_speeches(pid)
		if n >= args.min_speeches:
			candidates.append({
				"person_id": pid,
				"repr": meta.get("repr"),
				"party": meta.get("party"),
				"house": meta.get("house"),
				"speech_count": n,
			})
	print(f"  {len(candidates)} politicians with >= {args.min_speeches} speeches")

	chosen = select_top_per_party(candidates, args.per_party, parties, args.min_party_size)
	chosen.sort(key=lambda c: -c["speech_count"])
	if args.max_anchors is not None and len(chosen) > args.max_anchors:
		chosen = greedy_trim(chosen, population_ids, axis_positions, args.max_anchors)
		chosen.sort(key=lambda c: -c["speech_count"])

	anchor_ids = [c["person_id"] for c in chosen]
	per_axis, outside = axis_coverage(anchor_ids, population_ids, axis_positions)

	print(f"\n=== Selected {len(chosen)} anchors ===")
	print(f"{'person_id':>9}  {'party':<6} {'house':<6} {'speeches':>8}  repr")
	for c in chosen:
		print(f"{c['person_id']:>9}  {c['party']:<6} {str(c['house']):<6} {c['speech_count']:>8}  {c['repr']}")

	print(f"\n=== Coverage (per-axis span, {len(per_axis)} axes with >=2 anchors) ===")
	mean_cov = mean_coverage(per_axis)
	print(f"mean coverage across axes: {mean_cov:.1%}")
	if per_axis:
		worst = sorted(per_axis.items(), key=lambda kv: kv[1][0])[:5]
		print("worst-covered axes:")
		for axis, (cov, n) in worst:
			print(f"  {axis:<45} {cov:.1%}  (n={n})")
	# Politicians outside the span on many axes = the ideologies the merge cannot reach.
	if outside:
		hard = sorted(outside.items(), key=lambda kv: -kv[1])[:8]
		n_axes = len(per_axis)
		print(f"\npoliticians most often outside the anchor span (of {n_axes} axes):")
		for pid, cnt in hard:
			m = person_meta.get(pid, {})
			print(f"  {m.get('repr','?')} ({m.get('party','?')}, id={pid}): outside on {cnt}/{n_axes} axes")

	os.makedirs(os.path.dirname(args.output), exist_ok=True)
	with open(args.output, "w", encoding="utf-8") as f:
		json.dump({
			"anchors": chosen,
			"coverage": {"mean_axis_coverage": mean_cov, "n_axes": len(per_axis)},
			"params": vars(args),
		}, f, ensure_ascii=False, indent=2)
	print(f"\nWrote anchor list -> {args.output}")
	print("\nNext: export DPO pairs per anchor, e.g.")
	for c in chosen[:3]:
		print(f"  python export_polis_dpo_pairs.py --person-id {c['person_id']} --max-pairs 1500")
	if len(chosen) > 3:
		print("  … (one per anchor above)")


if __name__ == "__main__":
	main()
