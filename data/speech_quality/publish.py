"""Site files built from `label_result` (specs/speech-quality-ui §2).

  speech_quality/aggregate.json          every labelled person's counts, plus corpus totals and coverage
  speech_quality/persons/{person_id}.jsonl   one line per exchange the person took part in, newest first
  speech_quality/site_stats.json         small site-wide numbers for the dashboard loading cards
                                         (specs/dashboard-loading §8)

From data/:
  python -m speech_quality.publish --all              # rebuild everything (also backfills questioner_group)
  python -m speech_quality.publish PERSON_ID...       # rewrite these persons' files and the aggregate
  python -m speech_quality.publish --backfill-groups  # only fill label_result.questioner_group from the issue files
  python -m speech_quality.publish --site-stats       # only rewrite site_stats.json

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
SITE_STATS_PATH = "speech_quality/site_stats.json"
MEMBERS_DIR = "parliamentMembers"
CORPUS_FROM = "2000-01-01"
TOP_N = 5
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


# --- site stats (specs/dashboard-loading §8) ---
#
# Named politicians appear only with neutral counts (speeches, exchanges taken part in, terms).
# AI-label numbers are site-wide shares only, never per person.

def _shares(counts: Dict[str, int], n: int) -> Dict[str, float]:
	return {k: round(v / n, 4) if n else 0.0 for k, v in counts.items()}


def _top(scores: Dict[int, int], current: Dict[int, dict], names: Dict[int, str], n: int = TOP_N) -> List[dict]:
	"""Top `n` current members by score (ties broken by person_id so the file is stable)."""
	ranked = sorted(((v, pid) for pid, v in scores.items() if pid in current and v), key=lambda t: (-t[0], t[1]))
	return [{"person_id": pid, "name": names.get(pid) or current[pid].get("name"), "group": current[pid].get("group"),
		"n": v} for v, pid in ranked[:n]]


def site_stats(agg: dict, current: Dict[int, dict], names: Dict[int, str], speech_counts: Dict[int, int],
		corpus: dict, n_persons_total: int, generated_at: Optional[datetime] = None) -> dict:
	"""The site_stats.json document.

	current       person_id → {"house": "lower" | "upper", "group": short party name, "terms_lower": int | None}
	speech_counts person_id → speeches since CORPUS_FROM (current members only is enough)
	corpus        {"speeches": int, "meetings": int, "from": "YYYY-MM-DD"} for speeches since CORPUS_FROM
	"""
	tq = agg["totals"]["as_questioner"]
	n = tq["n"]
	q_scores = {p["person_id"]: (p["as_questioner"] or {}).get("n", 0) for p in agg["persons"]}
	a_scores = {p["person_id"]: (p["as_answerer"] or {}).get("n", 0) for p in agg["persons"]}
	terms = {pid: c["terms_lower"] for pid, c in current.items() if c.get("house") == "lower" and c.get("terms_lower")}
	# questioner-side issues are counted in the questioner totals, answerer-side (evasive, …) in the
	# answerer totals; an exchange flagged with the same type on both sides is rare, so sum and cap
	ta_issues = agg["totals"]["as_answerer"].get("issues", {})
	issue_any = {k: min(n, v["part"] + v["most"] + ta_issues.get(k, {}).get("part", 0) + ta_issues.get(k, {}).get("most", 0))
		for k, v in tq["issues"].items()}
	return {
		"version": VERSION,
		"generated_at": (generated_at or datetime.now().astimezone()).isoformat(timespec="seconds"),
		"corpus": corpus,
		"labels": {**agg["coverage"], "persons": len(agg["persons"])},
		"n_persons_total": n_persons_total,
		"current_members": {
			"lower": sum(1 for c in current.values() if c.get("house") == "lower"),
			"upper": sum(1 for c in current.values() if c.get("house") == "upper"),
		},
		"function_share": _shares(tq["function"], n),
		"contribution_share": _shares(tq["contribution"], n),
		"issue_share": _shares(issue_any, n),
		"outcome_share": _shares(tq["outcomes"], n),
		"top_speakers_current": _top(speech_counts, current, names),
		"top_questioners_current": _top(q_scores, current, names),
		"top_answerers_current": _top(a_scores, current, names),
		"top_terms_lower_current": _top(terms, current, names),
	}


def current_members(mirror_root: Path) -> Dict[int, dict]:
	"""Sitting members from the newest 衆/参 snapshot in parliamentMembers/ (member-auto-update)."""
	out: Dict[int, dict] = {}
	for prefix, house in (("shugiin", "lower"), ("sangiin", "upper")):
		files = sorted((mirror_root / MEMBERS_DIR).glob(f"{prefix}_*.json"))
		if not files:
			continue
		for r in json.loads(files[-1].read_text(encoding="utf-8")).get("reprs", []):
			pid = r.get("person_id")
			if pid is None:
				continue
			out[int(pid)] = {"house": house, "group": r.get("kaiha") or None,
				"name": " ".join((r.get("name") or "").split()) or None,
				"terms_lower": r.get("number_of_terms_lower") if house == "lower" else None}
	return out


def speech_counts(cur, since: str = CORPUS_FROM) -> tuple:
	"""(person_id → speeches, corpus totals) for speeches since `since`. Two scans of `speeches` (~8 s)."""
	cur.execute("SELECT person_id, count(*) FROM speeches WHERE date >= %s GROUP BY person_id", (since,))
	per_person = {int(pid): int(c) for pid, c in cur.fetchall()}
	cur.execute("SELECT count(DISTINCT issue_id), min(date) FROM speeches WHERE date >= %s", (since,))
	meetings, first = cur.fetchone()
	return per_person, {"speeches": sum(per_person.values()), "meetings": int(meetings or 0),
		"from": str(first) if first else None}


def write_site_stats(cur, mirror_root: Path, agg: dict) -> str:
	current = current_members(mirror_root)
	per_person, corpus = speech_counts(cur)
	names = person_names(cur, current)
	cur.execute("SELECT count(*) FROM person")
	n_total = int(cur.fetchone()[0])
	doc = site_stats(agg, current, names, per_person, corpus, n_total)
	write_atomic(mirror_root / SITE_STATS_PATH, json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
	return SITE_STATS_PATH


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
	try:
		paths.append(write_site_stats(cur, mirror_root, agg))
	except Exception:  # the loading cards are optional; never fail the label publish over them
		log.exception("site_stats.json not written")

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
	log.info("published %d file(s) incl. the aggregate (%d exchanges, %d persons)", len(paths),
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
	p.add_argument("--site-stats", action="store_true", help="only rewrite site_stats.json from the current aggregate")
	args = p.parse_args(argv)
	if not (args.all or args.backfill_groups or args.person_ids or args.site_stats):
		p.error("give PERSON_ID..., --all, --backfill-groups or --site-stats")

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
			if args.site_stats and not (args.all or args.person_ids):
				agg = json.loads((cfg.mirror_root / AGGREGATE_PATH).read_text(encoding="utf-8"))
				path = write_site_stats(cur, cfg.mirror_root, agg)
				state.add_pending_paths([path])
				print(f"{path} written; upload with `python -m speech_update upload`")
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
