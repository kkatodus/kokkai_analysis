"""Draw the Phase 1 gold set (specs/speech-quality-labels §4.1) and merge its labels.

  python -m speech_quality.sample_gold scan     # features of every exchange since 2000 → pool cache
  python -m speech_quality.sample_gold draw     # stratified sample → gold/sample_v1.jsonl (+ texts to label)
  python -m speech_quality.sample_gold merge    # gold/labels_v1.jsonl + sample → gold/gold_v1.jsonl

The sample is deterministic (SEED). Strata: random exchanges by era × house
(committees, 予算委員会, plenary) plus keyword strata that oversample likely
failures, so every §3.2 issue shows up. Keywords only pick candidates; the
labels come from reading each exchange.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from collections import Counter, defaultdict
from multiprocessing import Pool
from pathlib import Path
from typing import Dict, List, Optional

from .segment import segment

REPO_ROOT = Path(__file__).resolve().parents[2]
ISSUES_DIR = Path(os.environ.get("SPEECH_UPDATE_MIRROR", REPO_ROOT / "s3_mirror" / "kokkai-doc")) / "issues"
GOLD_DIR = Path(__file__).resolve().parent / "gold"
WORK_DIR = Path(os.environ.get("SPEECH_QUALITY_WORK", REPO_ROOT / "s3_mirror" / ".speech-quality"))
POOL_FILE = WORK_DIR / "gold_pool.jsonl"
TEXTS_FILE = WORK_DIR / "gold_texts_v1.jsonl"
SEED = 20261018
SINCE = "2000-01-01"

KEYWORDS = {
	# questioner side
	"scandal_public": ("q", r"森友|加計|桜を見る会|裏金|政治資金|統一教会|公文書|改ざん|口利き|政治とカネ|官製談合|天下り|日報"),
	"scandal_private": ("q", r"不倫|週刊誌|週刊|女性問題|交際|飲酒|泥酔|愛人|スキャンダル|報道によれば|文春|新潮"),
	"attack": ("q", r"資格がない|辞任すべき|辞めるべき|恥ずかしく|うそつき|嘘つき|無能|適格性|罷免"),
	"redundant": ("q", r"先ほども|何度も|何度聞いても|繰り返しお聞き|同じ質問|重ねてお伺い|改めてお聞き"),
	"softball": ("q", r"御所見|御決意|意気込み|お聞かせ願|評価をお聞かせ|力強い|心強い|感謝申し上げ"),
	# answerer side
	"evasive": ("a", r"差し控え|お答えすることは困難|お答えは控え|個別の事案|仮定の質問|一概にお答え"),
	# anyone, including the chair
	"dispute": ("all", r"撤回|議事進行|速記を止め|速記をとめ|理事会で協議|答弁になってい|質問に答えて|時間が来|発言を許可していません|不規則発言"),
	# stricter patterns for the supplement (the main strata above under-produced these issues)
	"private_strict": ("q", r"不倫|愛人|路上キス|女性問題|下半身|ホステス|キャバクラ|泥酔|酒に酔"),
	"stenography": ("all", r"速記を止め|速記中止"),
	"repeat_strict": ("all", r"同じ答弁|同じ質問|繰り返しの答弁|何度も同じ|さっきと同じ|先ほどと同じ|同じことを聞"),
}


def era(date: str) -> str:
	y = int(date[:4])
	return "2000s" if y < 2010 else "2010s" if y < 2020 else "2020s"


def ruling(group: Optional[str], date: str) -> bool:
	"""Cabinet parties at the time (a coarse rule; 2025-10 onward counts 自民 only)."""
	g = group or ""
	if "自由民主" in g:
		return not ("2009-09-16" <= date < "2012-12-26")
	if "公明" in g:
		return date < "2009-09-16" or "2012-12-26" <= date < "2025-10-10"
	if "保守" in g:
		return date < "2003-11-21" and "日本保守" not in g
	if "国民新" in g:
		return "2009-09-16" <= date < "2012-12-26"
	if "社会民主" in g or "社民" in g:
		return "2009-09-16" <= date < "2010-05-30"
	if "民主" in g:
		return "2009-09-16" <= date < "2012-12-26"
	return False


def kind_of_meeting(name: str) -> str:
	if name == "本会議":
		return "plenary"
	if "予算委員会" in name:
		return "budget"
	return "committee"


def scan_issue(issue_id: str) -> List[dict]:
	d = ISSUES_DIR / issue_id
	try:
		meta = json.loads((d / "meta.json").read_text(encoding="utf-8"))
		speeches = [json.loads(l) for l in (d / "speeches.jsonl").open(encoding="utf-8")]
	except (OSError, ValueError):
		return []
	date = meta.get("date") or ""
	if date < SINCE:
		return []
	out = []
	for ex in segment(issue_id, speeches):
		if not ex.answerers:
			continue
		q, a = ex.text_of("questioner"), ex.text_of("answerer")
		every = "\n".join(t.text for t in ex.turns)
		hits = {
			k: len(re.findall(pat, {"q": q, "a": a, "all": every}[side]))
			for k, (side, pat) in KEYWORDS.items()
		}
		out.append({
			"issue_id": issue_id, "index": ex.index, "date": date,
			"house": meta.get("nameOfHouse"), "meeting": meta.get("nameOfMeeting"),
			"meeting_kind": kind_of_meeting(meta.get("nameOfMeeting") or ""),
			"questioner": ex.questioner, "questioner_group": ex.questioner_group,
			"ruling": ruling(ex.questioner_group, date), "turns": len(ex.turns),
			"chars": ex.chars, "hits": {k: v for k, v in hits.items() if v},
		})
	return out


def cmd_scan(_args) -> int:
	ids = sorted(i for i in os.listdir(ISSUES_DIR) if i[-8:] >= SINCE.replace("-", ""))
	WORK_DIR.mkdir(parents=True, exist_ok=True)
	n = 0
	with Pool() as pool, POOL_FILE.open("w", encoding="utf-8") as f:
		for rows in pool.imap_unordered(scan_issue, ids, chunksize=64):
			for r in rows:
				f.write(json.dumps(r, ensure_ascii=False) + "\n")
				n += 1
	print(f"{len(ids)} meetings, {n} exchanges → {POOL_FILE}")
	return 0


# stratum → (filter, how many); strata are drawn in this order and never reuse an exchange
def _fits(r: dict) -> bool:
	limit = 25000 if r["meeting_kind"] == "plenary" else 12000
	return 400 <= r["chars"] <= limit


STRATA = [
	("kw_scandal_private", lambda r: r["hits"].get("scandal_private", 0) >= 2, 12),
	("kw_scandal_public", lambda r: r["hits"].get("scandal_public", 0) >= 3, 12),
	("kw_evasive", lambda r: r["hits"].get("evasive", 0) >= 2, 10),
	("kw_dispute", lambda r: r["hits"].get("dispute", 0) >= 2, 10),
	("kw_softball", lambda r: r["ruling"] and r["hits"].get("softball", 0) >= 2, 12),
	("kw_attack", lambda r: r["hits"].get("attack", 0) >= 1, 6),
	("kw_redundant", lambda r: r["hits"].get("redundant", 0) >= 2, 8),
	("random_plenary", lambda r: r["meeting_kind"] == "plenary", 15),
	("random_budget", lambda r: r["meeting_kind"] == "budget", 25),
	("random_committee", lambda r: r["meeting_kind"] == "committee", 40),
]


def draw(pool: List[dict], rng: random.Random, strata=None, exclude_issues=()) -> List[dict]:
	taken, out = set(), []
	for name, keep, n in (strata or STRATA):
		cells: Dict[tuple, List[dict]] = defaultdict(list)
		for r in pool:
			if (r["issue_id"], r["index"]) not in taken and r["issue_id"] not in exclude_issues and _fits(r) and keep(r):
				# 両院 (党首討論) shares the 衆 cell so it comes up about as often as it occurs
				house = "参議院" if r["house"] == "参議院" else "衆議院"
				cells[(era(r["date"]), house)].append(r)
		for c in cells.values():
			rng.shuffle(c)
		order = sorted(cells)
		picked = 0
		while picked < n and any(cells[k] for k in order):
			for k in order:
				if picked >= n or not cells[k]:
					continue
				r = cells[k].pop()
				# at most one exchange per meeting per stratum keeps the set varied
				if any(o["issue_id"] == r["issue_id"] for o in out):
					continue
				taken.add((r["issue_id"], r["index"]))
				out.append({**r, "stratum": name})
				picked += 1
	return out


# drawn after the main sample (sample_v1) was labelled, because private_scandal,
# redundant, procedural_dispute and personal_attack each came out fewer than 5 times
SUPPLEMENT = [
	("sup_private", lambda r: r["hits"].get("private_strict", 0) >= 2, 5),
	("sup_dispute", lambda r: r["hits"].get("stenography", 0) >= 3, 4),
	("sup_redundant", lambda r: r["hits"].get("repeat_strict", 0) >= 2, 4),
	("sup_attack", lambda r: r["hits"].get("attack", 0) >= 3, 3),
]


# Hand-picked after the keyword supplement still yielded too few private_scandal and
# redundant cases: exchanges whose question text names a politician's affair
# (路上キス|不倫|愛人, 2000–2025) or where the questioner says the question repeats an
# earlier one (重複しますが|重なりますが|同じ質問になりますが), chosen to spread years.
SUPPLEMENT_MANUAL = [
	("115015206X00220001102#8", "sup_manual_private"),
	("119005261X01120160210#6", "sup_manual_private"),
	("121205206X00220231108#10", "sup_manual_private"),
	("121314103X00120240401#4", "sup_manual_private"),
	("118704376X00520141112#1", "sup_manual_redundant"),
	("118205124X00220130124#7", "sup_manual_redundant"),
	("118605124X01320140418#13", "sup_manual_redundant"),
]


def gold_id(r: dict) -> str:
	return f"{r['issue_id']}#{r['index']}"


def cmd_draw(args) -> int:
	pool = [json.loads(l) for l in POOL_FILE.open(encoding="utf-8")]
	if args.supplement:
		main = {json.loads(l)["issue_id"] for l in (GOLD_DIR / "sample_v1.jsonl").open(encoding="utf-8")}
		sample = draw(pool, random.Random(SEED + 1), SUPPLEMENT, main)
		by_id = {gold_id(r): r for r in pool}
		sample += [{**by_id[g], "stratum": name} for g, name in SUPPLEMENT_MANUAL]
		sample_file, texts_file = GOLD_DIR / "sample_v1_supplement.jsonl", WORK_DIR / "gold_texts_v1_supplement.jsonl"
	else:
		sample = draw(pool, random.Random(SEED))
		sample_file, texts_file = GOLD_DIR / "sample_v1.jsonl", TEXTS_FILE
	GOLD_DIR.mkdir(parents=True, exist_ok=True)
	with sample_file.open("w", encoding="utf-8") as f:
		for r in sample:
			f.write(json.dumps({"gold_id": gold_id(r), **r}, ensure_ascii=False) + "\n")
	# full texts for labelling stay out of git (they are in the mirror anyway)
	with texts_file.open("w", encoding="utf-8") as f:
		for r in sample:
			d = ISSUES_DIR / r["issue_id"]
			speeches = [json.loads(l) for l in (d / "speeches.jsonl").open(encoding="utf-8")]
			exs = segment(r["issue_id"], speeches)
			ex = exs[r["index"]]
			earlier = [
				f"{e.questioner}: {e.text_of('questioner')[:120]}".replace("\r\n", " ")
				for e in exs[: r["index"]]
			]
			f.write(json.dumps({
				"gold_id": gold_id(r), "stratum": r["stratum"], "date": r["date"], "house": r["house"],
				"meeting": r["meeting"], "questioner": ex.questioner, "questioner_group": ex.questioner_group,
				"ruling": r["ruling"], "earlier": earlier,
				"turns": [{"id": t.speech_id, "kind": t.kind, "speaker": t.speaker, "text": t.text} for t in ex.turns],
			}, ensure_ascii=False) + "\n")
	print(Counter(r["stratum"] for r in sample))
	print(Counter((era(r["date"]), r["house"], r["meeting_kind"]) for r in sample))
	print(f"{len(sample)} exchanges → {sample_file}; texts → {texts_file}")
	return 0


LABEL_FIELDS = ("function", "issues", "contribution", "responsible", "outcomes", "topic", "topic_detail", "reason", "reason_en", "confidence", "notes")


def _read_jsonl(path: Path) -> Dict[str, dict]:
	if not path.exists():
		return {}
	return {json.loads(l)["gold_id"]: json.loads(l) for l in path.open(encoding="utf-8") if l.strip()}


def cmd_merge(_args) -> int:
	sample = {**_read_jsonl(GOLD_DIR / "sample_v1.jsonl"), **_read_jsonl(GOLD_DIR / "sample_v1_supplement.jsonl")}
	texts = {**_read_jsonl(TEXTS_FILE), **_read_jsonl(WORK_DIR / "gold_texts_v1_supplement.jsonl")}
	labels = [json.loads(l) for l in (GOLD_DIR / "labels_v1.jsonl").open(encoding="utf-8") if l.strip()]
	missing = set(sample) - {l["gold_id"] for l in labels}
	if missing:
		print(f"{len(missing)} sampled exchange(s) have no label: {sorted(missing)[:5]}", file=sys.stderr)
	n = 0
	with (GOLD_DIR / "gold_v1.jsonl").open("w", encoding="utf-8") as f:
		for lab in labels:
			if lab.get("excluded"):
				continue  # not a Q&A exchange (segmenter error); kept in labels_v1 with the reason
			s, t = sample[lab["gold_id"]], texts[lab["gold_id"]]
			f.write(json.dumps({
				"gold_id": lab["gold_id"], "issue_id": s["issue_id"], "exchange_index": s["index"],
				"speech_ids": [x["id"] for x in t["turns"]], "date": s["date"], "house": s["house"],
				"meeting": s["meeting"], "stratum": s["stratum"],
				"questioner": s["questioner"], "questioner_group": s["questioner_group"], "ruling": s["ruling"],
				"answerers": list(dict.fromkeys(x["speaker"] for x in t["turns"] if x["kind"] == "answerer")),
				"labels": {k: lab[k] for k in LABEL_FIELDS if k in lab},
				"labeller": "claude-opus-5-5",
			}, ensure_ascii=False) + "\n")
			n += 1
	print(f"{n} labelled exchanges → {GOLD_DIR / 'gold_v1.jsonl'}")
	return 0


def main(argv: Optional[List[str]] = None) -> int:
	p = argparse.ArgumentParser(prog="python -m speech_quality.sample_gold")
	sub = p.add_subparsers(dest="cmd", required=True)
	sub.add_parser("scan")
	p_draw = sub.add_parser("draw")
	p_draw.add_argument("--supplement", action="store_true", help="draw the targeted supplement instead of the main sample")
	sub.add_parser("merge")
	args = p.parse_args(argv)
	return {"scan": cmd_scan, "draw": cmd_draw, "merge": cmd_merge}[args.cmd](args)


if __name__ == "__main__":
	sys.exit(main())
