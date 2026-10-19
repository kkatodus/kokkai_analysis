"""Spend ledger for exchange labels (specs/speech-quality-labels §4.5), in Postgres.

label_price    dated batch prices per model, so a price change needs no code change
label_batch    one Gemini batch job: estimate when submitted, actual tokens and cost when collected
label_request  which exchanges went into which batch
label_result   the current label of each exchange, keyed by its first speech
label_alert    spend thresholds already announced this month

Monthly spend = actual cost of batches collected this month + estimates of batches in flight.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Dict, Iterable, Optional, Set, Tuple

DDL = """
CREATE TABLE IF NOT EXISTS label_price (
	model text NOT NULL,
	valid_from date NOT NULL,
	input_per_m numeric NOT NULL,
	output_per_m numeric NOT NULL,
	PRIMARY KEY (model, valid_from)
);
CREATE TABLE IF NOT EXISTS label_batch (
	id bigserial PRIMARY KEY,
	name text UNIQUE,
	model text NOT NULL,
	prompt_version text NOT NULL,
	kind text NOT NULL CHECK (kind IN ('new', 'backlog')),
	status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'succeeded', 'failed')),
	submitted_at timestamptz NOT NULL DEFAULT now(),
	finished_at timestamptz,
	exchanges int NOT NULL,
	newest_date date,
	oldest_date date,
	input_tokens_est bigint NOT NULL,
	cost_est numeric NOT NULL,
	input_tokens bigint,
	output_tokens bigint,
	cost_usd numeric,
	labelled int,
	error text
);
CREATE TABLE IF NOT EXISTS label_request (
	batch_id bigint NOT NULL REFERENCES label_batch(id) ON DELETE CASCADE,
	start_speech_id text NOT NULL,
	issue_id text NOT NULL,
	content_hash text NOT NULL,
	PRIMARY KEY (batch_id, start_speech_id)
);
CREATE TABLE IF NOT EXISTS label_result (
	start_speech_id text PRIMARY KEY,
	issue_id text NOT NULL,
	exchange_index int NOT NULL,
	speech_ids text[] NOT NULL,
	date date NOT NULL,
	questioner text NOT NULL,
	questioner_person_id bigint,
	answerer_person_ids bigint[],
	batch_id bigint REFERENCES label_batch(id) ON DELETE SET NULL,
	model text NOT NULL,
	prompt_version text NOT NULL,
	content_hash text NOT NULL,
	function text NOT NULL,
	contribution text NOT NULL,
	issues jsonb NOT NULL,
	responsible text NOT NULL,
	outcomes text[] NOT NULL,
	topic text NOT NULL,
	reason text NOT NULL,
	input_tokens int,
	output_tokens int,
	labelled_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS label_result_issue ON label_result (issue_id);
CREATE INDEX IF NOT EXISTS label_result_questioner ON label_result (questioner_person_id);
CREATE TABLE IF NOT EXISTS label_alert (
	month date NOT NULL,
	threshold int NOT NULL,
	sent_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (month, threshold)
);
"""

# Batch prices per 1M tokens (ai.google.dev pricing, checked 2026-10-17; spec §4.4)
PRICES = [
	("gemini-3.8-flash", "2026-01-01", 0.375, 1.875),
	("gemini-3.8-flash", "2027-01-01", 0.75, 3.75),
	("gemini-3.5-flash-lite", "2026-01-01", 0.15, 1.25),
]


def ensure(cur) -> None:
	cur.execute("SET TIME ZONE 'Asia/Tokyo'")  # months and the status listing are in JST
	cur.execute(DDL)
	cur.executemany(
		"INSERT INTO label_price VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING", PRICES)


def price(cur, model: str, day: date) -> Tuple[float, float]:
	cur.execute(
		"""SELECT input_per_m, output_per_m FROM label_price
		WHERE model = %s AND valid_from <= %s ORDER BY valid_from DESC LIMIT 1""",
		(model, day),
	)
	row = cur.fetchone()
	if not row:
		raise RuntimeError(f"no label_price row for {model} on {day}")
	return float(row[0]), float(row[1])


def cost(cur, model: str, day: date, input_tokens: float, output_tokens: float) -> float:
	pin, pout = price(cur, model, day)
	return (input_tokens * pin + output_tokens * pout) / 1e6


def month_start(today: Optional[date] = None) -> date:
	return (today or date.today()).replace(day=1)


def month_spend(cur, today: Optional[date] = None) -> float:
	"""Actual cost collected this month + estimates of batches still in flight."""
	start = month_start(today)
	cur.execute(
		"""SELECT coalesce(sum(cost_usd) FILTER (WHERE status = 'succeeded' AND finished_at >= %s), 0)
		        + coalesce(sum(cost_est) FILTER (WHERE status = 'submitted'), 0)
		FROM label_batch""",
		(start,),
	)
	return float(cur.fetchone()[0])


def in_flight(cur, kind: Optional[str] = None) -> int:
	cur.execute(
		"SELECT count(*) FROM label_batch WHERE status = 'submitted' AND (%s IS NULL OR kind = %s)", (kind, kind))
	return cur.fetchone()[0]


def done_and_pending(cur, prompt_version: str) -> Tuple[Dict[str, str], Set[str]]:
	"""(start_speech_id → content_hash of exchanges labelled with this prompt, start ids in flight)."""
	cur.execute("SELECT start_speech_id, content_hash FROM label_result WHERE prompt_version = %s", (prompt_version,))
	done = dict(cur.fetchall())
	cur.execute(
		"""SELECT r.start_speech_id FROM label_request r JOIN label_batch b ON b.id = r.batch_id
		WHERE b.status = 'submitted'""")
	return done, {r[0] for r in cur.fetchall()}


def alerts_sent(cur, today: Optional[date] = None) -> Set[int]:
	cur.execute("SELECT threshold FROM label_alert WHERE month = %s", (month_start(today),))
	return {r[0] for r in cur.fetchall()}


def mark_alert(cur, threshold: int, today: Optional[date] = None) -> None:
	cur.execute("INSERT INTO label_alert (month, threshold) VALUES (%s, %s) ON CONFLICT DO NOTHING", (month_start(today), threshold))


def person_ids(cur, speech_ids: Iterable[str]) -> Dict[str, int]:
	ids = list(speech_ids)
	if not ids:
		return {}
	cur.execute("SELECT speech_id, person_id FROM speeches WHERE speech_id = ANY(%s)", (ids,))
	return dict(cur.fetchall())


def now() -> datetime:
	return datetime.now().astimezone()
