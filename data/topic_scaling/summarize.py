"""Summarize stage: Gemini Batch stance summaries under the shared monthly cap (spec §4.4).

collect: fold finished summary batches into summary_result and write summary.json for
         every (person, topic) whose SUMMARY_RUNS runs are all present;
submit:  for pairs whose opinion_hash changed, build one request per run (opinions
         shuffled per run, same prompt as create_idea_summaries.py) and submit batches
         while month_spend + estimate <= cap - reserve.
"""
from __future__ import annotations

import json
import logging
import random
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from speech_quality import ledger
from speech_quality.gemini_batch import DONE_STATES, GeminiBatch
from speech_quality.labels import usage

from . import ledger_ext
from .config import Config, Topic
from .select import Pair
from .state import State, read_json, write_json

log = logging.getLogger("topic_scaling.summarize")

TOKENS_PER_CHAR = 0.6
OUTPUT_TOKENS_EST = 450
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

	def tokens_est(self) -> int:
		return int((len(SYSTEM_PROMPT) + len(self.prompt)) * TOKENS_PER_CHAR)

	def batch_line(self) -> dict:
		return {
			"key": self.key,
			"request": {
				"systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
				"contents": [{"role": "user", "parts": [{"text": self.prompt}]}],
				"generationConfig": {"temperature": 0.7, "thinkingConfig": {"thinkingLevel": "low"}},
			},
		}


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
	month_spend: float = 0.0
	cap: float = 0.0
	paused: bool = False
	dry_run: bool = False

	def slack_line(self) -> str:
		pct = 100 * self.month_spend / self.cap if self.cap else 0
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
		parts.append(f"{date.today():%B}: ${self.month_spend:.2f} of ${self.cap:.0f} ({pct:.0f}%)")
		if self.failed_batches:
			parts.append(f"⚠️ {len(self.failed_batches)} batch(es) failed, will retry")
		return " · ".join(parts)


# --- writing summary.json from complete results ---

def write_summary_file(state: State, cfg: Config, person_id: str, topic: Topic, opinion_hash: str,
		runs: Dict[int, str], pair_meta: Optional[dict]) -> None:
	path = state.summary_path(person_id, topic.name_en)
	write_json(path, {
		"person_id": person_id, "speaker": (pair_meta or {}).get("speaker"),
		"topic_en": topic.name_en, "topic_jp": topic.name_jp, "slug": topic.slug,
		"window": topic.window_dict, "opinion_hash": opinion_hash,
		"opinion_count": (pair_meta or {}).get("n_opinions"), "n_speeches": (pair_meta or {}).get("n_speeches"),
		"first_speech": (pair_meta or {}).get("first_speech"), "last_speech": (pair_meta or {}).get("last_speech"),
		"model": cfg.summary_model, "prompt_version": cfg.summary_prompt_version,
		"generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
		"summaries": [runs[i] for i in sorted(runs)],
	})


def pair_meta_index(selection: Optional[dict]) -> Dict[Tuple[str, str], dict]:
	out = {}
	for topic_en, entry in ((selection or {}).get("topics") or {}).items():
		for rec in entry.get("pairs") or []:
			out[(str(rec["person_id"]), topic_en)] = rec
	return out


def collect(conn, gb: GeminiBatch, cfg: Config, state: State, topics_by_en: Dict[str, Topic],
		summary: SummarizeSummary) -> None:
	meta = pair_meta_index(state.selection())
	with conn.cursor() as cur:
		cur.execute("SELECT id, name, model FROM label_batch WHERE status = 'submitted' AND kind = 'summary' ORDER BY id")
		batches = cur.fetchall()
	for batch_id, name, model in batches:
		job = gb.get(name)
		st = gb.state(job)
		if st not in DONE_STATES:
			log.info("batch %s (%s): %s", batch_id, name, st)
			continue
		with conn, conn.cursor() as cur:
			if not st.endswith("SUCCEEDED"):
				err = json.dumps(job.get("error") or job.get("metadata", {}).get("error") or st, ensure_ascii=False)[:2000]
				cur.execute("UPDATE label_batch SET status = 'failed', finished_at = now(), error = %s WHERE id = %s", (err, batch_id))
				summary.failed_batches.append(name)
				log.warning("batch %s (%s) ended %s: %s", batch_id, name, st, err)
				continue
			out_file = gb.result_file(job)
			if not out_file:
				raise RuntimeError(f"batch {name} succeeded but has no responses file: {json.dumps(job)[:500]}")
			cur.execute("SELECT key, person_id, topic, run_idx, opinion_hash FROM summary_request WHERE batch_id = %s", (batch_id,))
			reqs = {k: (int(p), t, int(i), h) for k, p, t, i, h in cur.fetchall()}
			tin = tout = ok = bad = 0
			touched = set()
			for line in gb.download(out_file):
				key = line.get("key")
				resp = line.get("response") or {}
				t = usage(resp)
				tin, tout = tin + t[0], tout + t[1]
				text = ""
				try:
					text = "".join(p.get("text", "") for p in resp["candidates"][0]["content"]["parts"])
				except (KeyError, IndexError, TypeError):
					pass
				text = strip_preamble(text)
				if key not in reqs or not text:
					bad += 1
					continue
				pid, topic_en, run_idx, h = reqs[key]
				ledger_ext.store_result(cur, batch_id, model, cfg.summary_prompt_version, pid, topic_en, run_idx, h, text, t)
				touched.add((pid, topic_en, h))
				ok += 1
			cost = ledger.cost(cur, model, date.today(), tin, tout)
			cur.execute("""UPDATE label_batch SET status = 'succeeded', finished_at = now(), input_tokens = %s,
				output_tokens = %s, cost_usd = %s, labelled = %s, error = %s WHERE id = %s""",
				(tin, tout, cost, ok, f"{bad} response(s) unusable" if bad else None, batch_id))
			for pid, topic_en, h in touched:
				topic = topics_by_en.get(topic_en)
				if topic is None:
					continue
				runs = ledger_ext.results_for(cur, pid, topic_en, h, cfg.summary_prompt_version)
				if len(runs) >= cfg.summary_runs:
					write_summary_file(state, cfg, str(pid), topic, h, runs, meta.get((str(pid), topic_en)))
					summary.summaries_written += 1
		summary.collected_batches += 1
		summary.collected_cost += cost
		log.info("batch %s collected: %d ok, %d unusable, %d/%d tokens, $%.2f", batch_id, ok, bad, tin, tout, cost)


def submit_batch(conn, gb: GeminiBatch, cfg: Config, state: State, reqs: List[Request]) -> float:
	tin = sum(r.tokens_est() for r in reqs)
	stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
	path = state.batches_dir / f"{stamp}-summary.jsonl"
	with open(path, "w", encoding="utf-8") as f:
		for r in reqs:
			f.write(json.dumps(r.batch_line(), ensure_ascii=False) + "\n")
	with conn, conn.cursor() as cur:
		est = ledger.cost(cur, cfg.summary_model, date.today(), tin, OUTPUT_TOKENS_EST * len(reqs))
		file_name = gb.upload(path, f"kokkai-summaries-{stamp}")
		name = gb.create(cfg.summary_model, file_name, f"kokkai-summaries-{stamp}")
		cur.execute("""INSERT INTO label_batch (name, model, prompt_version, kind, exchanges, input_tokens_est, cost_est)
			VALUES (%s, %s, %s, 'summary', %s, %s, %s) RETURNING id""",
			(name, cfg.summary_model, cfg.summary_prompt_version, len(reqs), tin, est))
		batch_id = cur.fetchone()[0]
		cur.executemany("""INSERT INTO summary_request (batch_id, key, person_id, topic, run_idx, opinion_hash)
			VALUES (%s, %s, %s, %s, %s, %s)""",
			[(batch_id, r.key, int(r.person_id), r.topic.name_en, r.run_idx, r.opinion_hash) for r in reqs])
	path.unlink()
	log.info("submitted summary batch %s (%s): %d requests, ~%d input tokens, ~$%.2f", batch_id, name, len(reqs), tin, est)
	return est


def run_summarize(conn, cfg: Config, state: State, topics: List[Topic], pairs: Dict[Tuple[str, str], Pair],
		dry_run: bool = False, max_batches: Optional[int] = None) -> SummarizeSummary:
	"""`pairs` are the select stage's pairs (with opinions in memory); only changed ones are submitted."""
	s = SummarizeSummary(cap=cfg.cap, dry_run=dry_run)
	topics_by_en = {t.name_en: t for t in topics}
	with conn, conn.cursor() as cur:
		ledger_ext.ensure(cur)
	gb = GeminiBatch()
	if not dry_run:
		collect(conn, gb, cfg, state, topics_by_en, s)

	with conn.cursor() as cur:
		pending = ledger_ext.pending_keys(cur)
		spend = ledger.month_spend(cur)
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
		pin, pout = ledger.price(cur, cfg.summary_model, date.today())

	budget = cfg.cap - cfg.reserve - spend
	batch: List[Request] = []
	batch_cost = 0.0
	n_batches = 0
	limit = cfg.max_batches if max_batches is None else max_batches

	def flush():
		nonlocal batch, batch_cost, n_batches, spend
		if not batch:
			return
		if dry_run:
			s.submitted.append((len(batch), batch_cost))
			log.info("dry run: would submit %d requests (~$%.2f)", len(batch), batch_cost)
		else:
			s.submitted.append((len(batch), submit_batch(conn, gb, cfg, state, batch)))
		spend += batch_cost
		n_batches += 1
		batch, batch_cost = [], 0.0

	for pair in changed:
		if n_batches >= limit:
			s.pairs_waiting += 1
			continue
		reqs = build_requests(pair, topics_by_en[pair.topic_en], cfg.summary_runs, cfg.seed)
		cost = sum(r.tokens_est() for r in reqs) * pin / 1e6 + len(reqs) * OUTPUT_TOKENS_EST * pout / 1e6
		if spend + batch_cost + cost > cfg.cap - cfg.reserve:
			s.pairs_waiting += 1
			s.paused = True
			continue
		batch.extend(reqs)
		batch_cost += cost
		s.pairs_submitted += 1
		if len(batch) >= cfg.batch_size:
			flush()
	if n_batches < limit:
		flush()
	else:
		s.pairs_waiting += len(batch) // max(1, cfg.summary_runs)
		s.pairs_submitted -= len(batch) // max(1, cfg.summary_runs)

	with conn, conn.cursor() as cur:
		s.month_spend = ledger.month_spend(cur)
	if budget <= 0:
		s.paused = True
	return s
