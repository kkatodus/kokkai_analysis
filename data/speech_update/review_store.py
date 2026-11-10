"""Postgres tables for speaker review decisions (specs/speaker-review §3.2).

speaker_review        one row per (speaker, speaker_yomi, person_id, reason)
speaker_review_issue  which issues hold speeches for that row, with counts
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Iterable, List, NamedTuple, Optional, Set

from . import aliases

REASONS = ("kanji_differs", "election_pick", "out_of_term", "not_serving")
AUTO_NOTE = "auto: outside every elected term and not speaking as a member"
STATUSES = ("pending", "confirmed", "unlinked", "reassigned")
MAX_SAMPLES = 3

DDL = f"""
CREATE TABLE IF NOT EXISTS speaker_review (
	id bigserial PRIMARY KEY,
	speaker text NOT NULL,
	speaker_yomi text NOT NULL DEFAULT '',
	person_id bigint NOT NULL REFERENCES person(person_id),
	reason text NOT NULL CHECK (reason IN {REASONS}),
	status text NOT NULL DEFAULT 'pending' CHECK (status IN {STATUSES}),
	new_person_id bigint REFERENCES person(person_id),
	applied_person_id bigint REFERENCES person(person_id),
	note text,
	groups text[] NOT NULL DEFAULT '{{}}',
	positions text[] NOT NULL DEFAULT '{{}}',
	sample_speech_ids text[] NOT NULL DEFAULT '{{}}',
	first_seen timestamptz NOT NULL DEFAULT now(),
	decided_at timestamptz,
	applied_at timestamptz,
	UNIQUE (speaker, speaker_yomi, person_id, reason),
	CHECK ((status = 'reassigned') = (new_person_id IS NOT NULL))
);
COMMENT ON COLUMN speaker_review.applied_person_id IS
	'where the speeches are filed after the last apply (NULL = nowhere); a backlog row starts at person_id';
CREATE TABLE IF NOT EXISTS speaker_review_issue (
	review_id bigint NOT NULL REFERENCES speaker_review(id) ON DELETE CASCADE,
	issue_id text NOT NULL,
	speeches int NOT NULL,
	first_date date NOT NULL,
	last_date date NOT NULL,
	PRIMARY KEY (review_id, issue_id)
);
CREATE INDEX IF NOT EXISTS speaker_review_issue_issue_id ON speaker_review_issue (issue_id);
"""


class ReviewKey(NamedTuple):
	speaker: str
	speaker_yomi: str
	person_id: int
	reason: str


@dataclass(frozen=True)
class Decision:
	id: int
	status: str
	new_person_id: Optional[int] = None


@dataclass
class HeldItem:
	"""Speeches held for one ReviewKey during a route run."""
	issues: Dict[str, List] = field(default_factory=dict)  # issue_id → [speeches, first_date, last_date]
	groups: Set[str] = field(default_factory=set)
	positions: Set[str] = field(default_factory=set)
	samples: List[str] = field(default_factory=list)

	def add(self, speech: dict, meta: dict) -> None:
		d = meta["date"]
		entry = self.issues.setdefault(meta["issueID"], [0, d, d])
		entry[0] += 1
		entry[1], entry[2] = min(entry[1], d), max(entry[2], d)
		if speech.get("speakerGroup"):
			self.groups.add(speech["speakerGroup"])
		if speech.get("speakerPosition"):
			self.positions.add(speech["speakerPosition"])
		if len(self.samples) < MAX_SAMPLES and speech["speechID"] not in self.samples:
			self.samples.append(speech["speechID"])

	@property
	def speeches(self) -> int:
		return sum(e[0] for e in self.issues.values())


def table_exists(cur) -> bool:
	cur.execute("SELECT to_regclass('speaker_review') IS NOT NULL")
	return bool(cur.fetchone()[0])


def ensure_tables(conn) -> None:
	with conn.cursor() as cur:
		cur.execute(DDL)
	conn.commit()


def load_decisions(cur) -> Dict[ReviewKey, Decision]:
	if not table_exists(cur):
		return {}
	cur.execute("SELECT id, speaker, speaker_yomi, person_id, reason, status, new_person_id FROM speaker_review")
	return {
		ReviewKey(speaker, yomi, int(pid), reason): Decision(int(rid), status, int(new_pid) if new_pid else None)
		for rid, speaker, yomi, pid, reason, status, new_pid in cur.fetchall()
	}


def record_held(conn, held: Dict[ReviewKey, HeldItem], routed_issues: Iterable[str], backlog: bool = False,
		dropped: Optional[Dict[ReviewKey, HeldItem]] = None, decided: Optional[Dict[ReviewKey, HeldItem]] = None) -> List[ReviewKey]:
	"""Upsert held speeches as pending rows, and `dropped` (not_serving) ones as rows already
	decided `unlinked`. Pending rows' issue links for `routed_issues` are replaced, so a
	re-routed issue drops speeches that no longer need review.
	`backlog=True` (review scan): the speeches are already filed under person_id, so dropped
	rows are left unapplied for `apply` to remove them.
	`decided`: speeches that resolved through an existing decision; only their issue links
	are recorded.
	Returns the pending keys that weren't in the table before."""
	from psycopg2.extras import execute_values

	ensure_tables(conn)
	routed = sorted(set(routed_issues))
	new_keys: List[ReviewKey] = []
	with conn.cursor() as cur:
		if routed:
			cur.execute(
				"DELETE FROM speaker_review_issue WHERE issue_id = ANY(%s) AND review_id IN "
				"(SELECT id FROM speaker_review WHERE status = 'pending')",
				(routed,),
			)
		issue_rows = []
		items = [(k, v, "pending") for k, v in held.items()] + [(k, v, "unlinked") for k, v in (dropped or {}).items()]
		for key, item, status in items:
			auto = status == "unlinked"
			cur.execute(
				"""INSERT INTO speaker_review (speaker, speaker_yomi, person_id, reason, groups, positions, sample_speech_ids,
					applied_person_id, status, note, decided_at, applied_at)
				VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
					CASE WHEN %s THEN now() END, CASE WHEN %s AND NOT %s THEN now() END)
				ON CONFLICT (speaker, speaker_yomi, person_id, reason) DO UPDATE SET
					groups = ARRAY(SELECT DISTINCT unnest(speaker_review.groups || EXCLUDED.groups) ORDER BY 1),
					positions = ARRAY(SELECT DISTINCT unnest(speaker_review.positions || EXCLUDED.positions) ORDER BY 1),
					sample_speech_ids = CASE WHEN cardinality(speaker_review.sample_speech_ids) > 0
						THEN speaker_review.sample_speech_ids ELSE EXCLUDED.sample_speech_ids END
				RETURNING id, (xmax = 0)""",
				(*key, sorted(item.groups), sorted(item.positions), item.samples, key.person_id if backlog else None,
				 status, AUTO_NOTE if auto else None, auto, auto, backlog),
			)
			review_id, inserted = cur.fetchone()
			if inserted and not auto:
				new_keys.append(key)
			issue_rows.extend((review_id, issue_id, n, first, last) for issue_id, (n, first, last) in item.issues.items())
		for key, item in (decided or {}).items():
			cur.execute(
				"SELECT id FROM speaker_review WHERE speaker = %s AND speaker_yomi = %s AND person_id = %s AND reason = %s", key)
			row = cur.fetchone()
			if row:
				issue_rows.extend((row[0], issue_id, n, first, last) for issue_id, (n, first, last) in item.issues.items())
		if issue_rows:
			execute_values(
				cur,
				"""INSERT INTO speaker_review_issue (review_id, issue_id, speeches, first_date, last_date) VALUES %s
				ON CONFLICT (review_id, issue_id) DO UPDATE SET
					speeches = EXCLUDED.speeches, first_date = EXCLUDED.first_date, last_date = EXCLUDED.last_date""",
				issue_rows, page_size=1000,
			)
	conn.commit()
	return new_keys


SUMMARY_SQL = """
SELECT r.id, r.speaker, r.speaker_yomi, r.person_id, p.name_kanji, p.name_kana, r.reason, r.status,
	r.new_person_id, r.applied_person_id, r.note, r.groups, r.positions, r.sample_speech_ids,
	coalesce(sum(i.speeches), 0) AS speeches, count(i.issue_id) AS issues,
	min(i.first_date) AS first_date, max(i.last_date) AS last_date, r.decided_at, r.applied_at
FROM speaker_review r
JOIN person p ON p.person_id = r.person_id
LEFT JOIN speaker_review_issue i ON i.review_id = r.id
{where}
GROUP BY r.id, p.person_id
{having}
ORDER BY speeches DESC, r.id
"""


def summaries(cur, status: Optional[str] = "pending", reason: Optional[str] = None, ids: Optional[List[int]] = None) -> List[dict]:
	clauses, params = [], []
	if status:
		clauses.append("r.status = %s")
		params.append(status)
	if reason:
		clauses.append("r.reason = %s")
		params.append(reason)
	if ids is not None:
		clauses.append("r.id = ANY(%s)")
		params.append(list(ids))
	where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
	# pending rows whose speeches all resolved elsewhere since are not worth showing
	having = "HAVING coalesce(sum(i.speeches), 0) > 0" if status == "pending" else ""
	cur.execute(SUMMARY_SQL.format(where=where, having=having), params)
	cols = [c.name for c in cur.description]
	return [dict(zip(cols, row)) for row in cur.fetchall()]


def decide(conn, review_id: int, status: str, new_person_id: Optional[int] = None, note: Optional[str] = None) -> None:
	if status not in ("confirmed", "unlinked", "reassigned"):
		raise ValueError(f"bad decision: {status}")
	if (status == "reassigned") != (new_person_id is not None):
		raise ValueError("reassigned needs a person id (and only reassigned takes one)")
	with conn.cursor() as cur:
		cur.execute("SELECT person_id, reason, speaker, speaker_yomi FROM speaker_review WHERE id = %s", (review_id,))
		row = cur.fetchone()
		if row is None:
			raise ValueError(f"no review item {review_id}")
		if new_person_id is not None:
			if new_person_id == row[0]:
				raise ValueError("reassigning to the same person; use confirm")
			cur.execute("SELECT 1 FROM person WHERE person_id = %s", (new_person_id,))
			if cur.fetchone() is None:
				raise ValueError(f"no person {new_person_id}")
		cur.execute(
			"UPDATE speaker_review SET status = %s, new_person_id = %s, note = coalesce(%s, note), "
			"decided_at = now(), applied_at = NULL WHERE id = %s",
			(status, new_person_id, note, review_id),
		)
		if status == "confirmed" and row[1] == "kanji_differs":
			# the record's spelling is another name for this person (specs/speaker-review §3.5)
			aliases.add(cur, row[0], row[2], row[3], "ndl", f"speaker_review #{review_id}")
	conn.commit()


def to_apply(cur) -> List[dict]:
	if not table_exists(cur):
		return []
	return summaries(cur, status=None, ids=_unapplied_ids(cur))


def _unapplied_ids(cur) -> List[int]:
	cur.execute("SELECT id FROM speaker_review WHERE status <> 'pending' AND applied_at IS NULL")
	return [int(r[0]) for r in cur.fetchall()]


def issues_for(cur, review_ids: List[int]) -> List[str]:
	cur.execute("SELECT DISTINCT issue_id FROM speaker_review_issue WHERE review_id = ANY(%s) ORDER BY 1", (list(review_ids),))
	return [r[0] for r in cur.fetchall()]


def mark_applied(conn, targets: Dict[int, Optional[int]]) -> None:
	"""targets: review id → person_id the speeches now live under (None = unlinked)."""
	with conn.cursor() as cur:
		for review_id, pid in targets.items():
			cur.execute(
				"UPDATE speaker_review SET applied_at = now(), applied_person_id = %s WHERE id = %s",
				(pid, review_id),
			)
	conn.commit()


def pending_count(cur) -> int:
	if not table_exists(cur):
		return 0
	cur.execute(
		"SELECT count(*) FROM speaker_review r WHERE status = 'pending' "
		"AND EXISTS (SELECT 1 FROM speaker_review_issue i WHERE i.review_id = r.id)"
	)
	return int(cur.fetchone()[0])

