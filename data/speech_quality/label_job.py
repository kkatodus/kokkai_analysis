"""Label exchanges with Gemini batches under a monthly cap (specs/speech-quality-labels §4.5–4.8).

From data/:
  python -m speech_quality.label_job status
  python -m speech_quality.label_job run [--max-batches N] [--batch-size N] [--dry-run]
  python -m speech_quality.label_job write ISSUE_ID...     # rewrite labels onto speech lines

`run` is also the `label` stage of `python -m speech_update all`:
  1. collect finished batches into label_result and write them onto the speech lines;
  2. submit new meetings' exchanges (the meetings this run routed);
  3. submit backlog batches, newest first, while the month's spend stays under the cap
     (a reserve is kept for new meetings);
  4. announce 50/80/100% of the cap once each per month.

Settings (data/.env or environment): GEMINI_API_KEY, SPEECH_LABEL_ENABLED (1),
SPEECH_LABEL_MODEL (gemini-3.8-flash), SPEECH_LABEL_MONTHLY_CAP_USD (100),
SPEECH_LABEL_RESERVE_USD (5), SPEECH_LABEL_BATCH_SIZE (1000),
SPEECH_LABEL_MAX_BACKLOG_BATCHES (2, in flight at once).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterable, Iterator, List, Optional, Set

from psycopg2.extras import Json

from . import ledger
from .gemini_batch import DONE_STATES, GeminiBatch
from .labels import (OUTPUT_TOKENS_EST, PROMPT_VERSION, Unit, batch_line, due, issues_newest_first, parse_response,
	units_for_issue, usage, write_issues)

log = logging.getLogger("speech_quality.label")
THRESHOLDS = (50, 80, 100)


@dataclass
class Settings:
	model: str = "gemini-3.8-flash"
	cap: float = 100.0
	reserve: float = 5.0
	batch_size: int = 1000
	max_backlog_batches: int = 2
	enabled: bool = True

	@classmethod
	def from_env(cls) -> "Settings":
		env = os.environ.get
		return cls(
			model=env("SPEECH_LABEL_MODEL", "gemini-3.8-flash"),
			cap=float(env("SPEECH_LABEL_MONTHLY_CAP_USD", "100")),
			reserve=float(env("SPEECH_LABEL_RESERVE_USD", "5")),
			batch_size=int(env("SPEECH_LABEL_BATCH_SIZE", "1000")),
			max_backlog_batches=int(env("SPEECH_LABEL_MAX_BACKLOG_BATCHES", "2")),
			enabled=env("SPEECH_LABEL_ENABLED", "1") == "1",
		)


@dataclass
class LabelSummary:
	collected_batches: int = 0
	labelled: int = 0
	collected_cost: float = 0.0
	failed_batches: List[str] = field(default_factory=list)
	submitted: List[tuple] = field(default_factory=list)  # (kind, exchanges, cost_est)
	month_spend: float = 0.0
	cap: float = 0.0
	in_flight: int = 0
	total_labelled: int = 0
	oldest_date: Optional[str] = None
	alerts: List[str] = field(default_factory=list)
	paused: bool = False
	paths: List[str] = field(default_factory=list)

	def slack_line(self) -> str:
		month = date.today().strftime("%B")
		pct = 100 * self.month_spend / self.cap if self.cap else 0
		parts = [f"🏷️ Labels: +{self.labelled} exchanges (${self.collected_cost:.2f})"]
		sub = sum(n for _, n, _ in self.submitted)
		if sub:
			parts.append(f"{sub} submitted (~${sum(c for _, _, c in self.submitted):.2f})")
		parts.append(f"{month}: ${self.month_spend:.2f} of ${self.cap:.0f} ({pct:.0f}%)")
		if self.oldest_date:
			parts.append(f"labelled back to {self.oldest_date[:7]} ({self.total_labelled:,} exchanges)")
		if self.failed_batches:
			parts.append(f"⚠️ {len(self.failed_batches)} batch(es) failed, will retry")
		return " · ".join(parts)


# --- collect ---

def _store(cur, batch_id: int, model: str, unit: Unit, req_hash: str, labels: dict, tokens: tuple) -> None:
	ex = unit.exchange
	pids = ledger.person_ids(cur, ex.speech_ids)
	answerers = sorted({pids[t.speech_id] for t in ex.turns if t.kind == "answerer" and t.speech_id in pids})
	cur.execute(
		"""INSERT INTO label_result (start_speech_id, issue_id, exchange_index, speech_ids, date, questioner,
			questioner_person_id, answerer_person_ids, batch_id, model, prompt_version, content_hash,
			function, contribution, issues, responsible, outcomes, topic, reason, input_tokens, output_tokens, labelled_at)
		VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
		ON CONFLICT (start_speech_id) DO UPDATE SET
			issue_id = EXCLUDED.issue_id, exchange_index = EXCLUDED.exchange_index, speech_ids = EXCLUDED.speech_ids,
			date = EXCLUDED.date, questioner = EXCLUDED.questioner, questioner_person_id = EXCLUDED.questioner_person_id,
			answerer_person_ids = EXCLUDED.answerer_person_ids, batch_id = EXCLUDED.batch_id, model = EXCLUDED.model,
			prompt_version = EXCLUDED.prompt_version, content_hash = EXCLUDED.content_hash, function = EXCLUDED.function,
			contribution = EXCLUDED.contribution, issues = EXCLUDED.issues, responsible = EXCLUDED.responsible,
			outcomes = EXCLUDED.outcomes, topic = EXCLUDED.topic, reason = EXCLUDED.reason,
			input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens, labelled_at = now()""",
		(unit.key, unit.issue_id, ex.index, ex.speech_ids, unit.date, ex.questioner, pids.get(unit.key), answerers,
			batch_id, model, PROMPT_VERSION, req_hash, labels["function"], labels["contribution"],
			Json(labels.get("issues") or []), labels["responsible"], list(labels.get("outcomes") or []), labels["topic"],
			labels["reason"], tokens[0], tokens[1]),
	)


def collect(conn, gb: GeminiBatch, issues_dir: Path, summary: LabelSummary) -> Set[str]:
	"""Fold finished batches into label_result. Returns the issue ids that got labels."""
	touched: Set[str] = set()
	with conn.cursor() as cur:
		cur.execute("SELECT id, name, model FROM label_batch WHERE status = 'submitted' ORDER BY id")
		batches = cur.fetchall()
	for batch_id, name, model in batches:
		job = gb.get(name)
		state = gb.state(job)
		if state not in DONE_STATES:
			log.info("batch %s (%s): %s", batch_id, name, state)
			continue
		with conn, conn.cursor() as cur:
			if not state.endswith("SUCCEEDED"):
				err = json.dumps(job.get("error") or job.get("metadata", {}).get("error") or state, ensure_ascii=False)[:2000]
				cur.execute("UPDATE label_batch SET status = 'failed', finished_at = now(), error = %s WHERE id = %s", (err, batch_id))
				summary.failed_batches.append(name)
				log.warning("batch %s (%s) ended %s: %s", batch_id, name, state, err)
				continue
			out_file = gb.result_file(job)
			if not out_file:
				raise RuntimeError(f"batch {name} succeeded but has no responses file: {json.dumps(job)[:500]}")
			cur.execute("SELECT start_speech_id, issue_id, content_hash FROM label_request WHERE batch_id = %s", (batch_id,))
			reqs = {k: (i, h) for k, i, h in cur.fetchall()}
			units = {}
			for issue_id in {i for i, _ in reqs.values()}:
				for u in units_for_issue(issues_dir, issue_id):
					units[u.key] = u
			tin = tout = labelled = bad = 0
			for line in gb.download(out_file):
				key = line.get("key")
				resp = line.get("response") or {}
				t = usage(resp)
				tin, tout = tin + t[0], tout + t[1]
				labels = parse_response(resp)
				if key not in reqs or key not in units or labels is None:
					bad += 1
					continue
				_store(cur, batch_id, model, units[key], reqs[key][1], labels, t)
				touched.add(reqs[key][0])
				labelled += 1
			cost = ledger.cost(cur, model, date.today(), tin, tout)
			cur.execute(
				"""UPDATE label_batch SET status = 'succeeded', finished_at = now(), input_tokens = %s,
				output_tokens = %s, cost_usd = %s, labelled = %s, error = %s WHERE id = %s""",
				(tin, tout, cost, labelled, f"{bad} response(s) unusable" if bad else None, batch_id),
			)
		summary.collected_batches += 1
		summary.labelled += labelled
		summary.collected_cost += cost
		log.info("batch %s collected: %d labelled, %d unusable, %d/%d tokens, $%.2f", batch_id, labelled, bad, tin, tout, cost)
	return touched


# --- submit ---

def submit(conn, gb: GeminiBatch, units: List[Unit], kind: str, s: Settings, work_dir: Path) -> float:
	tin = sum(u.tokens_est() for u in units)
	tout = OUTPUT_TOKENS_EST * len(units)
	work_dir.mkdir(parents=True, exist_ok=True)
	stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
	path = work_dir / f"{stamp}-{kind}.jsonl"
	with open(path, "w", encoding="utf-8") as f:
		for u in units:
			f.write(json.dumps(batch_line(u), ensure_ascii=False) + "\n")
	with conn, conn.cursor() as cur:
		est = ledger.cost(cur, s.model, date.today(), tin, tout)
		file_name = gb.upload(path, f"kokkai-labels-{stamp}-{kind}")
		name = gb.create(s.model, file_name, f"kokkai-labels-{stamp}-{kind}")
		cur.execute(
			"""INSERT INTO label_batch (name, model, prompt_version, kind, exchanges, newest_date, oldest_date,
				input_tokens_est, cost_est) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
			(name, s.model, PROMPT_VERSION, kind, len(units), max(u.date for u in units), min(u.date for u in units), tin, est),
		)
		batch_id = cur.fetchone()[0]
		cur.executemany(
			"INSERT INTO label_request (batch_id, start_speech_id, issue_id, content_hash) VALUES (%s, %s, %s, %s)",
			[(batch_id, u.key, u.issue_id, u.content_hash) for u in units],
		)
	path.unlink()  # the request is rebuilt from the mirror if it has to be resent
	log.info("submitted %s batch %s (%s): %d exchanges %s → %s, ~%d input tokens, ~$%.2f",
		kind, batch_id, name, len(units), units[-1].date, units[0].date, tin, est)
	return est


def take(units: Iterator[Unit], size: int, budget: float, cur, model: str) -> List[Unit]:
	"""Up to `size` units whose estimated cost stays within `budget`."""
	out: List[Unit] = []
	tin = 0
	pin, pout = ledger.price(cur, model, date.today())
	for u in units:
		t = u.tokens_est()
		if (tin + t) * pin / 1e6 + (len(out) + 1) * OUTPUT_TOKENS_EST * pout / 1e6 > budget:
			break
		out.append(u)
		tin += t
		if len(out) >= size:
			break
	return out


def backlog_units(issues_dir: Path, done: dict, pending: set) -> Iterator[Unit]:
	for issue_id in issues_newest_first(issues_dir):
		yield from due(units_for_issue(issues_dir, issue_id), done, pending)


# --- the stage ---

def run(conn, issues_dir: Path, work_dir: Path, new_issues: Iterable[str] = (), settings: Optional[Settings] = None,
		max_batches: Optional[int] = None, dry_run: bool = False) -> LabelSummary:
	s = settings or Settings.from_env()
	summary = LabelSummary(cap=s.cap)
	with conn, conn.cursor() as cur:
		ledger.ensure(cur)
	gb = GeminiBatch()
	touched = set() if dry_run else collect(conn, gb, issues_dir, summary)
	new_issues = set(new_issues)
	with conn.cursor() as cur:
		summary.paths = [] if dry_run else write_issues(cur, issues_dir, touched | new_issues)
	conn.commit()

	if s.enabled:
		with conn.cursor() as cur:
			done, pending = ledger.done_and_pending(cur, PROMPT_VERSION)
			spend = ledger.month_spend(cur)
			# new meetings: within the full cap
			fresh = [u for i in sorted(new_issues, reverse=True) for u in due(units_for_issue(issues_dir, i), done, pending)]
			fresh.sort(key=lambda u: (u.date, u.key), reverse=True)
			if fresh:
				batch = take(iter(fresh), len(fresh), s.cap - spend, cur, s.model)
				if len(batch) < len(fresh):
					summary.paused = True
				if batch and not dry_run:
					est = submit(conn, gb, batch, "new", s, work_dir)
					summary.submitted.append(("new", len(batch), est))
					spend += est
					pending |= {u.key for u in batch}
				elif batch:
					summary.submitted.append(("new (dry run)", len(batch), 0.0))
			# backlog: newest first, keeping the reserve
			units = backlog_units(issues_dir, done, pending)
			flying = ledger.in_flight(cur, "backlog")
			n = 0
			while flying < s.max_backlog_batches and (max_batches is None or n < max_batches):
				budget = s.cap - s.reserve - spend
				batch = take(units, s.batch_size, budget, cur, s.model)
				if not batch:
					summary.paused = budget < s.cap * 0.05
					break
				if dry_run:
					tin = sum(u.tokens_est() for u in batch)
					est = ledger.cost(cur, s.model, date.today(), tin, OUTPUT_TOKENS_EST * len(batch))
					summary.submitted.append(("backlog (dry run)", len(batch), est))
					log.info("dry run: backlog batch of %d exchanges %s → %s, ~%d tokens, ~$%.2f",
						len(batch), batch[-1].date, batch[0].date, tin, est)
				else:
					est = submit(conn, gb, batch, "backlog", s, work_dir)
					summary.submitted.append(("backlog", len(batch), est))
				spend += est
				flying += 1
				n += 1

	with conn, conn.cursor() as cur:
		summary.month_spend = ledger.month_spend(cur)
		summary.in_flight = ledger.in_flight(cur)
		cur.execute("SELECT count(*), min(date)::text FROM label_result")
		summary.total_labelled, summary.oldest_date = cur.fetchone()
		if not dry_run:
			sent = ledger.alerts_sent(cur)
			for t in THRESHOLDS:
				if t not in sent and summary.month_spend >= s.cap * t / 100:
					msg = f"⚠️ Label spend reached ${summary.month_spend:.2f} of ${s.cap:.0f} for {date.today():%B}"
					if t == 100 or summary.paused:
						msg += f"; backlog paused until {date(date.today().year + date.today().month // 12, date.today().month % 12 + 1, 1):%B}"
					summary.alerts.append(msg)
					ledger.mark_alert(cur, t)
	return summary


def status(conn) -> str:
	with conn, conn.cursor() as cur:
		ledger.ensure(cur)
		spend = ledger.month_spend(cur)
		cur.execute("""SELECT id, kind, status, exchanges, labelled, oldest_date, newest_date, round(cost_est, 2),
			round(cost_usd, 2), submitted_at::timestamp(0), finished_at::timestamp(0) FROM label_batch ORDER BY id DESC LIMIT 15""")
		rows = cur.fetchall()
		cur.execute("SELECT count(*), min(date), max(date) FROM label_result")
		n, lo, hi = cur.fetchone()
	lines = [f"month spend ${spend:.2f} (cap ${Settings.from_env().cap:.0f}); {n:,} exchanges labelled ({lo} → {hi})", ""]
	lines += ["id kind status exchanges labelled oldest newest est actual submitted finished"]
	lines += [" ".join(str(x) for x in r) for r in rows]
	return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
	from dotenv import load_dotenv
	from speech_update.__main__ import connect_postgres
	from speech_update.config import load_config
	from speech_update.state import LockHeld, State

	p = argparse.ArgumentParser(prog="python -m speech_quality.label_job", description=__doc__,
		formatter_class=argparse.RawDescriptionHelpFormatter)
	sub = p.add_subparsers(dest="cmd", required=True)
	sub.add_parser("status")
	r = sub.add_parser("run")
	r.add_argument("--max-batches", type=int)
	r.add_argument("--batch-size", type=int)
	r.add_argument("--dry-run", action="store_true")
	w = sub.add_parser("write")
	w.add_argument("issue_ids", nargs="+")
	args = p.parse_args(argv)

	cfg = load_config()
	load_dotenv(cfg.env_file)
	logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
	conn = connect_postgres()
	if conn is None:
		print("Postgres is not reachable", file=sys.stderr)
		return 1
	if args.cmd == "status":
		print(status(conn))
		return 0
	state = State(cfg.state_dir)
	try:
		state.acquire_lock()
	except LockHeld as e:
		print(e, file=sys.stderr)
		return 75
	try:
		if args.cmd == "write":
			with conn.cursor() as cur:
				paths = write_issues(cur, cfg.issues_dir, args.issue_ids)
			state.add_pending_paths(paths)
			print(f"{len(paths)} file(s) changed; upload with `python -m speech_update upload`")
			return 0
		s = Settings.from_env()
		if args.batch_size:
			s.batch_size = args.batch_size
		s.enabled = True
		summary = run(conn, cfg.issues_dir, cfg.state_dir.parent / ".speech-quality" / "batches", settings=s,
			max_batches=args.max_batches, dry_run=args.dry_run)
		if not args.dry_run:
			state.add_pending_paths(summary.paths)
		print(summary.slack_line())
		for a in summary.alerts:
			print(a)
		if summary.paths:
			print(f"{len(summary.paths)} file(s) changed; upload with `python -m speech_update upload`")
		return 0
	finally:
		state.release_lock()
		conn.close()


if __name__ == "__main__":
	sys.exit(main())
