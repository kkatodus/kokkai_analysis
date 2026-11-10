"""Summary rows in the shared label ledger (spec §4.4).

Reuses speech_quality.ledger (label_price, label_batch, month_spend) so summaries and
labels share one monthly cap. Adds kind='summary' to label_batch and two tables:

summary_request  which (person, topic, run) went into which batch
summary_result   the current summary text per (person, topic, run), keyed by opinion_hash
"""
from __future__ import annotations

from typing import Dict, List, Optional, Set, Tuple

from speech_quality import ledger

DDL = """
CREATE TABLE IF NOT EXISTS summary_request (
	batch_id bigint NOT NULL REFERENCES label_batch(id) ON DELETE CASCADE,
	key text NOT NULL,
	person_id bigint NOT NULL,
	topic text NOT NULL,
	run_idx int NOT NULL,
	opinion_hash text NOT NULL,
	PRIMARY KEY (batch_id, key)
);
CREATE TABLE IF NOT EXISTS summary_result (
	person_id bigint NOT NULL,
	topic text NOT NULL,
	run_idx int NOT NULL,
	opinion_hash text NOT NULL,
	batch_id bigint REFERENCES label_batch(id) ON DELETE SET NULL,
	model text NOT NULL,
	prompt_version text NOT NULL,
	summary text NOT NULL,
	input_tokens int,
	output_tokens int,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (person_id, topic, run_idx)
);
"""

PRICES = [
	("gemini-3.5-flash-lite", "2026-01-01", 0.15, 1.25),
]


def ensure(cur) -> None:
	ledger.ensure(cur)
	cur.execute("""
		SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
		WHERE c.conrelid = 'label_batch'::regclass AND c.contype = 'c' AND pg_get_constraintdef(c.oid) LIKE '%kind%'""")
	row = cur.fetchone()
	if row and "'summary'" not in row[0]:
		cur.execute("SELECT conname FROM pg_constraint WHERE conrelid = 'label_batch'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%kind%'")
		name = cur.fetchone()[0]
		cur.execute(f"ALTER TABLE label_batch DROP CONSTRAINT {name}")
		cur.execute("ALTER TABLE label_batch ADD CONSTRAINT label_batch_kind_check CHECK (kind IN ('new', 'backlog', 'summary'))")
	cur.execute(DDL)
	cur.executemany("INSERT INTO label_price VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING", PRICES)


def pending_keys(cur) -> Set[Tuple[int, str, int, str]]:
	"""(person_id, topic, run_idx, opinion_hash) of requests in batches still in flight."""
	cur.execute("""SELECT r.person_id, r.topic, r.run_idx, r.opinion_hash FROM summary_request r
		JOIN label_batch b ON b.id = r.batch_id WHERE b.status = 'submitted'""")
	return {(int(p), t, int(i), h) for p, t, i, h in cur.fetchall()}


def results_for(cur, person_id: int, topic: str, opinion_hash: str, prompt_version: str) -> Dict[int, str]:
	cur.execute("""SELECT run_idx, summary FROM summary_result
		WHERE person_id = %s AND topic = %s AND opinion_hash = %s AND prompt_version = %s""",
		(person_id, topic, opinion_hash, prompt_version))
	return {int(i): s for i, s in cur.fetchall()}


def models_for(cur, person_id: int, topic: str, opinion_hash: str, prompt_version: str) -> List[str]:
	"""Distinct models behind the stored runs (more than one after a provider fallback)."""
	cur.execute("""SELECT DISTINCT model FROM summary_result
		WHERE person_id = %s AND topic = %s AND opinion_hash = %s AND prompt_version = %s ORDER BY model""",
		(person_id, topic, opinion_hash, prompt_version))
	return [r[0] for r in cur.fetchall()]


def store_result(cur, batch_id: int, model: str, prompt_version: str, person_id: int, topic: str, run_idx: int,
		opinion_hash: str, summary: str, tokens: tuple) -> None:
	cur.execute("""INSERT INTO summary_result (person_id, topic, run_idx, opinion_hash, batch_id, model, prompt_version,
			summary, input_tokens, output_tokens, created_at)
		VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
		ON CONFLICT (person_id, topic, run_idx) DO UPDATE SET opinion_hash = EXCLUDED.opinion_hash,
			batch_id = EXCLUDED.batch_id, model = EXCLUDED.model, prompt_version = EXCLUDED.prompt_version,
			summary = EXCLUDED.summary, input_tokens = EXCLUDED.input_tokens, output_tokens = EXCLUDED.output_tokens,
			created_at = now()""",
		(person_id, topic, run_idx, opinion_hash, batch_id, model, prompt_version, summary, tokens[0], tokens[1]))


def summary_spend_month(cur) -> float:
	cur.execute("""SELECT coalesce(sum(cost_usd) FILTER (WHERE status = 'succeeded' AND finished_at >= %s), 0)
		+ coalesce(sum(cost_est) FILTER (WHERE status = 'submitted'), 0) FROM label_batch WHERE kind = 'summary'""",
		(ledger.month_start(),))
	return float(cur.fetchone()[0])
