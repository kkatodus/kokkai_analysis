"""Summarize stage: batched stance summaries (Claude, Gemini as fallback) under the shared
monthly cap (spec §4.4).

collect: fold finished summary batches into summary_result and write summary.json for
         every (person, topic) whose SUMMARY_RUNS runs are all present;
submit:  for pairs whose opinion_hash changed, build one request per run (opinions
         shuffled per run, same prompt as create_idea_summaries.py) and submit batches
         while the summary model's provider stays under its cap minus the reserve
         (Claude and Gemini each have their own cap, shared with the label job).
"""
from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from speech_quality import ledger
from speech_quality.batch_client import (BatchRequest, FallbackOverBudget, client_for, output_est, provider_for,
	submit_with_fallback, tokens_est)

from . import ledger_ext
from .config import Config, Topic
from .select import Pair
from .state import State, read_json, write_json

log = logging.getLogger("topic_scaling.summarize")

OUTPUT_TOKENS_EST = 450      # Gemini; batch_client.output_est scales it per provider
MAX_TOKENS = 8192            # Claude: the summary plus low-effort thinking
MAX_PROMPT_CHARS = 120_000   # ~70k tokens; opinions beyond this are dropped (newest first kept)
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "txts" / "quantify_repr_stances" / "summary.txt"
SYSTEM_PROMPT = (
	"国会議事録の意見文を、匿名化されたスタンス要約に変換する。氏名・役職・呼称は出力しない。"
	"前置きや説明文（「ご提示いただいた〜」「この政治家は〜」等）は一切出力しない。"
	"箇条書きの要約本文のみを返す。"
)
META_PREAMBLE = ("ご提示いただいた", "この政治家", "以下に", "以下の", "推察すると", "推察いたします", "要約します", "要約いたします", "要約すると")


def instruction(topic_jp: str) -> str:
	return PROMPT_PATH.read_text(encoding="utf-8").replace("TOPIC", topic_jp)


def strip_preamble(summary: str) -> str:
	lines = []
	for line in summary.splitlines():
		t = line.strip()
		if not t or any(t.startswith(p) for p in META_PREAMBLE):
			continue
		lines.append(line)
	return "\n".join(lines).strip()


@dataclass
class Request:
	person_id: str
	topic: Topic
	run_idx: int
	opinion_hash: str
	prompt: str

	@property
	def key(self) -> str:
		return f"{self.person_id}:{self.topic.name_en}:{self.run_idx}"

	def tokens_est(self, model: str) -> int:
		return tokens_est(model, len(SYSTEM_PROMPT) + len(self.prompt))

	def request(self) -> BatchRequest:
		# temperature applies to Gemini only; Claude 5.5 samples at its default, the per-run shuffle keeps runs apart
		return BatchRequest(key=self.key, system=SYSTEM_PROMPT, user=self.prompt, temperature=0.7,
			max_tokens=MAX_TOKENS, effort="low")


def build_requests(pair: Pair, topic: Topic, runs: int, seed: int) -> List[Request]:
	ins = instruction(topic.name_jp)
	out = []
	for run_idx in range(runs):
		ops = list(pair.opinions)
		random.Random(f"{seed}:{pair.opinion_hash}:{run_idx}").shuffle(ops)
		body = "\n".join(ops)
		if len(ins) + len(body) + 2 > MAX_PROMPT_CHARS:
			kept = []
			size = len(ins) + 2
			for o in ops:
				if size + len(o) + 1 > MAX_PROMPT_CHARS:
					break
				kept.append(o)
				size += len(o) + 1
			body = "\n".join(kept)
		out.append(Request(pair.person_id, topic, run_idx, pair.opinion_hash, f"{ins}\n\n{body}"))
	return out


@dataclass
class SummarizeSummary:
	collected_batches: int = 0
	collected_cost: float = 0.0
	summaries_written: int = 0
	failed_batches: List[str] = field(default_factory=list)
	submitted: List[Tuple[int, float]] = field(default_factory=list)   # (requests, cost_est)
	pairs_submitted: int = 0
	pairs_waiting: int = 0        # changed pairs not submitted (cap)
	pairs_pending: int = 0        # in flight
	spend: Dict[str, float] = field(default_factory=dict)   # per provider, this month
	caps: Dict[str, float] = field(default_factory=dict)
	paused: bool = False
	dry_run: bool = False
	notes: List[str] = field(default_factory=list)   # e.g. a fallback to the other provider

	def slack_line(self) -> str:
		parts = [f"📝 Summaries: +{self.summaries_written} written"]
		if self.collected_batches:
			parts.append(f"{self.collected_batches} batch(es) collected (${self.collected_cost:.2f})")
		if self.submitted:
			parts.append(f"{self.pairs_submitted} pairs / {sum(n for n, _ in self.submitted)} requests submitted"
				f" (~${sum(c for _, c in self.submitted):.2f}{', dry run' if self.dry_run else ''})")
		if self.pairs_pending:
			parts.append(f"{self.pairs_pending} pairs in flight")
		if self.pairs_waiting:
			parts.append(f"⏸ {self.pairs_waiting} pairs waiting for budget")
		parts.append(ledger.spend_line(self.spend, self.caps))
		if self.failed_batches:
			parts.append(f"⚠️ {len(self.failed_batches)} batch(es) failed, will retry")
		parts += [f"⚠️ {n}" for n in self.notes]
		return " · ".join(parts)


# --- writing summary.json from complete results ---

def write_summary_file(state: State, cfg: Config, person_id: str, topic: Topic, opinion_hash: str,
		runs: Dict[int, str], pair_meta: Optional[dict], models: Optional[List[str]] = None) -> None:
	path = state.summary_path(person_id, topic.name_en)
	write_json(path, {
		"person_id": person_id, "speaker": (pair_meta or {}).get("speaker"),
		"topic_en": topic.name_en, "topic_jp": topic.name_jp, "slug": topic.slug,
		"window": topic.window_dict, "opinion_hash": opinion_hash,
		"opinion_count": (pair_meta or {}).get("n_opinions"), "n_speeches": (pair_meta or {}).get("n_speeches"),
		"first_speech": (pair_meta or {}).get("first_speech"), "last_speech": (pair_meta or {}).get("last_speech"),
		"model": ", ".join(models) if models else cfg.summary_model, "prompt_version": cfg.summary_prompt_version,
		"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
		"summaries": [runs[i] for i in sorted(runs)],
	})


def pair_meta_index(selection: Optional[dict]) -> Dict[Tuple[str, str], dict]:
	out = {}
	for topic_en, entry in ((selection or {}).get("topics") or {}).items():
		for rec in entry.get("pairs") or []:
			out[(str(rec["person_id"]), topic_en)] = rec
	return out


def collect(conn, cfg: Config, state: State, topics_by_en: Dict[str, Topic], summary: SummarizeSummary) -> None:
	meta = pair_meta_index(state.selection())
	with conn.cursor() as cur:
		cur.execute("SELECT id, name, model FROM label_batch WHERE status = 'submitted' AND kind = 'summary' ORDER BY id")
		batches = cur.fetchall()
	for batch_id, name, model in batches:
		client = client_for(model)
		st, err = client.check(name)
		if st == "running":
			log.info("batch %s (%s): running", batch_id, name)
			continue
		with conn, conn.cursor() as cur:
			if st == "failed":
				cur.execute("UPDATE label_batch SET status = 'failed', finished_at = now(), error = %s WHERE id = %s", (err, batch_id))
				summary.failed_batches.append(name)
				log.warning("batch %s (%s) failed: %s", batch_id, name, err)
				continue
			cur.execute("SELECT key, person_id, topic, run_idx, opinion_hash FROM summary_request WHERE batch_id = %s", (batch_id,))
			reqs = {k: (int(p), t, int(i), h) for k, p, t, i, h in cur.fetchall()}
			tin = tout = cread = cwrite = ok = bad = 0
			errors: List[str] = []
			touched = set()
			for res in client.results(name):
				tin, tout = tin + res.input_tokens, tout + res.output_tokens
				cread, cwrite = cread + res.cache_read, cwrite + res.cache_write
				if res.error:
					errors.append(res.error)
				text = "" if res.error else strip_preamble(res.text)
				if res.key not in reqs or not text:
					bad += 1
					continue
				pid, topic_en, run_idx, h = reqs[res.key]
				ledger_ext.store_result(cur, batch_id, model, cfg.summary_prompt_version, pid, topic_en, run_idx, h, text,
					(res.input_tokens, res.output_tokens))
				touched.add((pid, topic_en, h))
				ok += 1
			cost = ledger.cost(cur, model, date.today(), tin, tout, cread, cwrite)
			note = f"{bad} response(s) unusable" + (f"; first error: {errors[0][:300]}" if errors else "") if bad else None
			status = "failed" if ok == 0 and bad else "succeeded"
			cur.execute("""UPDATE label_batch SET status = %s, finished_at = now(), input_tokens = %s,
				output_tokens = %s, cost_usd = %s, labelled = %s, error = %s WHERE id = %s""",
				(status, tin, tout, cost, ok, note, batch_id))
			for pid, topic_en, h in touched:
				topic = topics_by_en.get(topic_en)
				if topic is None:
					continue
				runs = ledger_ext.results_for(cur, pid, topic_en, h, cfg.summary_prompt_version)
				if len(runs) >= cfg.summary_runs:
					write_summary_file(state, cfg, str(pid), topic, h, runs, meta.get((str(pid), topic_en)),
						ledger_ext.models_for(cur, pid, topic_en, h, cfg.summary_prompt_version))
					summary.summaries_written += 1
		if status == "failed":
			summary.failed_batches.append(name)
			log.warning("batch %s (%s) had no usable response: %s", batch_id, name, note)
		summary.collected_batches += 1
		summary.collected_cost += cost
		log.info("batch %s collected: %d ok, %d unusable, %d/%d tokens, $%.2f", batch_id, ok, bad, tin, tout, cost)


def submit_batch(conn, cfg: Config, state: State, reqs: List[Request], s: SummarizeSummary,
		spend: Dict[str, float], model: Optional[str] = None, fallback: Optional[str] = None) -> Optional[float]:
	"""Submit one batch to the summary model, or the fallback within its own cap.

	Returns the cost estimate for the model used (added to `spend`), or None when the primary
	provider is unavailable and the fallback's cap doesn't cover the batch."""
	stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
	primary = model or cfg.summary_model
	with conn, conn.cursor() as cur:
		def est_for(model: str) -> float:
			tin = sum(r.tokens_est(model) for r in reqs)
			return ledger.cost(cur, model, date.today(), tin, output_est(model, OUTPUT_TOKENS_EST) * len(reqs))

		def blocked(fallback_model: str) -> Optional[str]:
			est_fb = est_for(fallback_model)
			room = cfg.cap_for(fallback_model) - cfg.reserve - spend[provider_for(fallback_model)]
			return f"~${est_fb:.2f} needed, ${room:.2f} left under its cap" if est_fb > room else None

		try:
			model, name, note = submit_with_fallback(primary, fallback, [r.request() for r in reqs],
				f"kokkai-summaries-{stamp}", state.batches_dir, blocked)
		except FallbackOverBudget as e:
			note = f"{e}; {len(reqs)} summary requests wait"
			if note not in s.notes:
				s.notes.append(note)
			log.warning(note)
			return None
		if note and note not in s.notes:
			s.notes.append(note)
		tin = sum(r.tokens_est(model) for r in reqs)
		est = est_for(model)
		spend[provider_for(model)] += est
		cur.execute("""INSERT INTO label_batch (name, model, prompt_version, kind, exchanges, input_tokens_est, cost_est)
			VALUES (%s, %s, %s, 'summary', %s, %s, %s) RETURNING id""",
			(name, model, cfg.summary_prompt_version, len(reqs), tin, est))
		batch_id = cur.fetchone()[0]
		cur.executemany("""INSERT INTO summary_request (batch_id, key, person_id, topic, run_idx, opinion_hash)
			VALUES (%s, %s, %s, %s, %s, %s)""",
			[(batch_id, r.key, int(r.person_id), r.topic.name_en, r.run_idx, r.opinion_hash) for r in reqs])
	log.info("submitted summary batch %s (%s, %s): %d requests, ~%d input tokens, ~$%.2f", batch_id, name, model, len(reqs), tin, est)
	return est


def run_summarize(conn, cfg: Config, state: State, topics: List[Topic], pairs: Dict[Tuple[str, str], Pair],
		dry_run: bool = False, max_batches: Optional[int] = None) -> SummarizeSummary:
	"""`pairs` are the select stage's pairs (with opinions in memory); only changed ones are submitted."""
	s = SummarizeSummary(caps=cfg.caps, dry_run=dry_run)
	topics_by_en = {t.name_en: t for t in topics}
	with conn, conn.cursor() as cur:
		ledger_ext.ensure(cur)
	if not dry_run:
		collect(conn, cfg, state, topics_by_en, s)

	with conn.cursor() as cur:
		pending = ledger_ext.pending_keys(cur)
		spend = ledger.spend_by_provider(cur)
		model, fallback, note = cfg.active_summary_model(spend)
		if note:
			s.notes.append(note)
			log.warning(note)
		primary = provider_for(model)
		cap = cfg.cap_for(model)
		pending_pairs = {(str(p), t, h) for p, t, _, h in pending}
		changed: List[Pair] = []
		for (pid, topic_en), pair in sorted(pairs.items(), key=lambda kv: kv[1].last_speech or "", reverse=True):
			if read_json(state.summary_path(pid, topic_en), {}).get("opinion_hash") == pair.opinion_hash:
				continue
			if (pid, topic_en, pair.opinion_hash) in pending_pairs:
				s.pairs_pending += 1
				continue
			# runs already stored (e.g. a partial collect) are not resent
			have = ledger_ext.results_for(cur, int(pid), topic_en, pair.opinion_hash, cfg.summary_prompt_version)
			if len(have) >= cfg.summary_runs:
				write_summary_file(state, cfg, pid, topics_by_en[topic_en], pair.opinion_hash, have, pair.record())
				s.summaries_written += 1
				continue
			changed.append(pair)
		pin, pout = ledger.price(cur, model, date.today())
		tout_each = output_est(model, OUTPUT_TOKENS_EST)

	budget = cap - cfg.reserve - spend[primary]
	batch: List[Request] = []
	batch_cost = 0.0
	n_batches = 0
	limit = cfg.max_batches if max_batches is None else max_batches
	blocked = False   # the primary provider is unavailable and the fallback's cap is used up

	def flush() -> None:
		nonlocal batch, batch_cost, n_batches, blocked
		if not batch:
			return
		if dry_run:
			s.submitted.append((len(batch), batch_cost))
			spend[primary] += batch_cost
			log.info("dry run: would submit %d requests (~$%.2f)", len(batch), batch_cost)
		else:
			est = submit_batch(conn, cfg, state, batch, s, spend, model, fallback)
			if est is None:
				blocked = True
				s.paused = True
				s.pairs_waiting += len(batch) // max(1, cfg.summary_runs)
				s.pairs_submitted -= len(batch) // max(1, cfg.summary_runs)
				batch, batch_cost = [], 0.0
				return
			s.submitted.append((len(batch), est))
		n_batches += 1
		batch, batch_cost = [], 0.0

	for pair in changed:
		if n_batches >= limit or blocked:
			s.pairs_waiting += 1
			continue
		reqs = build_requests(pair, topics_by_en[pair.topic_en], cfg.summary_runs, cfg.seed)
		cost = sum(r.tokens_est(model) for r in reqs) * pin / 1e6 + len(reqs) * tout_each * pout / 1e6
		if spend[primary] + batch_cost + cost > cap - cfg.reserve:
			s.pairs_waiting += 1
			s.paused = True
			continue
		batch.extend(reqs)
		batch_cost += cost
		s.pairs_submitted += 1
		if len(batch) >= cfg.batch_size:
			flush()
	if n_batches < limit and not blocked:
		flush()
	else:
		s.pairs_waiting += len(batch) // max(1, cfg.summary_runs)
		s.pairs_submitted -= len(batch) // max(1, cfg.summary_runs)

	with conn, conn.cursor() as cur:
		s.spend = ledger.spend_by_provider(cur)
	if budget <= 0:
		s.paused = True
	return s
