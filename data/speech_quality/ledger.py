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
	provider text NOT NULL DEFAULT 'gemini',
	threshold int NOT NULL,
	sent_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (month, provider, threshold)
);
"""

# Batch prices per 1M tokens: Gemini from ai.google.dev (checked 2026-10-17; spec §4.4), Claude at
# half the Messages API list price (platform.claude.com, checked 2026-10-22; Haiku's is for prompts under 100K).
PRICES = [
	("gemini-3.8-flash", "2026-01-01", 0.375, 1.875),
	("gemini-3.8-flash", "2027-01-01", 0.75, 3.75),
	("gemini-3.5-flash-lite", "2026-01-01", 0.15, 1.25),
	("claude-opus-5-5", "2026-01-01", 2.00, 10.00),
	("claude-sonnet-5-5", "2026-01-01", 1.00, 5.00),
	("claude-haiku-5-5", "2026-01-01", 0.05, 0.25),
]
# Prompt-cache multipliers on the input price: reads 0.1× (0.05× on Opus 5.5), writes 1.25× (5-minute TTL).
CACHE_READ_MULT = {"claude-opus-5-5": 0.05}
CACHE_READ_DEFAULT = 0.1
CACHE_WRITE_MULT = 1.25


def ensure(cur) -> None:
	cur.execute("SET TIME ZONE 'Asia/Tokyo'")  # months and the status listing are in JST
	cur.execute(DDL)
	cur.executemany(
		"INSERT INTO label_price VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING", PRICES)
	# 2026-10-22: alerts became per provider (Claude credits and Gemini money have separate caps)
	cur.execute("SELECT 1 FROM information_schema.columns WHERE table_name = 'label_alert' AND column_name = 'provider'")
	if not cur.fetchone():
		cur.execute("ALTER TABLE label_alert ADD COLUMN provider text NOT NULL DEFAULT 'gemini'")
		cur.execute("ALTER TABLE label_alert DROP CONSTRAINT label_alert_pkey")
		cur.execute("ALTER TABLE label_alert ADD PRIMARY KEY (month, provider, threshold)")


def provider_of(model: str) -> str:
	return "claude" if model.startswith("claude-") else "gemini"


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


def cost(cur, model: str, day: date, input_tokens: float, output_tokens: float, cache_read: float = 0,
		cache_write: float = 0) -> float:
	"""`input_tokens` is everything billed as input; cached reads/writes within it are repriced."""
	pin, pout = price(cur, model, day)
	plain = input_tokens - cache_read - cache_write
	read_mult = CACHE_READ_MULT.get(model, CACHE_READ_DEFAULT)
	return (plain * pin + cache_read * pin * read_mult + cache_write * pin * CACHE_WRITE_MULT + output_tokens * pout) / 1e6


def month_start(today: Optional[date] = None) -> date:
	return (today or date.today()).replace(day=1)


def month_spend(cur, today: Optional[date] = None, provider: Optional[str] = None) -> float:
	"""Actual cost collected this month + estimates of batches still in flight, for one provider or all."""
	start = month_start(today)
	like = f"{provider}-%" if provider else "%"
	cur.execute(
		"""SELECT coalesce(sum(cost_usd) FILTER (WHERE status = 'succeeded' AND finished_at >= %s), 0)
		        + coalesce(sum(cost_est) FILTER (WHERE status = 'submitted'), 0)
		FROM label_batch WHERE model LIKE %s""",
		(start, like),
	)
	return float(cur.fetchone()[0])


def spend_by_provider(cur, today: Optional[date] = None) -> Dict[str, float]:
	return {p: month_spend(cur, today, p) for p in ("claude", "gemini")}


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


def alerts_sent(cur, provider: str, today: Optional[date] = None) -> Set[int]:
	cur.execute("SELECT threshold FROM label_alert WHERE month = %s AND provider = %s", (month_start(today), provider))
	return {r[0] for r in cur.fetchall()}


def mark_alert(cur, provider: str, threshold: int, today: Optional[date] = None) -> None:
	cur.execute("INSERT INTO label_alert (month, provider, threshold) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
		(month_start(today), provider, threshold))


def spend_line(spend: Dict[str, float], caps: Dict[str, float], today: Optional[date] = None) -> str:
	"""'October: Claude $12.00 of $1000 (1%) · Gemini $29.08 of $100 (29%)'."""
	parts = []
	for p in ("claude", "gemini"):
		cap = caps.get(p, 0)
		pct = 100 * spend.get(p, 0) / cap if cap else 0
		parts.append(f"{p.capitalize()} ${spend.get(p, 0):.2f} of ${cap:.0f} ({pct:.0f}%)")
	return f"{(today or date.today()):%B}: " + " · ".join(parts)


def person_ids(cur, speech_ids: Iterable[str]) -> Dict[str, int]:
	ids = list(speech_ids)
	if not ids:
		return {}
	cur.execute("SELECT speech_id, person_id FROM speeches WHERE speech_id = ANY(%s)", (ids,))
	return dict(cur.fetchall())


def now() -> datetime:
	return datetime.now().astimezone()
