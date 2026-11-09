"""CLI: python -m topic_scaling <stage> (run from data/; specs/topic-scaling-refresh).

  all        select → summarize → embed → project → publish → suggest, one Slack report
  select     [--estimate] [--topic T ...] [--limit N]   window filter + opinion gate → select.json
  summarize  [--dry-run] [--max-batches N]            collect finished summary batches, submit changed pairs
  embed      [--topic T ...]                           embed summaries + reference speeches
  project    [--topic T ...] [--publish-partial]       1D/2D per sub-topic → ideology.json.gz (+ upload)
  suggest                                              volume curves + candidate topics → Slack
  onboard    --topic T [--refresh] [--axes] [--limit N] backfill {T}.jsonl for a new topic (+ upload);
                                                       --axes generates axes + reference speeches from its summaries
  status                                               what is selected / summarised / pending

Publishing happens only when no summary batch is in flight and no changed pair is
waiting for budget, unless --publish-partial is given (used during the backfill).
--dry-run never writes to the mirror, S3, the LLM providers or Postgres (select's opinion cache is still written).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

from .config import DATA_DIR, AxisError, Config, SubTopic, Topic, load_axes, load_config, load_topics
from .state import LockHeld, State, read_json

log = logging.getLogger("topic_scaling")


class StageError(RuntimeError):
	def __init__(self, stage: str, cause: BaseException):
		super().__init__(f"{type(cause).__name__}: {cause}")
		self.stage = stage


def setup_logging(state: State) -> Path:
	log_path = state.logs_dir / f"scaling-{datetime.now():%Y%m%d-%H%M%S}.log"
	fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
	root = logging.getLogger()
	root.setLevel(logging.INFO)
	for h in (logging.FileHandler(log_path, encoding="utf-8"), logging.StreamHandler(sys.stderr)):
		h.setFormatter(fmt)
		root.addHandler(h)
	for noisy in ("botocore", "urllib3", "sentence_transformers", "transformers", "numba", "httpx"):
		logging.getLogger(noisy).setLevel(logging.WARNING)
	return log_path


def connect_postgres():
	import psycopg2
	try:
		return psycopg2.connect(dbname="kokkaidoc", user="postgres", password=os.getenv("PSQL_DATABASE_PASSWORD"),
			host="localhost", port="5432", connect_timeout=5)
	except psycopg2.OperationalError as e:
		log.warning("Postgres unavailable: %s", str(e).strip())
		return None


def notifier(enabled: bool):
	from speech_update.notify import from_env
	return from_env(enabled, title="Kokkai topic scaling")


def load_all_axes(cfg: Config, topics: List[Topic]) -> Tuple[Dict[str, List[SubTopic]], List[str]]:
	axes: Dict[str, List[SubTopic]] = {}
	problems: List[str] = []
	for t in topics:
		if not t.scalable:
			continue
		try:
			axes[t.name_en] = load_axes(cfg.axis_dir, t)
		except AxisError as e:
			problems.append(str(e))
			log.error("%s", e)
	return axes, problems


# --- stages ---

def run_select(cfg: Config, state: State, topics: List[Topic], args):
	from .select import run_select as _select
	sel, pairs = _select(cfg, state, topics, estimate=args.estimate, only_topics=args.topic, limit=args.limit)
	return sel, pairs


def run_summarize(cfg: Config, state: State, topics: List[Topic], pairs, args, conn):
	from .summarize import run_summarize as _summarize
	if conn is None:
		raise RuntimeError("Postgres is required for the summary ledger")
	if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("GEMINI_API_KEY")):
		raise RuntimeError("neither ANTHROPIC_API_KEY nor GEMINI_API_KEY is set")
	return _summarize(conn, cfg, state, topics, pairs, dry_run=args.dry_run, max_batches=args.max_batches)


def run_embed(cfg: Config, state: State, topics: List[Topic], axes, args):
	from .embed import run_embed as _embed
	sel = state.selection()
	if not sel:
		raise RuntimeError("no select.json; run select first")
	return _embed(cfg, state, topics, axes, sel, only_topics=args.topic)


def run_project(cfg: Config, state: State, topics: List[Topic], axes, args, conn) -> Tuple[Optional[dict], List[str]]:
	"""Project every scalable topic; returns (document, notes). Publishes unless --dry-run."""
	from .members import current_members, persons_from_db, snapshot_date
	from .project import project_topic
	from .publish import build_document, upload, write_document
	sel = state.selection()
	if not sel:
		raise RuntimeError("no select.json; run select first")
	members = current_members(cfg.members_dir)
	current_ids = set(members)
	all_pids = {int(r["person_id"]) for e in sel["topics"].values() for r in e.get("pairs") or []}
	metas: Dict[int, dict] = persons_from_db(conn, all_pids - current_ids) if conn else {}
	metas.update(members)
	missing = all_pids - set(metas)
	notes: List[str] = []
	if missing:
		notes.append(f"{len(missing)} scaled person(s) have no name (Postgres down?)")
	blocks = []
	for t in topics:
		if not t.scalable or t.name_en not in axes or (args.topic and t.name_en not in args.topic):
			continue
		entry = sel["topics"].get(t.name_en) or {}
		block = project_topic(cfg, state, t, axes[t.name_en], entry.get("pairs") or [], metas, current_ids)
		if block is None:
			notes.append(f"{t.name_en}: nothing embedded yet")
			continue
		blocks.append(block)
		log.info("%s: %d scaled (%d current), %d sub-topics", t.name_en, block["n_scaled"], block["n_current"], len(block["sub_topics"]))
	if not blocks:
		return None, notes + ["nothing to publish"]
	doc = build_document(cfg, blocks, snapshot_date(cfg.members_dir))
	if args.dry_run:
		log.info("dry run: not writing ideology file (%d topics)", len(blocks))
		return doc, notes
	paths = write_document(cfg, doc)
	if getattr(args, "no_upload", False):
		notes.append("upload skipped (--no-upload)")
	else:
		upload(cfg, paths)
	return doc, notes


def run_suggest(cfg: Config, state: State, topics: List[Topic], args) -> List[str]:
	"""Volume curves (A) and Gemini agenda candidates (C); the full text goes to
	state/suggestions/YYYY-MM.md, the Slack report gets the same lines."""
	from .suggest.agendas import run_agendas
	from .suggest.volume import run_volume
	lines = run_volume(cfg, state, topics)
	raw = []
	if os.getenv("GEMINI_API_KEY") and not getattr(args, "dry_run", False):
		try:
			more, raw = run_agendas(cfg, topics)
			lines += [""] + more
		except Exception as e:  # noqa: BLE001 - suggestions are best effort
			log.exception("agenda suggestions failed")
			lines.append(f"⚠️ agenda suggestions failed: {type(e).__name__}: {e}")
	else:
		lines.append("(agenda candidates skipped: no GEMINI_API_KEY or dry run)")
	from .state import write_atomic
	md = state.suggestions_dir / f"{datetime.now():%Y-%m}.md"
	body = f"# Topic scaling suggestions {datetime.now():%Y-%m-%d}\n\n" + "\n".join(lines) + "\n"
	if raw:
		body += "\n## Candidate entries (JSON)\n\n```json\n" + json.dumps(raw, ensure_ascii=False, indent=2) + "\n```\n"
	write_atomic(md, body)
	lines.append(f"Details: {md}")
	return lines


# --- orchestration ---

def summarize_allowed_to_publish(s) -> bool:
	return not s.pairs_pending and not s.pairs_waiting and not s.failed_batches


def run_all(cfg: Config, state: State, topics: List[Topic], args, notify) -> dict:
	t0 = time.time()
	axes, axis_problems = load_all_axes(cfg, topics)
	conn = connect_postgres()
	report: dict = {"axis_problems": axis_problems, "skipped_topics": [f"{t.name_en}: {t.skip_reason}" for t in topics if not t.scalable]}
	try:
		sel, pairs = run_select(cfg, state, topics, args)
	except Exception as e:
		raise StageError("select", e) from e
	report["select"] = {k: {kk: vv for kk, vv in v.items() if kk != "pairs"} for k, v in sel["topics"].items()}

	summ = None
	try:
		summ = run_summarize(cfg, state, topics, pairs, args, conn)
	except Exception as e:  # a Gemini/ledger problem must not stop embed/project of what exists
		log.exception("summarize failed")
		report["summarize_error"] = f"{type(e).__name__}: {e}"
	if summ:
		report["summaries"] = summ.slack_line()

	try:
		report["embedded"] = run_embed(cfg, state, topics, axes, args)
	except Exception as e:
		raise StageError("embed", e) from e

	can_publish = args.publish_partial or (summ is not None and summarize_allowed_to_publish(summ))
	if can_publish:
		try:
			doc, notes = run_project(cfg, state, topics, axes, args, conn)
		except Exception as e:
			raise StageError("project", e) from e
		report["published"] = bool(doc) and not args.dry_run
		report["publish_notes"] = notes
		if doc:
			report["topics_published"] = [(b["topic_en"], b["n_scaled"], b["n_current"], len(b["sub_topics"])) for b in doc["data"]]
	else:
		report["published"] = False
		report["publish_notes"] = ["summaries still in flight or waiting for budget; old file stays live (use --publish-partial to force)"]

	try:
		report["suggestions"] = run_suggest(cfg, state, topics, args)
	except Exception as e:
		log.exception("suggest failed")
		report["suggest_error"] = f"{type(e).__name__}: {e}"
	report["duration_s"] = round(time.time() - t0)
	if conn:
		conn.close()
	return report


def slack_report(report: dict, dry_run: bool) -> str:
	lines = [f"📐 Topic scaling {datetime.now():%Y-%m-%d}{' (dry run)' if dry_run else ''}"]
	if report.get("published"):
		tp = report.get("topics_published") or []
		lines.append(f"Published: {len(tp)} topics, {sum(n for _, _, _, n in tp)} sub-topics, "
			f"{sum(s for _, s, _, _ in tp)} scaled pairs, {sum(c for _, _, c, _ in tp)} current")
	else:
		lines.append("Not published: " + "; ".join(report.get("publish_notes") or ["nothing to publish"]))
	if report.get("summaries"):
		lines.append(report["summaries"])
	if report.get("summarize_error"):
		lines.append(f"❌ summarize: {report['summarize_error']}")
	gate = [f"{k} {v['below_gate']}" for k, v in (report.get("select") or {}).items() if v.get("below_gate")]
	if gate:
		lines.append("Below gate: " + ", ".join(gate))
	if report.get("skipped_topics"):
		lines.append("Unscaled: " + ", ".join(report["skipped_topics"]))
	if report.get("axis_problems"):
		lines.append("⚠️ Axis problems:\n" + "\n".join(f"  • {p}" for p in report["axis_problems"]))
	for s in report.get("suggestions") or []:
		lines.append(s)
	if report.get("suggest_error"):
		lines.append(f"⚠️ suggest: {report['suggest_error']}")
	lines.append(f"{report.get('duration_s', 0)}s")
	return "\n".join(lines)


def status(cfg: Config, state: State, topics: List[Topic]) -> str:
	sel = state.selection()
	lines = [f"state: {state.dir}", f"embed model: {cfg.embed_model}", f"summary model: {cfg.summary_model} (runs={cfg.summary_runs})"]
	if not sel:
		lines.append("no select.json yet")
		return "\n".join(lines)
	lines.append(f"selected at {sel.get('generated_at')} (estimate={sel.get('estimate')})")
	for name, e in sel["topics"].items():
		have = sum(1 for r in e.get("pairs") or [] if read_json(state.summary_path(str(r["person_id"]), name), {}).get("opinion_hash") == r["opinion_hash"])
		lines.append(f"  {name:20s} window {e['window']['from']}→{e['window']['to'] or 'now'}  scaled {e['scaled']:5d}  "
			f"summarised {have:5d}  below gate {e['below_gate']:5d}  {('skip: ' + e['skip_reason']) if e.get('skip_reason') else ''}")
	last = state.last_run()
	if last:
		lines.append(f"last run: {last.get('finished_at')} published={last.get('published')}")
	return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
	p = argparse.ArgumentParser(prog="python -m topic_scaling", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
	p.add_argument("stage", choices=["all", "select", "summarize", "embed", "project", "suggest", "onboard", "status"])
	p.add_argument("--dry-run", action="store_true")
	p.add_argument("--estimate", action="store_true", help="select: count search-word sentences instead of running the classifier")
	p.add_argument("--topic", action="append", help="restrict to topic_name_en (repeatable)")
	p.add_argument("--limit", type=int, help="select: only the first N person directories (dev)")
	p.add_argument("--max-batches", type=int, help="summarize: batches to submit this run")
	p.add_argument("--publish-partial", action="store_true", help="publish even if summaries are pending")
	p.add_argument("--no-upload", action="store_true", help="project: write the file but don't upload")
	p.add_argument("--notify", action="store_true", help="send the Slack report")
	p.add_argument("--refresh", action="store_true", help="onboard: rebuild existing topic files")
	p.add_argument("--axes", action="store_true", help="onboard: generate axes + reference speeches with Gemini")
	args = p.parse_args(argv)

	# .env first, so TOPIC_SCALING_* / SPEECH_LABEL_* settings in it reach load_config()
	load_dotenv(os.environ.get("TOPIC_SCALING_ENV_FILE", DATA_DIR / ".env"))
	cfg = load_config()
	state = State(cfg.state_dir)
	log_path = setup_logging(state)
	topics = load_topics(cfg.topics_file, cfg.min_opinions)
	notify = notifier(args.notify)

	if args.stage == "status":
		print(status(cfg, state, topics))
		return 0
	try:
		state.acquire_lock()
	except LockHeld as e:
		log.error("%s", e)
		return 75
	try:
		if args.stage == "all":
			report = run_all(cfg, state, topics, args, notify)
			text = slack_report(report, args.dry_run)
			log.info("report:\n%s", text)
			if not args.dry_run:
				state.save_last_run({**report, "finished_at": datetime.now().astimezone().isoformat(timespec="seconds")})
			notify.send(text)
			return 0
		axes, problems = load_all_axes(cfg, topics)
		if args.stage == "select":
			sel, pairs = run_select(cfg, state, topics, args)
			for name, e in sel["topics"].items():
				print(f"{name:20s} in-window {e['persons_in_window']:5d}  scaled {e['scaled']:5d}  below gate {e['below_gate']:5d}  changed {e['changed']:5d}"
					+ (f"  [{e['skip_reason']}]" if e.get("skip_reason") else ""))
			if args.estimate:
				from speech_quality.batch_client import output_est, tokens_est
				from .summarize import OUTPUT_TOKENS_EST, instruction
				n_pairs = sum(e["scaled"] for e in sel["topics"].values())
				chars = sum(len(" ".join(pr.opinions)) + len(instruction("X")) for pr in pairs.values())
				# batch prices per 1M tokens, as in speech_quality.ledger.PRICES
				for model, pin, pout in (("claude-sonnet-5-5", 1.0, 5.0), ("gemini-3.5-flash-lite", 0.15, 1.25), ("gemini-3.8-flash", 0.375, 1.875)):
					tin = tokens_est(model, chars) * cfg.summary_runs
					tout = output_est(model, OUTPUT_TOKENS_EST) * cfg.summary_runs * n_pairs
					print(f"{n_pairs} pairs × {cfg.summary_runs} runs on {model}: ~{tin / 1e6:.1f}M input + ~{tout / 1e6:.2f}M output tokens"
						f" ≈ ${tin / 1e6 * pin + tout / 1e6 * pout:.2f}")
				print("(search-word sentences are an upper bound on opinions; the classifier keeps roughly a third)")
		elif args.stage == "summarize":
			conn = connect_postgres()
			from .select import Pair
			sel = state.selection()
			if not sel:
				raise RuntimeError("no select.json; run select first")
			# rebuild opinions for changed pairs from the cache without re-classifying
			_, pairs = run_select(cfg, state, topics, argparse.Namespace(estimate=False, topic=args.topic, limit=args.limit))
			s = run_summarize(cfg, state, topics, pairs, args, conn)
			print(s.slack_line())
		elif args.stage == "embed":
			print(run_embed(cfg, state, topics, axes, args))
		elif args.stage == "project":
			conn = connect_postgres()
			doc, notes = run_project(cfg, state, topics, axes, args, conn)
			for n in notes:
				print(n)
			if doc:
				for b in doc["data"]:
					print(f"{b['topic_en']:20s} scaled {b['n_scaled']:5d} current {b['n_current']:5d} sub-topics {len(b['sub_topics'])}")
		elif args.stage == "suggest":
			for line in run_suggest(cfg, state, topics, args):
				print(line)
		elif args.stage == "onboard":
			if not args.topic or len(args.topic) != 1:
				raise SystemExit("onboard needs exactly one --topic <TopicNameEn>")
			topic = next((t for t in topics if t.name_en == args.topic[0]), None)
			if topic is None:
				raise SystemExit(f"{args.topic[0]} is not in {cfg.topics_file}")
			if args.axes:
				from .axis import generate_axes, generate_examples, write_axis_files
				entries = generate_axes(cfg, state, topic)
				print(f"{len(entries)} axes:")
				for e in entries:
					print(f"  {e['slug']:24s} {e['topic']}\n     pro: {e['pro']}\n     con: {e['con']}")
				if not args.dry_run:
					examples = [generate_examples(cfg, topic, e) for e in entries]
					path = write_axis_files(cfg, topic, entries, examples)
					print(f"wrote {path} (+ examples); edit it if needed and add the sub-topics to frontend/app/data/available.json")
					notify.send(f"📐 Axes generated for {topic.name_en} ({topic.name_jp}): " + "; ".join(f"{e['slug']}: {e['topic']}" for e in entries)
						+ f"\nEdit `{path}` if needed; the next monthly run scales it.")
			else:
				from .onboard import backfill_topic_files
				from .publish import upload
				scanned, written, paths = backfill_topic_files(cfg, topic, refresh=args.refresh, limit=args.limit)
				print(f"{topic.name_en}: scanned {scanned} persons, wrote {written} topic files")
				if paths and not args.dry_run and not args.no_upload:
					upload(cfg, paths)
					print(f"uploaded {len(paths)} files")
		return 0
	except StageError as e:
		log.exception("stage %s failed", e.stage)
		if os.environ.get("TOPIC_SCALING_NOTIFY_FAILURE", "1") == "1":
			notify.send(f"❌ Topic scaling failed in *{e.stage}*: {e}\nLog: `{log_path}`")
		return 1
	except Exception as e:  # noqa: BLE001
		log.exception("failed")
		if os.environ.get("TOPIC_SCALING_NOTIFY_FAILURE", "1") == "1":
			notify.send(f"❌ Topic scaling failed: {type(e).__name__}: {e}\nLog: `{log_path}`")
		return 1
	finally:
		state.release_lock()


if __name__ == "__main__":
	sys.exit(main())
