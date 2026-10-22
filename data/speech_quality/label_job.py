"""Label exchanges with Claude batches (Gemini as fallback) under a monthly cap
(specs/speech-quality-labels §4.5–4.8).

From data/:
  python -m speech_quality.label_job status
  python -m speech_quality.label_job run [--max-batches N] [--batch-size N] [--dry-run]
  python -m speech_quality.label_job write ISSUE_ID...     # rewrite labels onto speech lines

`run` is also the `label` stage of `python -m speech_update all`:
  1. collect finished batches into label_result and write them onto the speech lines;
  2. submit new meetings' exchanges (the meetings this run routed);
  3. submit backlog batches, newest first, while the month's spend stays under the cap
     (a reserve is kept for new meetings);
  4. announce 50/80/100% of each cap once each per month.

Each provider has its own monthly cap: SPEECH_LABEL_CLAUDE_MONTHLY_CAP_USD for Claude
(prepaid credits) and SPEECH_LABEL_MONTHLY_CAP_USD for Gemini (billed money). Batches
go to the primary model while its cap allows; once that cap is reached, or when Claude
can't take a batch (credits gone, no key, outage), batches go to Gemini within Gemini's
cap, or wait.

Settings (data/.env or environment): ANTHROPIC_API_KEY and GEMINI_API_KEY, SPEECH_LABEL_ENABLED (1),
SPEECH_LABEL_MODEL (claude-sonnet-5-5), SPEECH_LABEL_FALLBACK_MODEL (gemini-3.8-flash; empty = none),
SPEECH_LABEL_MONTHLY_CAP_USD (100, Gemini), SPEECH_LABEL_CLAUDE_MONTHLY_CAP_USD (100),
SPEECH_LABEL_RESERVE_USD (5), SPEECH_LABEL_BATCH_SIZE (1000),
SPEECH_LABEL_MAX_BACKLOG_BATCHES (10, in flight at once).

A batch goes to the fallback model when the primary provider can't take it (no key, auth or
billing error, quota, outage); the Slack line says so. Each batch is collected from the
provider named by its model, so batches in flight survive a change of default.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Set

from psycopg2.extras import Json

from . import ledger
from .batch_client import FallbackOverBudget, client_for, output_est, provider_for, submit_with_fallback
from .labels import (OUTPUT_TOKENS_EST, PROMPT_VERSION, Unit, due, issues_newest_first, parse_labels, request_for,
	units_for_issue, write_issues)

log = logging.getLogger("speech_quality.label")
THRESHOLDS = (50, 80, 100)


@dataclass
class Settings:
	model: str = "claude-sonnet-5-5"
	fallback_model: Optional[str] = "gemini-3.8-flash"
	cap: float = 100.0            # Gemini, billed money
	claude_cap: float = 100.0     # Claude, prepaid credits: set it to the balance you want used up
	reserve: float = 5.0
	batch_size: int = 1000
	max_backlog_batches: int = 10
	enabled: bool = True

	@property
	def caps(self) -> Dict[str, float]:
		return {"claude": self.claude_cap, "gemini": self.cap}

	def cap_for(self, model: str) -> float:
		return self.caps[provider_for(model)]

	def active_model(self, spend: Dict[str, float]) -> tuple:
		"""(model to submit to, fallback for it, note): the primary model while its provider has room
		for at least the reserve; otherwise the fallback model on its own cap, with no further fallback."""
		room = self.cap_for(self.model) - spend[provider_for(self.model)]
		if self.fallback_model and room < self.reserve:
			return self.fallback_model, None, (f"{self.model} cap reached (${spend[provider_for(self.model)]:.2f} of "
				f"${self.cap_for(self.model):.0f}); using {self.fallback_model}")
		return self.model, self.fallback_model, None

	@classmethod
	def from_env(cls) -> "Settings":
		env = os.environ.get
		return cls(
			model=env("SPEECH_LABEL_MODEL", "claude-sonnet-5-5"),
			fallback_model=env("SPEECH_LABEL_FALLBACK_MODEL", "gemini-3.8-flash") or None,
			cap=float(env("SPEECH_LABEL_MONTHLY_CAP_USD", "100")),
			claude_cap=float(env("SPEECH_LABEL_CLAUDE_MONTHLY_CAP_USD", "100")),
			reserve=float(env("SPEECH_LABEL_RESERVE_USD", "5")),
			batch_size=int(env("SPEECH_LABEL_BATCH_SIZE", "1000")),
			max_backlog_batches=int(env("SPEECH_LABEL_MAX_BACKLOG_BATCHES", "10")),
			enabled=env("SPEECH_LABEL_ENABLED", "1") == "1",
		)


@dataclass
class LabelSummary:
	collected_batches: int = 0
	labelled: int = 0
	collected_cost: float = 0.0
	failed_batches: List[str] = field(default_factory=list)
	submitted: List[tuple] = field(default_factory=list)  # (kind, exchanges, cost_est)
	spend: Dict[str, float] = field(default_factory=dict)  # per provider, this month
	caps: Dict[str, float] = field(default_factory=dict)
	in_flight: int = 0
	total_labelled: int = 0
	oldest_date: Optional[str] = None
	alerts: List[str] = field(default_factory=list)
	notes: List[str] = field(default_factory=list)   # e.g. a fallback to the other provider
	paused: bool = False
	paths: List[str] = field(default_factory=list)

	def slack_line(self) -> str:
		parts = [f"🏷️ Labels: +{self.labelled} exchanges (${self.collected_cost:.2f})"]
		sub = sum(n for _, n, _ in self.submitted)
		if sub:
			parts.append(f"{sub} submitted (~${sum(c for _, _, c in self.submitted):.2f})")
		parts.append(ledger.spend_line(self.spend, self.caps))
		if self.oldest_date:
			parts.append(f"labelled back to {self.oldest_date[:7]} ({self.total_labelled:,} exchanges)")
		if self.failed_batches:
			parts.append(f"⚠️ {len(self.failed_batches)} batch(es) failed, will retry")
		parts += [f"⚠️ {n}" for n in self.notes]
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


def collect(conn, issues_dir: Path, summary: LabelSummary) -> Set[str]:
	"""Fold finished batches into label_result. Returns the issue ids that got labels."""
	touched: Set[str] = set()
	with conn.cursor() as cur:
		cur.execute("SELECT id, name, model FROM label_batch WHERE status = 'submitted' AND kind IN ('new', 'backlog') ORDER BY id")
		batches = cur.fetchall()
	for batch_id, name, model in batches:
		client = client_for(model)
		state, err = client.check(name)
		if state == "running":
			log.info("batch %s (%s): running", batch_id, name)
			continue
		with conn, conn.cursor() as cur:
			if state == "failed":
				cur.execute("UPDATE label_batch SET status = 'failed', finished_at = now(), error = %s WHERE id = %s", (err, batch_id))
				summary.failed_batches.append(name)
				log.warning("batch %s (%s) failed: %s", batch_id, name, err)
				continue
			cur.execute("SELECT start_speech_id, issue_id, content_hash FROM label_request WHERE batch_id = %s", (batch_id,))
			reqs = {k: (i, h) for k, i, h in cur.fetchall()}
			units = {}
			for issue_id in {i for i, _ in reqs.values()}:
				for u in units_for_issue(issues_dir, issue_id):
					units[u.key] = u
			tin = tout = cread = cwrite = labelled = bad = 0
			errors: List[str] = []
			for res in client.results(name):
				tin, tout = tin + res.input_tokens, tout + res.output_tokens
				cread, cwrite = cread + res.cache_read, cwrite + res.cache_write
				labels = None if res.error else parse_labels(res.text)
				if res.error:
					errors.append(res.error)
				if res.key not in reqs or res.key not in units or labels is None:
					bad += 1
					continue
				_store(cur, batch_id, model, units[res.key], reqs[res.key][1], labels, (res.input_tokens, res.output_tokens))
				touched.add(reqs[res.key][0])
				labelled += 1
			cost = ledger.cost(cur, model, date.today(), tin, tout, cread, cwrite)
			note = f"{bad} response(s) unusable" + (f"; first error: {errors[0][:300]}" if errors else "") if bad else None
			# nothing usable at all (e.g. every request errored): count it as failed so it shows in Slack
			status = "failed" if labelled == 0 and bad else "succeeded"
			cur.execute(
				"""UPDATE label_batch SET status = %s, finished_at = now(), input_tokens = %s,
				output_tokens = %s, cost_usd = %s, labelled = %s, error = %s WHERE id = %s""",
				(status, tin, tout, cost, labelled, note, batch_id),
			)
		if status == "failed":
			summary.failed_batches.append(name)
			log.warning("batch %s (%s) had no usable response: %s", batch_id, name, note)
		summary.collected_batches += 1
		summary.labelled += labelled
		summary.collected_cost += cost
		log.info("batch %s collected: %d labelled, %d unusable, %d/%d tokens, $%.2f", batch_id, labelled, bad, tin, tout, cost)
	return touched


# --- submit ---

def estimate(cur, model: str, units: List[Unit]) -> tuple:
	"""(input tokens, output tokens, cost) expected for `units` on `model`."""
	tin = sum(u.tokens_est(model) for u in units)
	tout = output_est(model, OUTPUT_TOKENS_EST) * len(units)
	return tin, tout, ledger.cost(cur, model, date.today(), tin, tout)


def submit(conn, units: List[Unit], kind: str, s: Settings, work_dir: Path, summary: LabelSummary,
		spend: Dict[str, float], model: Optional[str] = None, fallback: Optional[str] = None) -> Optional[tuple]:
	"""Submit one batch to the primary model, or the fallback within its own cap.

	Returns (model used, cost estimate) and adds the estimate to `spend`; None when the primary
	provider is unavailable and the fallback's cap doesn't cover the batch (the note says so)."""
	stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
	primary = model or s.model
	with conn, conn.cursor() as cur:
		def blocked(fallback_model: str) -> Optional[str]:
			est_fb = estimate(cur, fallback_model, units)[2]
			room = s.cap_for(fallback_model) - spend[provider_for(fallback_model)] - (s.reserve if kind == "backlog" else 0)
			return f"~${est_fb:.2f} needed, ${room:.2f} left under its cap" if est_fb > room else None

		try:
			model, name, note = submit_with_fallback(primary, fallback, [request_for(u) for u in units],
				f"kokkai-labels-{stamp}-{kind}", work_dir, blocked)
		except FallbackOverBudget as e:
			note = f"{e}; {kind} batch of {len(units)} waits"
			if note not in summary.notes:
				summary.notes.append(note)
			log.warning(note)
			return None
		if note and note not in summary.notes:
			summary.notes.append(note)
		tin, _, est = estimate(cur, model, units)
		spend[provider_for(model)] += est
		cur.execute(
			"""INSERT INTO label_batch (name, model, prompt_version, kind, exchanges, newest_date, oldest_date,
				input_tokens_est, cost_est) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
			(name, model, PROMPT_VERSION, kind, len(units), max(u.date for u in units), min(u.date for u in units), tin, est),
		)
		batch_id = cur.fetchone()[0]
		cur.executemany(
			"INSERT INTO label_request (batch_id, start_speech_id, issue_id, content_hash) VALUES (%s, %s, %s, %s)",
			[(batch_id, u.key, u.issue_id, u.content_hash) for u in units],
		)
	log.info("submitted %s batch %s (%s, %s): %d exchanges %s → %s, ~%d input tokens, ~$%.2f",
		kind, batch_id, name, model, len(units), units[-1].date, units[0].date, tin, est)
	return model, est


def take(units: Iterator[Unit], size: int, budget: float, cur, model: str) -> List[Unit]:
	"""Up to `size` units whose estimated cost on `model` stays within `budget`."""
	out: List[Unit] = []
	tin = 0
	pin, pout = ledger.price(cur, model, date.today())
	tout_each = output_est(model, OUTPUT_TOKENS_EST)
	for u in units:
		t = u.tokens_est(model)
		if (tin + t) * pin / 1e6 + (len(out) + 1) * tout_each * pout / 1e6 > budget:
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
	summary = LabelSummary(caps=s.caps)
	with conn, conn.cursor() as cur:
		ledger.ensure(cur)
	touched = set() if dry_run else collect(conn, issues_dir, summary)
	new_issues = set(new_issues)
	with conn.cursor() as cur:
		summary.paths = [] if dry_run else write_issues(cur, issues_dir, touched | new_issues)
	conn.commit()

	if s.enabled:
		with conn.cursor() as cur:
			done, pending = ledger.done_and_pending(cur, PROMPT_VERSION)
			spend = ledger.spend_by_provider(cur)
			model, fallback, note = s.active_model(spend)
			if note:
				summary.notes.append(note)
				log.warning(note)
			primary = provider_for(model)
			cap = s.cap_for(model)
			# new meetings: within the primary provider's full cap
			fresh = [u for i in sorted(new_issues, reverse=True) for u in due(units_for_issue(issues_dir, i), done, pending)]
			fresh.sort(key=lambda u: (u.date, u.key), reverse=True)
			if fresh:
				batch = take(iter(fresh), len(fresh), cap - spend[primary], cur, model)
				if len(batch) < len(fresh):
					summary.paused = True
				if batch and not dry_run:
					sent = submit(conn, batch, "new", s, work_dir, summary, spend, model, fallback)
					if sent:
						summary.submitted.append(("new", len(batch), sent[1]))
						pending |= {u.key for u in batch}
				elif batch:
					summary.submitted.append(("new (dry run)", len(batch), estimate(cur, model, batch)[2]))
			# backlog: newest first, keeping the reserve
			units = backlog_units(issues_dir, done, pending)
			flying = ledger.in_flight(cur, "backlog")
			n = 0
			while flying < s.max_backlog_batches and (max_batches is None or n < max_batches):
				budget = cap - s.reserve - spend[primary]
				batch = take(units, s.batch_size, budget, cur, model)
				if not batch:
					summary.paused = budget < cap * 0.05
					break
				if dry_run:
					tin, _, est = estimate(cur, model, batch)
					summary.submitted.append(("backlog (dry run)", len(batch), est))
					spend[primary] += est
					log.info("dry run: backlog batch of %d exchanges %s → %s on %s, ~%d tokens, ~$%.2f",
						len(batch), batch[-1].date, batch[0].date, model, tin, est)
				else:
					sent = submit(conn, batch, "backlog", s, work_dir, summary, spend, model, fallback)
					if not sent:
						summary.paused = True
						break
					summary.submitted.append(("backlog", len(batch), sent[1]))
				flying += 1
				n += 1

	with conn, conn.cursor() as cur:
		summary.spend = ledger.spend_by_provider(cur)
		summary.in_flight = ledger.in_flight(cur)
		cur.execute("SELECT count(*), min(date)::text FROM label_result")
		summary.total_labelled, summary.oldest_date = cur.fetchone()
		if not dry_run:
			for provider, cap in s.caps.items():
				sent = ledger.alerts_sent(cur, provider)
				for t in THRESHOLDS:
					if t not in sent and cap and summary.spend[provider] >= cap * t / 100:
						msg = f"⚠️ {provider.capitalize()} label spend reached ${summary.spend[provider]:.2f} of ${cap:.0f} for {date.today():%B}"
						if t == 100 or (summary.paused and provider == primary):
							msg += f"; backlog paused until {date(date.today().year + date.today().month // 12, date.today().month % 12 + 1, 1):%B}"
						summary.alerts.append(msg)
						ledger.mark_alert(cur, provider, t)
	return summary


def status(conn) -> str:
	with conn, conn.cursor() as cur:
		ledger.ensure(cur)
		spend = ledger.spend_by_provider(cur)
		cur.execute("""SELECT id, kind, status, model, exchanges, labelled, oldest_date, newest_date, round(cost_est, 2),
			round(cost_usd, 2), submitted_at::timestamp(0), finished_at::timestamp(0) FROM label_batch ORDER BY id DESC LIMIT 15""")
		rows = cur.fetchall()
		cur.execute("SELECT count(*), min(date), max(date) FROM label_result")
		n, lo, hi = cur.fetchone()
	s = Settings.from_env()
	lines = [f"{ledger.spend_line(spend, s.caps)}; {n:,} exchanges labelled ({lo} → {hi})",
		f"model {s.model}, fallback {s.fallback_model or 'none'}", ""]
	lines += ["id kind status model exchanges labelled oldest newest est actual submitted finished"]
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
