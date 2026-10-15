"""CLI: python -m speech_update [fetch|route|upload|all] (run from data/).

  all                      fetch → route → upload (what the scheduler runs)
  fetch  [--from D] [--until D]
  route                    route issues left by fetch (changed_issues.json)
  route --retry-unmatched  re-resolve issues with unmatched member speakers
  route --db-only --all-issues   rebuild Postgres `speeches` from every issue (§4.10)
  upload                   upload changed_paths.txt

Unsure speaker matches are held for review: python -m speech_update.review
(specs/speaker-review). `all` applies decided reviews before uploading.

--dry-run fetches and computes diffs but writes nothing to the mirror, S3 or Postgres.
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

from .config import Config, load_config
from .fetch import FetchResult, default_window, fetch, issue_paths
from .ndl_client import NdlClient
from .notify import Notifier, from_env
from .state import LockHeld, State

log = logging.getLogger("speech_update")


class StageError(RuntimeError):
	def __init__(self, stage: str, cause: BaseException):
		super().__init__(f"{type(cause).__name__}: {cause}")
		self.stage = stage


# --- setup helpers ---

def setup_logging(state: State) -> Path:
	log_path = state.logs_dir / f"update-{datetime.now():%Y%m%d-%H%M%S}.log"
	fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
	root = logging.getLogger()
	root.setLevel(logging.INFO)
	for handler in (logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stderr)):
		handler.setFormatter(fmt)
		root.addHandler(handler)
	logging.getLogger("botocore").setLevel(logging.WARNING)
	logging.getLogger("urllib3").setLevel(logging.WARNING)
	return log_path


def check_mirror(cfg: Config) -> None:
	"""Refuse to run against a half-synced mirror or during a bulk sync."""
	if not cfg.issues_dir.is_dir():
		raise RuntimeError(f"mirror not found: {cfg.issues_dir}")
	with os.scandir(cfg.issues_dir) as it:
		count = sum(1 for _ in it)
	if count < cfg.min_issue_count:
		raise RuntimeError(f"mirror looks incomplete: {count} issues < {cfg.min_issue_count}")
	ps = subprocess.run(["pgrep", "-fl", "aws s3 sync"], capture_output=True, text=True)
	if "kokkai-doc" in ps.stdout:
		raise RuntimeError("a bulk `aws s3 sync … kokkai-doc` is running; try again after it finishes")


def connect_postgres():
	"""Connect to the local kokkaidoc DB, or return None if it's down."""
	import psycopg2
	try:
		return psycopg2.connect(
			dbname="kokkaidoc", user="postgres", password=os.getenv("PSQL_DATABASE_PASSWORD"),
			host="localhost", port="5432", connect_timeout=5,
		)
	except psycopg2.OperationalError as e:
		log.warning("Postgres unavailable: %s", str(e).strip())
		return None


def make_router(cfg: Config, conn, dry_run: bool, write_files: bool = True, db_speeches: bool = False, db_table: str = "speeches"):
	from utils.speech_topics import load_topics
	from .resolver import SpeakerResolver
	from .route import Router
	return Router(
		SpeakerResolver(conn.cursor()), cfg.persons_dir, load_topics(str(cfg.topics_file)),
		dry_run=dry_run, write_files=write_files,
		db_conn=conn if db_speeches else None, db_table=db_table,
	)


# --- stages ---

def run_fetch(cfg: Config, state: State, args) -> FetchResult:
	date_from, date_until = default_window(state.last_run(), cfg.issues_dir, date.today(), cfg.lookback_days)
	if args.date_from:
		date_from = date.fromisoformat(args.date_from)
	if args.date_until:
		date_until = date.fromisoformat(args.date_until)
	log.info("fetch window %s → %s%s", date_from, date_until, " (dry run)" if args.dry_run else "")
	client = NdlClient(min_interval=cfg.min_request_interval)
	result = fetch(client, cfg.issues_dir, date_from, date_until, dry_run=args.dry_run)
	if not args.dry_run and result.written:
		state.add_pending_issues(result.written)
		state.add_pending_paths(p for i in result.written for p in issue_paths(i))
	log.info(
		"fetch done: %d meetings checked, %d new, %d changed, %d NDL requests",
		result.checked, len(result.new), len(result.changed), client.requests_made,
	)
	return result


def run_route(cfg: Config, state: State, args, dry_meetings: Optional[list] = None, conn=None):
	"""Route pending issues (or `dry_meetings` on a dry run). Returns RouteResult or None if postponed."""
	from .route import iter_issues_from_disk
	own_conn = conn is None
	conn = conn or connect_postgres()
	if conn is None:
		return None
	try:
		db_speeches = (args.db_speeches if args.db_speeches is not None else cfg.db_speeches) and not args.dry_run
		if getattr(args, "db_only", False):
			if not getattr(args, "all_issues", False):
				raise SystemExit("--db-only needs --all-issues")
			issue_ids = sorted(os.listdir(cfg.issues_dir))
			if not re.fullmatch(r"[a-z_][a-z0-9_]*", args.db_table):
				raise SystemExit(f"bad --db-table: {args.db_table!r}")
			log.info("writing %d issues into Postgres table %s (spec §4.10)", len(issue_ids), args.db_table)
			if not args.dry_run:
				with conn.cursor() as cur:
					cur.execute(f"CREATE TABLE IF NOT EXISTS {args.db_table} (LIKE speeches INCLUDING ALL)")
					cur.execute(
						"SELECT 1 FROM pg_constraint WHERE conrelid = %s::regclass AND contype = 'f'", (args.db_table,))
					if not cur.fetchone():
						cur.execute(f"ALTER TABLE {args.db_table} ADD FOREIGN KEY (person_id) REFERENCES person(person_id)")
				conn.commit()
			router = make_router(cfg, conn, args.dry_run, write_files=False, db_speeches=not args.dry_run, db_table=args.db_table)
			result = router.route(iter_issues_from_disk(cfg.issues_dir, issue_ids))
			log.info("%d speech(es) held for review in %d pair(s)", result.held_speeches, len(result.held))
			if not args.dry_run:
				record_review(conn, result)
			return result

		router = make_router(cfg, conn, args.dry_run, db_speeches=db_speeches)
		if getattr(args, "retry_unmatched", False):
			issue_ids = sorted({e["issueID"] for e in state.unmatched()})
			log.info("retrying %d issue(s) with unmatched speakers", len(issue_ids))
		elif dry_meetings is not None:
			issue_ids = None
		else:
			issue_ids = state.pending_issues()
			log.info("routing %d pending issue(s)", len(issue_ids))

		meetings = (
			((m.meta_dict(), m.speech_dicts()) for m in dry_meetings)
			if issue_ids is None else iter_issues_from_disk(cfg.issues_dir, issue_ids)
		)
		result = router.route(meetings)
		log.info(
			"route done: %d speeches, %d matched (%d by election history), %d non-member skipped, "
			"%d unmatched member speaker(s); %d held for review in %d pair(s); "
			"all_speeches +%d added / %d updated across %d person(s); %d DB rows",
			result.speeches, result.matched, result.disambiguated, result.non_member_skipped,
			len({u["speaker"] for u in result.unmatched_members}), result.held_speeches, len(result.held),
			result.added, result.updated, len(result.persons), result.db_rows if db_speeches else 0,
		)
		for name, yomi, group, reason in sorted({(u["speaker"], u["speakerYomi"], u["speakerGroup"], u["reason"]) for u in result.unmatched_members}):
			n = sum(1 for u in result.unmatched_members if u["speaker"] == name)
			log.warning("unmatched member speaker: %s (%s) %s [%s] in %d issue(s)", name, yomi, group, reason, n)
		if not args.dry_run:
			replacing = issue_ids if getattr(args, "retry_unmatched", False) else result.routed_issues
			result.new_unmatched = state.record_unmatched(result.unmatched_members, replacing_issues=replacing)
			record_review(conn, result)
			state.add_pending_paths(result.paths_written)
			if not getattr(args, "retry_unmatched", False):
				state.clear_pending_issues(result.routed_issues)
		else:
			result.new_unmatched = result.unmatched_members
		return result
	finally:
		if own_conn:
			conn.close()


def record_review(conn, result) -> None:
	from . import review_store
	result.new_review = review_store.record_held(conn, result.held, result.routed_issues)
	for key in result.new_review:
		log.warning("new speaker match to review: %s (%s) → #%d [%s]", *key)


def run_apply(cfg: Config, state: State, args):
	"""Apply decided speaker reviews (specs/speaker-review). None if Postgres is down or nothing to do."""
	from .review import apply_decisions
	conn = connect_postgres()
	if conn is None:
		return None
	try:
		db_speeches = args.db_speeches if args.db_speeches is not None else cfg.db_speeches
		return apply_decisions(cfg, state, conn, dry_run=args.dry_run, db_speeches=db_speeches)
	finally:
		conn.close()


def review_pending() -> int:
	from . import review_store
	conn = connect_postgres()
	if conn is None:
		return 0
	try:
		return review_store.pending_count(conn.cursor())
	finally:
		conn.close()


def run_upload(cfg: Config, state: State, args, dry_paths: Optional[List[str]] = None) -> int:
	from .upload import Uploader, upload_order
	if args.dry_run:
		paths = dry_paths or []
		issues, others = upload_order(paths)
		log.info("dry run: would upload %d issue file(s) and %d other file(s) to s3://%s/%s/", len(issues), len(others), cfg.bucket, cfg.s3_prefix)
		return 0
	paths = state.pending_paths()
	if not paths:
		log.info("nothing to upload")
		return 0
	missing = sorted(p for p in paths if not (cfg.mirror_root / p).exists())
	if missing:
		log.warning("%d pending path(s) no longer exist locally; dropping them, e.g. %s", len(missing), missing[0])
		state.clear_pending_paths(missing)
		paths -= set(missing)
	log.info("uploading %d file(s) to s3://%s/%s/ (profile %s)", len(paths), cfg.bucket, cfg.s3_prefix, cfg.aws_profile)
	n = Uploader(cfg.mirror_root, cfg.bucket, cfg.s3_prefix, cfg.aws_profile).upload(paths, on_done=state.clear_pending_paths)
	log.info("upload done: %d file(s)", n)
	return n


def run_all(cfg: Config, state: State, args, notifier: Notifier) -> dict:
	started = time.monotonic()
	try:
		fetched = run_fetch(cfg, state, args)
	except Exception as e:
		raise StageError("fetch", e) from e

	dry_paths: List[str] = [p for i in fetched.written for p in issue_paths(i)]
	try:
		routed = run_route(cfg, state, args, dry_meetings=list(fetched.meetings.values()) if args.dry_run else None)
	except Exception as e:
		raise StageError("route", e) from e
	if routed is None:
		log.warning("route postponed (Postgres down); %d issue(s) stay queued", len(state.pending_issues()))
	else:
		dry_paths = sorted(set(dry_paths) | set(routed.paths_written))
		if routed.new_unmatched and not args.dry_run:
			notifier.unmatched(routed.new_unmatched)
	applied = None
	if routed is not None:
		try:
			applied = run_apply(cfg, state, args)
		except Exception as e:
			raise StageError("review apply", e) from e
		if applied:
			dry_paths = sorted(set(dry_paths) | set(applied.paths_written))
	new_review = (routed.new_review if routed else []) + (applied.new_review if applied else [])
	pending = review_pending() if not args.dry_run else 0
	if new_review and not args.dry_run:
		notifier.review_needed(new_review, pending)

	try:
		uploaded = run_upload(cfg, state, args, dry_paths=dry_paths)
	except Exception as e:
		raise StageError("upload", e) from e

	summary = {
		"window_from": fetched.date_from.isoformat(),
		"window_until": fetched.date_until.isoformat(),
		"until": fetched.date_until.isoformat(),
		"meetings_checked": fetched.checked,
		"meetings_new": len(fetched.new),
		"meetings_changed": len(fetched.changed),
		"speeches_added": routed.added if routed else 0,
		"speeches_updated": routed.updated if routed else 0,
		"persons_touched": len(routed.persons) if routed else 0,
		"unmatched_member_speakers": len({u["speaker"] for u in routed.unmatched_members}) if routed else 0,
		"speeches_held_for_review": routed.held_speeches if routed else 0,
		"review_new": len(new_review),
		"review_pending": pending,
		"review_decisions_applied": applied.decisions if applied else 0,
		"route_postponed": routed is None,
		"files_uploaded": uploaded,
		"files_to_upload": len(dry_paths) if args.dry_run else uploaded,
		"duration_s": round(time.monotonic() - started, 1),
		"finished_at": datetime.now().isoformat(timespec="seconds"),
	}
	log.info("SUMMARY %s", " ".join(f"{k}={v}" for k, v in summary.items()))
	if not args.dry_run:
		state.save_last_run(summary)
		notifier.success(summary)
	return summary


def main(argv: Optional[List[str]] = None) -> int:
	parser = argparse.ArgumentParser(prog="speech_update", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	parser.add_argument("command", choices=["fetch", "route", "upload", "all"])
	parser.add_argument("--from", dest="date_from", help="window start (YYYY-MM-DD); default last run − lookback")
	parser.add_argument("--until", dest="date_until", help="window end (YYYY-MM-DD); default today")
	parser.add_argument("--dry-run", action="store_true")
	parser.add_argument("--retry-unmatched", action="store_true", help="route: re-resolve issues with unmatched speakers")
	parser.add_argument("--db-only", action="store_true", help="route: only write Postgres speeches (with --all-issues)")
	parser.add_argument("--all-issues", action="store_true", help="route --db-only: every issue in the mirror")
	parser.add_argument("--db-table", default="speeches", help="route --db-only: target table (created LIKE speeches if missing)")
	parser.add_argument("--db-speeches", dest="db_speeches", action="store_true", default=None, help="upsert into Postgres speeches")
	parser.add_argument("--no-db-speeches", dest="db_speeches", action="store_false")
	parser.add_argument("--notify", action="store_true", help="send Slack notifications (the scheduler sets this)")
	args = parser.parse_args(argv)

	cfg = load_config()
	load_dotenv(cfg.env_file)
	state = State(cfg.state_dir)
	log_path = setup_logging(state)
	notifier = from_env(enabled=args.notify)
	notify_failure = args.notify and os.environ.get("SPEECH_UPDATE_NOTIFY_FAILURE", "1") == "1"

	try:
		state.acquire_lock()
	except LockHeld as e:
		log.error("%s", e)
		return 75  # EX_TEMPFAIL
	try:
		check_mirror(cfg)
		if args.command == "all":
			run_all(cfg, state, args, notifier)
		elif args.command == "fetch":
			run_fetch(cfg, state, args)
		elif args.command == "route":
			if run_route(cfg, state, args) is None:
				raise RuntimeError("Postgres is not reachable")
		elif args.command == "upload":
			run_upload(cfg, state, args)
		return 0
	except StageError as e:
		log.exception("stage %s failed", e.stage)
		if notify_failure:
			notifier.failure(e.stage, str(e), str(log_path))
		return 1
	except Exception as e:
		log.exception("speech update failed")
		if notify_failure:
			notifier.failure(args.command, f"{type(e).__name__}: {e}", str(log_path))
		return 1
	finally:
		state.release_lock()


if __name__ == "__main__":
	sys.exit(main())
