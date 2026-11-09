"""Site files built from `label_result` (specs/speech-quality-ui §2).

  speech_quality/aggregate.json          every labelled person's counts, plus corpus totals and coverage
  speech_quality/persons/{person_id}.jsonl   one line per exchange the person took part in, newest first

From data/:
  python -m speech_quality.publish --all              # rebuild everything (also backfills questioner_group)
  python -m speech_quality.publish PERSON_ID...       # rewrite these persons' files and the aggregate
  python -m speech_quality.publish --backfill-groups  # only fill label_result.questioner_group from the issue files

The nightly `label` stage calls `rebuild()` for the persons whose exchanges got labels. Changed
paths are queued for the next upload, like the issue files.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set

from speech_update.state import write_atomic

from .prompt import CONTRIBUTIONS, FUNCTIONS, ISSUES, OUTCOMES, PROMPT_VERSION, RESPONSIBLE, TOPICS

log = logging.getLogger("speech_quality.publish")

AGGREGATE_PATH = "speech_quality/aggregate.json"
PERSONS_DIR = "speech_quality/persons"
VERSION = 1

ROW_COLS = ("start_speech_id", "issue_id", "speech_ids", "date", "questioner", "questioner_group",
	"questioner_person_id", "answerer_person_ids", "function", "contribution", "issues", "responsible",
	"outcomes", "topic", "reason", "model")
ANSWER_OUTCOMES = ("new_information", "commitment")


# --- counting (pure; rows are dicts with ROW_COLS) ---

def _issue_counts() -> Dict[str, Dict[str, int]]:
	return {t: {"part": 0, "most": 0} for t in ISSUES}


def new_counts() -> dict:
	return {
		"n": 0, "first": None, "last": None,
		"function": {f: 0 for f in FUNCTIONS},
		"contribution": {c: 0 for c in CONTRIBUTIONS},
		"issues": _issue_counts(),
		"flagged": {"any": 0, "most": 0},   # exchanges with ≥1 issue on this side / with one covering most of it
		"outcomes": {o: 0 for o in OUTCOMES},
		"topic": {t: 0 for t in TOPICS},
		"responsible": {r: 0 for r in RESPONSIBLE},
	}


def new_answer_counts() -> dict:
	return {"n": 0, "first": None, "last": None, "issues": _issue_counts(), "flagged": {"any": 0, "most": 0},
		"outcomes": {o: 0 for o in ANSWER_OUTCOMES}}


def _span(c: dict, d: str) -> None:
	c["n"] += 1
	c["first"] = d if c["first"] is None or d < c["first"] else c["first"]
	c["last"] = d if c["last"] is None or d > c["last"] else c["last"]


def _bump(d: Dict[str, int], key: Optional[str]) -> None:
	if key in d:
		d[key] += 1


def _issue_bump(c: dict, row_issues: Iterable[dict], sides: Sequence[str]) -> None:
	issues, hit, most = c["issues"], False, False
	for i in row_issues or []:
		if i.get("by") in sides and i.get("type") in issues and i.get("extent") in ("part", "most"):
			issues[i["type"]][i["extent"]] += 1
			hit, most = True, most or i["extent"] == "most"
	c["flagged"]["any"] += hit
	c["flagged"]["most"] += most


def add_as_questioner(c: dict, row: dict) -> None:
	_span(c, str(row["date"]))
	_bump(c["function"], row["function"])
	_bump(c["contribution"], row["contribution"])
	_issue_bump(c, row["issues"], ("questioner", "both"))
	for o in row["outcomes"] or []:
		_bump(c["outcomes"], o)
	_bump(c["topic"], row["topic"])
	_bump(c["responsible"], row["responsible"])


def add_as_answerer(c: dict, row: dict) -> None:
	_span(c, str(row["date"]))
	_issue_bump(c, row["issues"], ("answerer", "both"))
	for o in row["outcomes"] or []:
		_bump(c["outcomes"], o)


def aggregate(rows: List[dict], names: Dict[int, str], generated_at: Optional[datetime] = None) -> dict:
	"""The aggregate.json document (§2.1) for every person appearing in `rows`."""
	q: Dict[int, dict] = {}
	a: Dict[int, dict] = {}
	group_at: Dict[int, tuple] = {}   # person → (date, group) of their latest exchange as questioner
	tq, ta = new_counts(), new_answer_counts()
	issues: Set[str] = set()
	models: Counter = Counter()
	for r in rows:
		add_as_questioner(tq, r)
		add_as_answerer(ta, r)
		issues.add(r["issue_id"])
		models[r["model"]] += 1
		pid = r["questioner_person_id"]
		if pid is not None:
			add_as_questioner(q.setdefault(pid, new_counts()), r)
			d = str(r["date"])
			if r.get("questioner_group") and (pid not in group_at or d > group_at[pid][0]):
				group_at[pid] = (d, r["questioner_group"])
		for pid in r["answerer_person_ids"] or []:
			add_as_answerer(a.setdefault(pid, new_answer_counts()), r)
	persons = []
	for pid in sorted(set(q) | set(a)):
		persons.append({
			"person_id": pid, "name": names.get(pid), "group": group_at.get(pid, (None, None))[1],
			"as_questioner": q.get(pid), "as_answerer": a.get(pid),
		})
	return {
		"version": VERSION,
		"generated_at": (generated_at or datetime.now().astimezone()).isoformat(timespec="seconds"),
		"prompt_version": PROMPT_VERSION,
		"models": dict(models.most_common()),   # model → exchanges labelled by it
		"coverage": {"from": tq["first"], "to": tq["last"], "exchanges": tq["n"], "meetings": len(issues)},
		"totals": {"as_questioner": tq, "as_answerer": ta},
		"persons": persons,
	}


def _order(speech_id: str) -> Optional[int]:
	tail = speech_id.rsplit("_", 1)[-1]
	return int(tail) if tail.isdigit() else None


def person_lines(rows: Iterable[dict], person_id: int, meetings: Dict[str, tuple]) -> List[dict]:
	"""This person's exchanges (§2.2), newest first. `meetings`: issue_id → (house, meeting)."""
	out = []
	for r in rows:
		roles = []
		if r["questioner_person_id"] == person_id:
			roles.append("questioner")
		if person_id in (r["answerer_person_ids"] or []):
			roles.append("answerer")
		if not roles:
			continue
		house, meeting = meetings.get(r["issue_id"], (None, None))
		out.append({
			"role": "both" if len(roles) == 2 else roles[0],
			"start_speech_id": r["start_speech_id"], "issue_id": r["issue_id"], "date": str(r["date"]),
			"house": house, "meeting": meeting,
			"questioner": r["questioner"], "questioner_group": r.get("questioner_group"),
			"orders": [o for o in (_order(s) for s in r["speech_ids"]) if o is not None],
			"function": r["function"], "contribution": r["contribution"], "issues": r["issues"] or [],
			"responsible": r["responsible"], "outcomes": list(r["outcomes"] or []), "topic": r["topic"],
			"reason": r["reason"], "model": r["model"],
		})
	out.sort(key=lambda l: (l["date"], l["issue_id"], l["orders"][0] if l["orders"] else 0), reverse=True)
	return out


def persons_in(rows: Iterable[dict]) -> Set[int]:
	ids: Set[int] = set()
	for r in rows:
		if r["questioner_person_id"] is not None:
			ids.add(r["questioner_person_id"])
		ids.update(r["answerer_person_ids"] or [])
	return ids


# --- Postgres and files ---

def load_rows(cur) -> List[dict]:
	cur.execute(f"SELECT {', '.join(ROW_COLS)} FROM label_result")
	return [dict(zip(ROW_COLS, r)) for r in cur.fetchall()]


def persons_for_issues(cur, issue_ids: Iterable[str]) -> Set[int]:
	"""Every person who asked or answered in these meetings' labelled exchanges."""
	ids = sorted(set(issue_ids))
	if not ids:
		return set()
	cur.execute("SELECT questioner_person_id, answerer_person_ids FROM label_result WHERE issue_id = ANY(%s)", (ids,))
	return persons_in([{"questioner_person_id": q, "answerer_person_ids": a} for q, a in cur.fetchall()])


def person_names(cur, person_ids: Iterable[int]) -> Dict[int, str]:
	ids = sorted(person_ids)
	if not ids:
		return {}
	cur.execute("SELECT person_id, name_kanji FROM person WHERE person_id = ANY(%s)", (ids,))
	return dict(cur.fetchall())


def meeting_names(cur, issue_ids: Iterable[str], issues_dir: Optional[Path] = None) -> Dict[str, tuple]:
	"""issue_id → (house, meeting), from the speeches table, else the meeting's meta.json."""
	ids = sorted(set(issue_ids))
	out: Dict[str, tuple] = {}
	if ids:
		cur.execute("""SELECT DISTINCT ON (issue_id) issue_id, name_of_house, name_of_meeting
			FROM speeches WHERE issue_id = ANY(%s) ORDER BY issue_id""", (ids,))
		out = {i: (h, m) for i, h, m in cur.fetchall()}
	if issues_dir is not None:
		for i in ids:
			if i in out:
				continue
			try:
				meta = json.loads((issues_dir / i / "meta.json").read_text(encoding="utf-8"))
				out[i] = (meta.get("nameOfHouse"), meta.get("nameOfMeeting"))
			except (OSError, ValueError):
				pass
	return out


def backfill_groups(cur, issues_dir: Path) -> int:
	"""Fill `questioner_group` where it's missing, from the first speech's speakerGroup. Returns rows updated."""
	cur.execute("SELECT issue_id, array_agg(start_speech_id) FROM label_result WHERE questioner_group IS NULL GROUP BY issue_id")
	todo = cur.fetchall()
	n = 0
	for issue_id, starts in todo:
		want = set(starts)
		try:
			with open(issues_dir / issue_id / "speeches.jsonl", encoding="utf-8") as f:
				for l in f:
					if not l.strip():
						continue
					s = json.loads(l)
					if s.get("speechID") in want and s.get("speakerGroup"):
						cur.execute("UPDATE label_result SET questioner_group = %s WHERE start_speech_id = %s",
							(s["speakerGroup"], s["speechID"]))
						n += 1
		except OSError:
			continue
	return n


def _dump(obj) -> str:
	return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def rebuild(cur, mirror_root: Path, persons: Optional[Iterable[int]] = None, issues_dir: Optional[Path] = None,
		rows: Optional[List[dict]] = None) -> List[str]:
	"""Write aggregate.json and the per-person files (all persons when `persons` is None).
	Returns the mirror-relative paths written."""
	rows = load_rows(cur) if rows is None else rows
	if not rows:
		return []
	everyone = persons_in(rows)
	targets = everyone if persons is None else (set(persons) & everyone)
	names = person_names(cur, everyone)
	issues_dir = issues_dir or mirror_root / "issues"
	paths: List[str] = []

	agg = aggregate(rows, names)
	write_atomic(mirror_root / AGGREGATE_PATH, _dump(agg) + "\n")
	paths.append(AGGREGATE_PATH)

	if targets:
		needed = {r["issue_id"] for r in rows if r["questioner_person_id"] in targets or targets & set(r["answerer_person_ids"] or [])}
		meetings = meeting_names(cur, needed, issues_dir)
		by_person: Dict[int, List[dict]] = defaultdict(list)
		for r in rows:
			for pid in persons_in([r]) & targets:
				by_person[pid].append(r)
		for pid in sorted(targets):
			lines = person_lines(by_person.get(pid, []), pid, meetings)
			rel = f"{PERSONS_DIR}/{pid}.jsonl"
			write_atomic(mirror_root / rel, "".join(_dump(l) + "\n" for l in lines))
			paths.append(rel)
	log.info("published %d person file(s) and the aggregate (%d exchanges, %d persons)", len(paths) - 1,
		agg["coverage"]["exchanges"], len(agg["persons"]))
	return paths


def main(argv: Optional[List[str]] = None) -> int:
	from dotenv import load_dotenv
	from speech_update.__main__ import connect_postgres
	from speech_update.config import load_config
	from speech_update.state import LockHeld, State

	p = argparse.ArgumentParser(prog="python -m speech_quality.publish", description=__doc__,
		formatter_class=argparse.RawDescriptionHelpFormatter)
	p.add_argument("person_ids", nargs="*", type=int)
	p.add_argument("--all", action="store_true")
	p.add_argument("--backfill-groups", action="store_true")
	args = p.parse_args(argv)
	if not (args.all or args.backfill_groups or args.person_ids):
		p.error("give PERSON_ID..., --all or --backfill-groups")

	cfg = load_config()
	load_dotenv(cfg.env_file)
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
	conn = connect_postgres()
	if conn is None:
		print("Postgres is not reachable", file=sys.stderr)
		return 1
	state = State(cfg.state_dir)
	try:
		state.acquire_lock()
	except LockHeld as e:
		print(e, file=sys.stderr)
		return 75
	try:
		with conn, conn.cursor() as cur:
			from . import ledger
			ledger.ensure(cur)
			if args.all or args.backfill_groups:
				n = backfill_groups(cur, cfg.issues_dir)
				print(f"questioner_group filled on {n} row(s)")
			if args.all or args.person_ids:
				paths = rebuild(cur, cfg.mirror_root, None if args.all else args.person_ids, cfg.issues_dir)
				state.add_pending_paths(paths)
				print(f"{len(paths)} file(s) written; upload with `python -m speech_update upload`")
		return 0
	finally:
		state.release_lock()
		conn.close()


if __name__ == "__main__":
	sys.exit(main())
