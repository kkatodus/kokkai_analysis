"""Review unsure speech → politician matches (specs/speaker-review). Run from data/.

  python -m speech_update.review                 interactive: one speaker/politician pair at a time
  python -m speech_update.review scan            queue every flagged match in the mirror (backlog)
  python -m speech_update.review list [--reason R] [--status S] [--limit N]
  python -m speech_update.review decide ID confirm|unlink|reassign [PERSON_ID] [--note TEXT]
  python -m speech_update.review apply [--dry-run]   move speeches per decisions (the nightly run does this too)

Decisions: confirm = right person; unlink = not this person (and not anyone in
`person`); reassign = a different person_id. Changed files are queued for the
next `python -m speech_update upload` (or the nightly run).
"""
from __future__ import annotations

import argparse
import logging
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

from dotenv import load_dotenv

from . import review_store as store
from .__main__ import connect_postgres, make_router, setup_logging
from .config import Config, load_config
from .fetch import read_issue
from .review_store import ReviewKey
from .route import iter_issues_from_disk, remove_from_person_dir
from .state import LockHeld, State
from .variants import same_name, same_reading

log = logging.getLogger("speech_update.review")

QUOTE_CHARS = 140
MAX_ELECTIONS = 8


# --- apply (also called by the nightly run) ---

@dataclass
class ApplyResult:
	decisions: int = 0
	issues: int = 0
	moved: int = 0          # speeches removed from a person's all_speeches
	db_deleted: int = 0
	paths_written: List[str] = field(default_factory=list)
	new_review: List[ReviewKey] = field(default_factory=list)


def target_of(row: dict) -> Optional[int]:
	return {"confirmed": row["person_id"], "reassigned": row["new_person_id"], "unlinked": None}[row["status"]]


def apply_decisions(cfg: Config, state: State, conn, dry_run: bool = False, db_speeches: bool = True) -> Optional[ApplyResult]:
	"""Make the files and `speeches` follow decided, not-yet-applied rows. None if there are none."""
	cur = conn.cursor()
	rows = store.to_apply(cur)
	if not rows:
		return None
	by_key = {ReviewKey(r["speaker"], r["speaker_yomi"], r["person_id"], r["reason"]): r for r in rows}
	issue_ids = store.issues_for(cur, [r["id"] for r in rows])
	result = ApplyResult(decisions=len(rows), issues=len(issue_ids))
	log.info("applying %d decision(s) across %d issue(s)%s", len(rows), len(issue_ids), " (dry run)" if dry_run else "")

	router = make_router(cfg, conn, dry_run, db_speeches=db_speeches and not dry_run)  # fresh resolver: current decisions
	removals: Dict[int, Set[str]] = defaultdict(set)
	unlinked: Set[str] = set()
	for meta, speeches in iter_issues_from_disk(cfg.issues_dir, issue_ids):
		for s in speeches:
			res = router.resolver.resolve(s.get("speaker"), s.get("speakerYomi"), s.get("speakerGroup"), meta["date"])
			row = by_key.get(res.review_key) if res.review_key else None
			if row is None:
				continue
			for old in {row["person_id"], row["applied_person_id"]} - {None, res.person_id}:
				removals[old].add(s["speechID"])
			if res.person_id is None:
				unlinked.add(s["speechID"])

	for pid, ids in sorted(removals.items()):
		n, written = remove_from_person_dir(cfg.persons_dir, pid, ids, dry_run)
		result.moved += n
		result.paths_written += written

	routed = router.route(iter_issues_from_disk(cfg.issues_dir, issue_ids))
	result.paths_written += routed.paths_written
	if not dry_run:
		if unlinked and db_speeches:
			with conn.cursor() as c:
				c.execute("DELETE FROM speeches WHERE speech_id = ANY(%s)", (sorted(unlinked),))
				result.db_deleted = c.rowcount
			conn.commit()
		result.new_review = store.record_held(conn, routed.held, routed.routed_issues, dropped=routed.dropped)
		store.mark_applied(conn, {r["id"]: target_of(r) for r in rows})
		state.add_pending_paths(result.paths_written)
	log.info(
		"apply done: %d decision(s); %d speech(es) removed from old files, %d filed (+%d added); %d DB row(s) deleted; %d file(s) to upload",
		result.decisions, result.moved, routed.added + routed.updated, routed.added, result.db_deleted, len(set(result.paths_written)),
	)
	return result


# --- scan ---

def scan(cfg: Config, conn) -> None:
	import os
	issue_ids = sorted(os.listdir(cfg.issues_dir))
	log.info("scanning %d issues for matches that need review", len(issue_ids))
	router = make_router(cfg, conn, dry_run=False, write_files=False, db_speeches=False)
	routed = router.route(iter_issues_from_disk(cfg.issues_dir, issue_ids))
	new = store.record_held(conn, routed.held, routed.routed_issues, backlog=True, dropped=routed.dropped)
	by_reason: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
	for key, item in [*routed.held.items(), *routed.dropped.items()]:
		by_reason[key.reason][0] += 1
		by_reason[key.reason][1] += item.speeches
	log.info(
		"scan done: %d matched, %d held for review in %d pair(s) (%d new); %d not serving in %d pair(s) (unlinked automatically, removed by `apply`)",
		routed.matched, routed.held_speeches, len(routed.held), len(new), routed.not_serving, len(routed.dropped),
	)
	for reason, (pairs, n) in sorted(by_reason.items()):
		log.info("  %-14s %5d pair(s) %9d speech(es)", reason, pairs, n)


# --- display ---

REASON_TEXT = {
	"kanji_differs": "NDL name differs from the politician's kanji (beyond old/new character forms)",
	"election_pick": "picked among same-name politicians by election history",
	"out_of_term": "speaking as a member (with a group) outside this politician's elected terms: missing election data, or someone else",
	"not_serving": "outside every elected term and not speaking as a member (unlinked automatically)",
}


def quote(cfg: Config, speech_id: str) -> Optional[str]:
	issue = read_issue(cfg.issues_dir / speech_id.rsplit("_", 1)[0])
	if issue is None:
		return None
	meta, speeches = issue
	s = next((s for s in speeches if s["speechID"] == speech_id), None)
	if s is None:
		return None
	text = re.sub(r"\s+", " ", (s.get("speech") or "").split("　", 1)[-1]).strip()
	extra = " / ".join(x for x in (s.get("speakerGroup"), s.get("speakerPosition")) if x)
	return f"{meta['date']} {meta.get('nameOfHouse', '')} {meta.get('nameOfMeeting', '')}{f' [{extra}]' if extra else ''}\n      「{text[:QUOTE_CHARS]}{'…' if len(text) > QUOTE_CHARS else ''}」"


def elections(cur, person_id: int) -> List[str]:
	cur.execute(
		"SELECT election_date, election_name, district, party, result FROM election_result WHERE person_id = %s ORDER BY election_date",
		(person_id,),
	)
	rows = [f"{d} {name or ''} {district or ''} {party or ''} {result or ''}".replace("  ", " ") for d, name, district, party, result in cur.fetchall()]
	if len(rows) > MAX_ELECTIONS:
		rows = rows[:3] + [f"… {len(rows) - MAX_ELECTIONS + 2} more …"] + rows[-(MAX_ELECTIONS - 4):]
	return rows


def lookalikes(people: Dict[int, tuple], row: dict) -> List[str]:
	return [
		f"#{pid} {kanji} ({kana or '?'})"
		for pid, (kanji, kana) in sorted(people.items())
		if pid != row["person_id"] and (same_name(row["speaker"], kanji) or same_reading(row["speaker_yomi"], kana))
	]


def show(cfg: Config, cur, people: Dict[int, tuple], row: dict, pos: str) -> None:
	p = print
	p()
	p(f"── {pos}  item #{row['id']}  [{row['reason']}] {REASON_TEXT[row['reason']]}")
	p(f"   {row['speeches']:,} speech(es) in {row['issues']:,} meeting(s), {row['first_date']} → {row['last_date']}")
	p(f"   NDL speaker:  {row['speaker']} ({row['speaker_yomi'] or '?'})")
	if row["groups"]:
		p(f"   groups:       {', '.join(row['groups'][:6])}{' …' if len(row['groups']) > 6 else ''}")
	if row["positions"]:
		p(f"   positions:    {', '.join(row['positions'][:6])}{' …' if len(row['positions']) > 6 else ''}")
	p(f"   matched to:   #{row['person_id']} {row['name_kanji']} ({row['name_kana'] or '?'})")
	for e in elections(cur, row["person_id"]) or ["(no elections)"]:
		p(f"      {e}")
	others = lookalikes(people, row)
	p(f"   others with this name/reading: {', '.join(others) if others else 'none in `person`'}")
	for sid in row["sample_speech_ids"][:2]:
		q = quote(cfg, sid)
		if q:
			p(f"   ▸ {q}")


HELP = "[y] same person  [n] not this person (unlink)  [r ID] reassign to person ID  [s] skip  [q] quit"


def interactive(cfg: Config, conn, reason: Optional[str]) -> None:
	cur = conn.cursor()
	store.ensure_tables(conn)
	rows = store.summaries(cur, status="pending", reason=reason)
	if not rows:
		print("Nothing to review. (Run `python -m speech_update.review scan` to queue the backlog.)")
		return
	from .resolver import SpeakerResolver
	people = SpeakerResolver(cur).people()
	print(f"{len(rows)} pair(s) to review, biggest first. {HELP}")
	decided = 0
	for n, row in enumerate(rows, 1):
		show(cfg, cur, people, row, f"[{n}/{len(rows)}]")
		while True:
			try:
				answer = input("   > ").strip()
			except EOFError:
				answer = "q"
			parts = answer.split()
			cmd = parts[0].lower() if parts else ""
			try:
				if cmd == "y":
					store.decide(conn, row["id"], "confirmed")
				elif cmd == "n":
					store.decide(conn, row["id"], "unlinked")
				elif cmd == "r" and len(parts) == 2 and parts[1].lstrip("#").isdigit():
					pid = int(parts[1].lstrip("#"))
					print(f"   → #{pid} {people.get(pid, ('?',))[0]}")
					store.decide(conn, row["id"], "reassigned", pid)
				elif cmd == "s":
					break
				elif cmd == "q":
					print(f"{decided} decision(s) saved. They go live with `python -m speech_update.review apply` or the nightly run.")
					return
				else:
					print(f"   {HELP}")
					continue
			except ValueError as e:
				conn.rollback()
				print(f"   ✗ {e}")
				continue
			decided += 1
			break
	print(f"Done: {decided} decision(s) saved. They go live with `python -m speech_update.review apply` or the nightly run.")


def list_items(cur, args) -> None:
	rows = store.summaries(cur, status=None if args.status == "all" else args.status, reason=args.reason)
	print(f"{len(rows)} item(s)")
	for r in rows[: args.limit]:
		target = {"reassigned": f" → #{r['new_person_id']}"}.get(r["status"], "")
		print(
			f"#{r['id']:<6} {r['status']:<10}{target:<8} {r['reason']:<14} {r['speeches']:>7,}  "
			f"{r['speaker']} ({r['speaker_yomi']}) → #{r['person_id']} {r['name_kanji']}  {r['first_date']}→{r['last_date']}"
		)


# --- CLI ---

def main(argv: Optional[List[str]] = None) -> int:
	parser = argparse.ArgumentParser(prog="speech_update.review", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	sub = parser.add_subparsers(dest="command")
	p_review = sub.add_parser("next", help="interactive review (default)")
	p_review.add_argument("--reason", choices=store.REASONS)
	sub.add_parser("scan")
	p_list = sub.add_parser("list")
	p_list.add_argument("--reason", choices=store.REASONS)
	p_list.add_argument("--status", default="pending", choices=(*store.STATUSES, "all"))
	p_list.add_argument("--limit", type=int, default=50)
	p_decide = sub.add_parser("decide")
	p_decide.add_argument("id", type=int)
	p_decide.add_argument("decision", choices=("confirm", "unlink", "reassign"))
	p_decide.add_argument("person_id", type=int, nargs="?")
	p_decide.add_argument("--note")
	p_apply = sub.add_parser("apply")
	p_apply.add_argument("--dry-run", action="store_true")
	p_apply.add_argument("--no-db-speeches", action="store_true")
	args = parser.parse_args(argv)
	command = args.command or "next"

	cfg = load_config()
	load_dotenv(cfg.env_file)
	state = State(cfg.state_dir)
	if command in ("scan", "apply"):
		setup_logging(state)
	conn = connect_postgres()
	if conn is None:
		print("Postgres is not reachable", file=sys.stderr)
		return 1
	try:
		if command == "next":
			interactive(cfg, conn, getattr(args, "reason", None))
		elif command == "list":
			list_items(conn.cursor(), args)
		elif command == "decide":
			status = {"confirm": "confirmed", "unlink": "unlinked", "reassign": "reassigned"}[args.decision]
			store.decide(conn, args.id, status, args.person_id, args.note)
			print(f"#{args.id}: {status}{f' → #{args.person_id}' if args.person_id else ''}")
		else:  # scan / apply write files: take the run lock
			try:
				state.acquire_lock()
			except LockHeld as e:
				log.error("%s", e)
				return 75
			try:
				if command == "scan":
					scan(cfg, conn)
				elif apply_decisions(cfg, state, conn, dry_run=args.dry_run, db_speeches=not args.no_db_speeches and cfg.db_speeches) is None:
					log.info("no decided items waiting to be applied")
			finally:
				state.release_lock()
		return 0
	except ValueError as e:
		print(f"error: {e}", file=sys.stderr)
		return 2
	finally:
		conn.close()


if __name__ == "__main__":
	raise SystemExit(main())
