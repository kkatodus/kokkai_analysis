#!/usr/bin/env python
# coding: utf-8
"""Export session-grounded DPO preference pairs for the POLIS spec.

See specs/polis-low-resource-persona/README.md §2.2. For each real utterance by
an anchor politician in a Diet sitting we emit one training instance:

    prompt   = (optional persona instruction) + the last K speeches preceding the
               utterance in the same sitting + a cue for the anchor to speak,
               truncated to a char budget but always keeping the immediately
               preceding speech intact.
    chosen   = the anchor's actual next utterance.
    rejected = LEFT UNSET HERE. It is an LLM role-playing the anchor on the *same*
               prompt, filled by generate_polis_rejected.py (Gemini). This script
               owns only the deterministic prompt/chosen extraction.

The trainer (train_one_politician_persona.py) feeds this JSONL
straight into TRL's DPOTrainer, which reads string columns `prompt`/`chosen`/
`rejected` (`accepted` is auto-renamed to `chosen`). Its DPOConfig caps
prompt+completion at max_length=1024 tokens, so keep the char budget conservative
at 0.5B dev scale; the char budget is a token proxy (Japanese ≈ 1 token/char).

Input : data/data/repr_speeches_id_organized/{person_id}/all_speeches.jsonl
        data/data/data_all_speeches/{issueID}/speeches.jsonl   (full sitting context)
Output: data/data/polis/dpo_pairs/{person_id}.jsonl

Example:
    python export_polis_dpo_pairs.py --person-id 1088 --k 4
    python export_polis_dpo_pairs.py --person-id 1088 --session-min 200 --session-max 213
    python export_polis_dpo_pairs.py --person-id 1088 --max-pairs 1000   # cap for data-rich anchors
"""

import argparse
import json
import os
import random
import re
from collections import defaultdict
from typing import Iterator, List, Optional

from paths import DATA_DIR

ORGANIZED_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
ALL_SPEECHES_DIR = os.path.join(DATA_DIR, "data_all_speeches")
DEFAULT_OUTPUT_DIR = os.path.join(DATA_DIR, "polis", "dpo_pairs")

# Leading transcription marker on every speech body, e.g. "○坂井（隆）分科員　…"
# or "○綿貫主査　…": a "○", the speaker/role token(s), then a full-width space.
SPEAKER_MARKER_RE = re.compile(r"^○[^　]*　")

# The synthetic order-0 record in each sitting is the transcript header, not a speech.
HEADER_SPEAKER = "会議録情報"


def strip_speaker_marker(text: str) -> str:
	"""Drop the leading "○name役職　" marker so the body is the utterance itself."""
	return SPEAKER_MARKER_RE.sub("", text or "", count=1).strip()


def parse_speech_order(speech: dict) -> Optional[int]:
	raw = speech.get("speechOrder")
	try:
		return int(raw)
	except (TypeError, ValueError):
		return None


def read_jsonl(path: str) -> Iterator[dict]:
	with open(path, "r", encoding="utf-8") as f:
		for line in f:
			line = line.strip()
			if line:
				yield json.loads(line)


def load_sitting(issue_id: str) -> Optional[dict]:
	"""Return {speechOrder: speech_record} for a sitting, or None if the file is missing."""
	path = os.path.join(ALL_SPEECHES_DIR, issue_id, "speeches.jsonl")
	if not os.path.isfile(path):
		return None
	by_order = {}
	for sp in read_jsonl(path):
		order = parse_speech_order(sp)
		if order is not None:
			by_order[order] = sp
	return by_order


def format_context_speech(speech: dict) -> str:
	speaker = speech.get("speaker", "").strip()
	group = (speech.get("speakerGroup") or "").strip()
	body = strip_speaker_marker(speech.get("speech", ""))
	label = f"{speaker}（{group}）" if group and group != "None" else speaker
	return f"{label}：{body}"


def build_prompt(
	target: dict,
	sitting: dict,
	k: int,
	max_context_chars: int,
	persona_instruction: bool,
) -> Optional[str]:
	"""Assemble the shared prompt: persona header + up to K preceding speeches + cue.

	Preceding speeches are gathered newest-first so the immediately preceding one
	(usually the question being answered) is always kept whole; older ones are
	dropped once the char budget is spent. Returns None if there is no context.
	"""
	target_order = parse_speech_order(target)
	if target_order is None:
		return None

	# Candidate context orders: the K immediately preceding real speeches
	# (order > 0 skips the transcript header), newest first.
	context = []
	used = 0
	for order in range(target_order - 1, 0, -1):
		if len(context) >= k:
			break
		prev = sitting.get(order)
		if prev is None or prev.get("speaker") == HEADER_SPEAKER:
			continue
		formatted = format_context_speech(prev)
		if not formatted.strip():
			continue
		if not context:
			# Always keep the immediately preceding speech (usually the question
			# being answered), but if it alone blows the budget, head-truncate it
			# so we keep the tail nearest the answer rather than letting the
			# trainer hard-cut an uncontrolled end at max_length.
			if len(formatted) > max_context_chars:
				formatted = "…" + formatted[-max_context_chars:]
		elif used + len(formatted) > max_context_chars:
			# Older context: drop once the budget would be exceeded.
			break
		context.append(formatted)
		used += len(formatted)

	if not context:
		return None
	context.reverse()  # chronological

	speaker = target.get("speaker", "").strip()
	group = (target.get("speakerGroup") or "").strip()
	label = f"{speaker}（{group}）" if group and group != "None" else speaker

	parts = []
	if persona_instruction:
		parts.append(
			f"あなたは日本の国会議員「{label}」です。"
			"国会審議の以下のやり取りに続けて、あなた自身の発言をしてください。"
		)
	parts.append("\n\n".join(context))
	parts.append(f"{label}：")
	return "\n\n".join(parts)


def iter_pairs(
	person_id: str,
	k: int,
	max_context_chars: int,
	min_chosen_chars: int,
	persona_instruction: bool,
	session_min: Optional[int],
	session_max: Optional[int],
) -> Iterator[dict]:
	organized_path = os.path.join(ORGANIZED_DIR, person_id, "all_speeches.jsonl")
	if not os.path.isfile(organized_path):
		raise FileNotFoundError(f"No archive for person {person_id}: {organized_path}")

	# Group the anchor's utterances by sitting so each sitting file is read once.
	by_issue = defaultdict(list)
	for sp in read_jsonl(organized_path):
		meta = sp.get("meta") or {}
		session = meta.get("session")
		if session_min is not None and (session is None or session < session_min):
			continue
		if session_max is not None and (session is None or session > session_max):
			continue
		issue_id = meta.get("issueID")
		if issue_id:
			by_issue[issue_id].append(sp)

	for issue_id, targets in by_issue.items():
		sitting = load_sitting(issue_id)
		if sitting is None:
			continue
		for target in targets:
			chosen = strip_speaker_marker(target.get("speech", ""))
			if len(chosen) < min_chosen_chars:
				continue
			prompt = build_prompt(
				target, sitting, k, max_context_chars, persona_instruction
			)
			if prompt is None:
				continue
			meta = target.get("meta") or {}
			yield {
				"prompt": prompt,
				"chosen": chosen,
				# rejected filled by the separate role-play generation step.
				"person_id": person_id,
				"speaker": target.get("speaker"),
				"speakerGroup": target.get("speakerGroup"),
				"speechID": target.get("speechID"),
				"issueID": issue_id,
				"session": meta.get("session"),
				"date": meta.get("date"),
			}


def chronological_key(pair: dict):
	"""(date, issueID, speechOrder) so 'recent'/'first' modes sort deterministically."""
	speech_id = pair.get("speechID") or ""
	try:
		order = int(speech_id.rsplit("_", 1)[1])
	except (IndexError, ValueError):
		order = 0
	return (pair.get("date") or "", pair.get("issueID") or "", order)


def cap_pairs(pairs: List[dict], max_pairs: int, sample: str, seed: int) -> List[dict]:
	"""Reduce to at most max_pairs. 'random' keeps topic/time diversity (reproducible
	via seed); 'recent'/'first' keep the newest/oldest by chronological order."""
	if len(pairs) <= max_pairs:
		return pairs
	if sample == "random":
		return random.Random(seed).sample(pairs, max_pairs)
	ordered = sorted(pairs, key=chronological_key)
	return ordered[-max_pairs:] if sample == "recent" else ordered[:max_pairs]


def main():
	parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("--person-id", required=True, help="Anchor politician's person_id (dir under repr_speeches_id_organized/)")
	parser.add_argument("--k", type=int, default=4, help="Preceding speeches to include as context (spec K≈3-5)")
	parser.add_argument("--max-context-chars", type=int, default=1200, help="Char budget for context (token proxy; trainer caps prompt+completion at 1024 tokens)")
	parser.add_argument("--min-chosen-chars", type=int, default=30, help="Skip utterances shorter than this (procedural noise)")
	parser.add_argument("--no-persona-instruction", dest="persona_instruction", action="store_false", help="Omit the 'あなたは〇〇議員です' persona header from the prompt")
	parser.add_argument("--session-min", type=int, default=None, help="Only include sittings with Diet session number >= this (temporal alignment, spec §4.4)")
	parser.add_argument("--session-max", type=int, default=None, help="Only include sittings with Diet session number <= this")
	parser.add_argument("--max-pairs", type=int, default=None, help="Cap pairs per anchor (data-rich anchors yield ~20k; bounds downstream Gemini cost)")
	parser.add_argument("--sample", choices=["random", "recent", "first"], default="random", help="How to pick when over --max-pairs (default random, reproducible via --seed)")
	parser.add_argument("--seed", type=int, default=0, help="Seed for --sample random")
	parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Output directory for {person_id}.jsonl")
	args = parser.parse_args()

	os.makedirs(args.output_dir, exist_ok=True)
	out_path = os.path.join(args.output_dir, f"{args.person_id}.jsonl")

	pairs = list(iter_pairs(
		args.person_id,
		args.k,
		args.max_context_chars,
		args.min_chosen_chars,
		args.persona_instruction,
		args.session_min,
		args.session_max,
	))
	total = len(pairs)
	if args.max_pairs is not None:
		pairs = cap_pairs(pairs, args.max_pairs, args.sample, args.seed)

	with open(out_path, "w", encoding="utf-8") as out:
		for pair in pairs:
			out.write(json.dumps(pair, ensure_ascii=False) + "\n")

	capped = f" (capped from {total} via --sample {args.sample})" if args.max_pairs is not None and total > len(pairs) else ""
	print(f"Wrote {len(pairs)} prompt/chosen pairs for person {args.person_id}{capped} -> {out_path}")
	if len(pairs) == 0:
		print("  (no pairs: check person_id, session window, or that data_all_speeches/ sittings exist)")


if __name__ == "__main__":
	main()
