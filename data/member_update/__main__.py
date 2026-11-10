"""CLI: python -m member_update COMMAND (run from data/). Spec: specs/member-auto-update.

  all [--house H]          scrape both houses → match person_ids → write a new
                           parliamentMembers/{house}_{YYYYMMDD}.json if anything
                           changed → upload (what the monthly job runs)
  pending                  list members with no person_id; writes a JSON template
                           per member under s3_mirror/.member-update/new_members/
  add FILE                 add a verified member (person + election_result,
                           electionHistory/<id>.jsonl, politicians/table.csv)
  link HOUSE NAME ID       pin a member to an existing person_id (ID "none" removes it)
  upload                   upload files left by add / a failed upload
  alias list [ID...]       other names people go by (person_alias), used by the
  alias add ID NAME [--kana K] [--kind K] [--note T]     speech resolver and the matcher;
  alias remove ALIAS_ID    after adding, move filed speeches with
                           `python -m speech_update.review refile NAME`
  merge DROP KEEP          fold duplicate person DROP into KEEP (see merge.py)

--dry-run scrapes and matches but writes nothing to the mirror, S3 or Postgres.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv

from speech_update import aliases
from speech_update.aliases import all_names
from speech_update.notify import MAX_LISTED, Notifier, from_env
from speech_update.state import LockHeld, State, write_atomic

from .config import Config, load_config
from .match import MatchResult, MemberMatcher, Unresolved, link_key, name_key
from .sources import HOUSES, Fetcher
from . import snapshot

log = logging.getLogger("member_update")

HOUSE_JA = {"shugiin": "衆", "sangiin": "参"}
PY = "../.venv-speech-update/bin/python -m member_update"


def setup_logging(state: State) -> Path:
	log_path = state.logs_dir / f"update-{datetime.now():%Y%m%d-%H%M%S}.log"
	fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
	root = logging.getLogger()
	root.setLevel(logging.INFO)
	for handler in (logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stderr)):
		handler.setFormatter(fmt)
		root.addHandler(handler)
	for noisy in ("botocore", "urllib3", "boto3", "s3transfer"):
		logging.getLogger(noisy).setLevel(logging.WARNING)
	return log_path


def connect_postgres():
	import psycopg2
	return psycopg2.connect(
		dbname="kokkaidoc", user="postgres", password=os.getenv("PSQL_DATABASE_PASSWORD"),
		host="localhost", port="5432", connect_timeout=5,
	)


# --- state files (s3_mirror/.member-update/) ---

def links_path(cfg: Config) -> Path:
	return cfg.state_dir / "links.json"


def load_links(cfg: Config) -> Dict[str, int]:
	p = links_path(cfg)
	return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def pending_path(cfg: Config) -> Path:
	return cfg.state_dir / "pending_members.json"


def load_pending(cfg: Config) -> List[dict]:
	p = pending_path(cfg)
	return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def save_pending(cfg: Config, houses_done: List[str], unresolved: List[Unresolved]) -> List[dict]:
	"""Replace the entries of the houses just checked. Returns entries that are new."""
	before = load_pending(cfg)
	key = lambda e: (e["house"], name_key(e["name"]))
	seen = {key(e) for e in before}
	kept = [e for e in before if e["house"] not in houses_done]
	today = date.today().isoformat()
	first_seen = {key(e): e.get("first_seen", today) for e in before}
	fresh = []
	for u in unresolved:
		e = u.as_json()
		e["first_seen"] = first_seen.get(key(e), today)
		kept.append(e)
		if key(e) not in seen:
			fresh.append(e)
	write_atomic(pending_path(cfg), json.dumps(kept, ensure_ascii=False, indent=2) + "\n")
	return fresh


def write_templates(cfg: Config, pending: List[dict]) -> List[Path]:
	out_dir = cfg.state_dir / "new_members"
	out_dir.mkdir(parents=True, exist_ok=True)
	written = []
	for e in pending:
		path = out_dir / f"{e['house']}_{name_key(e['name'])}.json"
		if not path.exists():
			template = {
				"name_kanji": name_key(e["name"]),
				"name_kana": name_key(e["yomikata"]),
				"election_data": [],
				"_from_member_list": {k: e[k] for k in ("house", "name", "kaiha", "district", "link", "reason", "candidates")},
				"_election_data_example": {
					"year": "2026年", "month": "2月", "day": "8日", "election_name": "第51回衆議院議員総選挙",
					"district": "東京1区", "party": "自由民主党", "result": "当選", "election_freq": "（1回目）",
				},
			}
			write_atomic(path, json.dumps(template, ensure_ascii=False, indent=2) + "\n")
		written.append(path)
	return written


# --- commands ---

def run_all(cfg: Config, state: State, args, notifier: Notifier) -> dict:
	started = time.monotonic()
	houses = [args.house] if args.house else list(HOUSES)
	fetcher = Fetcher(min_interval=cfg.min_request_interval)
	scraped: Dict[str, List[dict]] = {}
	skipped: Dict[str, str] = {}
	for house in houses:
		try:
			rows = fetcher.house(house)
		except Exception as e:  # noqa: BLE001 - one house failing shouldn't stop the other
			log.exception("%s: scrape failed", house)
			skipped[house] = f"scrape failed: {type(e).__name__}: {e}"
			continue
		problem = sanity_problem(cfg, house, rows)
		if problem:
			log.warning("%s: %s; leaving its snapshot alone", house, problem)
			skipped[house] = problem
			continue
		scraped[house] = rows
		log.info("%s: %d members scraped", house, len(rows))

	conn = connect_postgres()
	try:
		with conn.cursor() as cur:
			matcher = MemberMatcher(all_names(cur), load_links(cfg))
	finally:
		conn.close()

	result = MatchResult()
	diffs: Dict[str, dict] = {}
	paths: List[str] = []
	for house, rows in scraped.items():
		latest = snapshot.latest_snapshot(cfg.members_dir, house)
		previous = snapshot.read_rows(latest)
		matcher.match_house(house, rows, previous, result)
		diffs[house] = snapshot.diff(previous, rows)
		if rows == previous:
			log.info("%s: no change since %s", house, latest.name if latest else "-")
			continue
		target = snapshot.snapshot_path(cfg.members_dir, house, date.today())
		log.info("%s: writing %s (was %s)%s", house, target.name, latest.name if latest else "-", " (dry run)" if args.dry_run else "")
		if not args.dry_run:
			snapshot.write_snapshot(target, rows)
		paths.append(str(target.relative_to(cfg.mirror_root)))

	fresh_pending: List[dict] = []
	if not args.dry_run:
		state.add_pending_paths(paths)
		fresh_pending = save_pending(cfg, list(scraped), result.unresolved)
		write_templates(cfg, load_pending(cfg))
	uploaded = run_upload(cfg, state, args)

	summary = {
		"houses": {h: len(r) for h, r in scraped.items()},
		"skipped": skipped,
		"snapshots_written": paths,
		"matched": dict(result.by_method),
		"matched_by_reading": [f"{r['name']} → #{pid} {kanji}" for _, r, pid, kanji in result.by_reading],
		"unresolved": len(result.unresolved),
		"unresolved_new": len(fresh_pending),
		"changes": {h: {"joined": len(d["joined"]), "left": len(d["left"]), "changed": len(d["changed"])} for h, d in diffs.items()},
		"files_uploaded": uploaded,
		"requests": fetcher.requests_made,
		"duration_s": round(time.monotonic() - started, 1),
		"finished_at": datetime.now().isoformat(timespec="seconds"),
	}
	log.info("SUMMARY %s", json.dumps(summary, ensure_ascii=False))
	for house, d in diffs.items():
		for line in describe_diff(house, d):
			log.info("%s", line)
	if not args.dry_run:
		state.save_last_run(summary)
		notifier.send(slack_summary(summary, diffs, result, fresh_pending))
	failed = {h: why for h, why in skipped.items() if why.startswith("scrape failed")}
	if failed:  # a too-short list is only a warning; a fetch error is worth the wrapper's retry
		raise RuntimeError("; ".join(f"{h}: {why}" for h, why in failed.items()))
	return summary


def sanity_problem(cfg: Config, house: str, rows: List[dict]) -> Optional[str]:
	if len(rows) < cfg.min_members[house]:
		return f"only {len(rows)} members listed (< {cfg.min_members[house]}; dissolved, or the page changed?)"
	empty = [r["name"] for r in rows if not (r["name"] and r["yomikata"] and r["kaiha"] and r["district"])]
	if empty:
		return f"{len(empty)} rows with empty fields, e.g. {empty[0]!r} (page layout changed?)"
	return None


def describe_diff(house: str, d: dict) -> List[str]:
	h = HOUSE_JA[house]
	lines = [f"＋{h} {r['name']} ({r['kaiha']}, {r['district']})" for r in d["joined"]]
	lines += [f"－{h} {r['name']} ({r['kaiha']}, {r['district']})" for r in d["left"]]
	for name, fields in d["changed"]:
		parts = [f"{f} {a} → {b}" for f, (a, b) in fields.items()]
		lines.append(f"～{h} {name}: " + ", ".join(parts))
	return lines


def slack_summary(summary: dict, diffs: Dict[str, dict], result: MatchResult, fresh_pending: List[dict]) -> str:
	counts = ", ".join(f"{HOUSE_JA[h]} {n}" for h, n in summary["houses"].items())
	head = f"🏛️ Member list update: {counts} members"
	head += f"; {len(summary['snapshots_written'])} snapshot(s) written, {summary['files_uploaded']} file(s) uploaded" if summary["snapshots_written"] else "; no changes"
	lines = [head]
	for house, why in summary["skipped"].items():
		lines.append(f"⚠️ {HOUSE_JA[house]} skipped: {why}")
	changes = [l for h, d in diffs.items() for l in describe_diff(h, d)]
	lines += changes[:MAX_LISTED]
	if len(changes) > MAX_LISTED:
		lines.append(f"…and {len(changes) - MAX_LISTED} more (see the log)")
	if result.by_reading:
		lines.append("Matched by reading only (check these): " + ", ".join(summary["matched_by_reading"][:MAX_LISTED]))
	if result.unresolved:
		names = [f"{HOUSE_JA[u.house]} {u.row['name']} ({u.reason})" for u in result.unresolved]
		lines.append(
			f"🔎 {len(names)} member(s) without a person_id ({len(fresh_pending)} new): " + ", ".join(names[:MAX_LISTED])
			+ f"\nAdd them: `cd data && {PY} pending`, fill in the templates, then `{PY} add FILE` and `{PY} all`"
		)
	return "\n".join(lines)


def run_upload(cfg: Config, state: State, args) -> int:
	from speech_update.upload import Uploader
	paths = state.pending_paths()
	if args.dry_run or not paths:
		if paths:
			log.info("would upload %d file(s): %s", len(paths), sorted(paths))
		return 0
	missing = sorted(p for p in paths if not (cfg.mirror_root / p).exists())
	if missing:
		log.warning("dropping %d pending path(s) that no longer exist, e.g. %s", len(missing), missing[0])
		state.clear_pending_paths(missing)
		paths -= set(missing)
	log.info("uploading %d file(s) to s3://%s/%s/ (profile %s)", len(paths), cfg.bucket, cfg.s3_prefix, cfg.aws_profile)
	n = Uploader(cfg.mirror_root, cfg.bucket, cfg.s3_prefix, cfg.aws_profile).upload(paths, on_done=state.clear_pending_paths)
	log.info("upload done: %d file(s)", n)
	return n


def run_pending(cfg: Config) -> None:
	pending = load_pending(cfg)
	if not pending:
		print("No members waiting for a person_id.")
		return
	for e, path in zip(pending, write_templates(cfg, pending)):
		cands = f" candidates {e['candidates']}" if e["candidates"] else ""
		print(f"{HOUSE_JA[e['house']]} {e['name']} ({e['yomikata']}) {e['kaiha']} {e['district']} [{e['reason']}{cands}]")
		print(f"    template: {path}")
	print(
		"\nFor each: fill in election_data from a reliable source (総務省, the house's profile page, Wikipedia's\n"
		f"results table), then `{PY} add <template>`. If the member already exists under another name, use\n"
		f"`{PY} link <house> <name> <person_id>` instead. Finish with `{PY} all`."
	)


def run_add(cfg: Config, state: State, args) -> int:
	from .people import InvalidPerson, add_person, find_existing, load_person_file
	try:
		raw = load_person_file(Path(args.file))
	except InvalidPerson as e:
		print(f"Not added: {e}", file=sys.stderr)
		return 2
	conn = connect_postgres()
	try:
		with conn.cursor() as cur:
			existing = find_existing(cur, raw)
		if existing and not args.force:
			print("Not added: these people already have that name or reading:", file=sys.stderr)
			for pid, kanji, kana in existing:
				print(f"  #{pid} {kanji} ({kana})", file=sys.stderr)
			print(f"If one of them is this member, `{PY} link`; if not, rerun with --force.", file=sys.stderr)
			return 2
		print(f"{raw['name_kanji']} ({raw['name_kana']}): {len(raw['election_data'])} election(s)")
		for e in raw["election_data"]:
			print(f"  {e['year']}{e['month']}{e['day']} {e['election_name']} {e['district']} {e['party']} {e['result']}")
		person_id, paths = add_person(
			conn, raw, cfg.history_dir, cfg.table_csv, cfg.state_dir / "backups", dry_run=args.dry_run,
		)
	finally:
		conn.close()
	if args.dry_run:
		print("(dry run: nothing written)")
		return 0
	state.add_pending_paths(paths)
	print(f"Added person {person_id}; wrote {', '.join(paths)}")
	print(
		f"Next: `{PY} all` (fills in their person_id and uploads), then file their speeches with\n"
		"`../.venv-speech-update/bin/python -m speech_update route --retry-unmatched && "
		"../.venv-speech-update/bin/python -m speech_update upload`."
	)
	return 0


def run_link(cfg: Config, args) -> int:
	if args.house not in HOUSES:
		print(f"house must be one of {HOUSES}", file=sys.stderr)
		return 2
	links = load_links(cfg)
	key = link_key(args.house, args.name)
	if args.person_id.lower() == "none":
		links.pop(key, None)
		print(f"removed link for {key}")
	else:
		pid = int(args.person_id)
		conn = connect_postgres()
		try:
			with conn.cursor() as cur:
				cur.execute("SELECT name_kanji, name_kana FROM person WHERE person_id = %s", (pid,))
				row = cur.fetchone()
		finally:
			conn.close()
		if not row:
			print(f"person {pid} doesn't exist", file=sys.stderr)
			return 2
		links[key] = pid
		print(f"linked {key} → #{pid} {row[0]} ({row[1]}); takes effect on the next `all`")
	write_atomic(links_path(cfg), json.dumps(links, ensure_ascii=False, indent=2, sort_keys=True) + "\n")
	return 0


def run_alias(args) -> int:
	conn = connect_postgres()
	try:
		with conn, conn.cursor() as cur:
			if args.action == "list":
				for aid, pid, own, kanji, kana, kind, source, note in aliases.listing(cur, [int(x) for x in args.args]):
					print(f"[{aid}] #{pid} {own}: {kanji} ({kana or '-'}) {kind}{f'  {source}' if source else ''}{f'  {note}' if note else ''}")
			elif args.action == "add":
				if len(args.args) != 2:
					print("usage: alias add PERSON_ID NAME [--kana K] [--kind K] [--note T]", file=sys.stderr)
					return 2
				pid, name = int(args.args[0]), args.args[1]
				cur.execute("SELECT name_kanji FROM person WHERE person_id = %s", (pid,))
				row = cur.fetchone()
				if not row:
					print(f"person {pid} doesn't exist", file=sys.stderr)
					return 2
				added = aliases.add(cur, pid, name, args.kana, args.kind, "manual", args.note)
				print(f"#{pid} {row[0]}: {name} ({args.kana or '-'}) {'added' if added else 'already there'}")
				print(f"Move speeches already filed: ../.venv-speech-update/bin/python -m speech_update.review refile {name}")
			elif args.action == "remove":
				print("removed" if aliases.remove(cur, int(args.args[0])) else "no such alias")
	finally:
		conn.close()
	return 0


def run_merge(cfg: Config, state: State, args) -> int:
	from speech_update.config import load_config as speech_config
	from .merge import merge
	speech_state = State(speech_config().state_dir)  # the speech files are the speech updater's
	speech_state.acquire_lock()
	conn = connect_postgres()
	try:
		res = merge(cfg, conn, args.drop, args.keep, args.alias_kind)
	finally:
		conn.close()
		speech_state.release_lock()
	state.add_pending_paths(res.changed)
	print(
		f"#{args.drop} merged into #{args.keep}: {res.elections_moved} election(s) moved, {res.elections_dropped} duplicate(s) dropped, "
		f"{res.speeches_moved} speech row(s) moved, speech file lines added {res.lines_added or 'none'}"
	)
	print(f"backup: {res.backup_dir}")
	print(f"{len(set(res.changed))} file(s) queued: `{PY} upload`")
	if res.s3_delete:
		print(f"{len(res.s3_delete)} S3 object(s) to delete with admin credentials: {res.backup_dir / 's3_delete.txt'}")
	return 0


def main(argv: Optional[List[str]] = None) -> int:
	parser = argparse.ArgumentParser(prog="member_update", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	sub = parser.add_subparsers(dest="command", required=True)
	p_all = sub.add_parser("all")
	p_all.add_argument("--house", choices=HOUSES)
	p_all.add_argument("--dry-run", action="store_true")
	p_all.add_argument("--notify", action="store_true", help="send the Slack summary (the scheduler sets this)")
	sub.add_parser("pending")
	p_add = sub.add_parser("add")
	p_add.add_argument("file")
	p_add.add_argument("--dry-run", action="store_true")
	p_add.add_argument("--force", action="store_true", help="add even if someone has the same name or reading")
	p_link = sub.add_parser("link")
	p_link.add_argument("house")
	p_link.add_argument("name")
	p_link.add_argument("person_id")
	p_alias = sub.add_parser("alias")
	p_alias.add_argument("action", choices=("list", "add", "remove"))
	p_alias.add_argument("args", nargs="*")
	p_alias.add_argument("--kana")
	p_alias.add_argument("--kind", default="other", choices=aliases.KINDS)
	p_alias.add_argument("--note")
	p_merge = sub.add_parser("merge")
	p_merge.add_argument("drop", type=int)
	p_merge.add_argument("keep", type=int)
	p_merge.add_argument("--alias-kind", default="other", choices=aliases.KINDS, help="kind of alias DROP's name becomes")
	p_up = sub.add_parser("upload")
	p_up.set_defaults(dry_run=False)
	args = parser.parse_args(argv)

	cfg = load_config()
	load_dotenv(cfg.env_file)
	state = State(cfg.state_dir)
	if args.command == "pending":
		run_pending(cfg)
		return 0
	if args.command == "link":
		return run_link(cfg, args)
	if args.command == "alias":
		return run_alias(args)

	log_path = setup_logging(state)
	notify = getattr(args, "notify", False)
	notifier = from_env(enabled=notify, title="Kokkai member update")
	notify_failure = notify and os.environ.get("MEMBER_UPDATE_NOTIFY_FAILURE", "1") == "1"
	try:
		state.acquire_lock()
	except LockHeld as e:
		log.error("%s", e)
		return 75  # EX_TEMPFAIL
	try:
		if not cfg.members_dir.is_dir():
			raise RuntimeError(f"mirror not found: {cfg.members_dir}")
		if args.command == "all":
			run_all(cfg, state, args, notifier)
		elif args.command == "add":
			return run_add(cfg, state, args)
		elif args.command == "merge":
			return run_merge(cfg, state, args)
		elif args.command == "upload":
			run_upload(cfg, state, args)
		return 0
	except Exception as e:
		log.exception("member update failed")
		if notify_failure:
			notifier.send(f"❌ Member list update failed: {type(e).__name__}: {e}\nLog: `{log_path}`")
		return 1
	finally:
		state.release_lock()


if __name__ == "__main__":
	sys.exit(main())
