"""Other names a person goes by (specs/speaker-review §3.5).

`person` holds one name per person, but people change names (marriage, a stage
name, kana instead of kanji: 山本譲司 / 山本ジョージ), and some rows carry a
disambiguating suffix that no record uses (`金子恵美（えみ）`). `person_alias`
lists the other names; the speech resolver and the member-list matcher treat
each one exactly like `person.name_kanji` / `name_kana`.

Rows are added by `python -m member_update alias add`, by `member_update merge`
(the dropped person's name) and by confirming a `kanji_differs` speaker review.
"""
from __future__ import annotations

from typing import Iterable, List, Optional, Tuple

KINDS = ("legal", "common", "former", "ndl", "other")

DDL = f"""
CREATE TABLE IF NOT EXISTS person_alias (
	id bigserial PRIMARY KEY,
	person_id bigint NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
	name_kanji text NOT NULL,
	name_kana text NOT NULL DEFAULT '',
	kind text NOT NULL DEFAULT 'other' CHECK (kind IN {KINDS}),
	source text,
	note text,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (person_id, name_kanji, name_kana)
);
COMMENT ON COLUMN person_alias.kind IS
	'legal: legal name when person uses another; common: name used in public; former: before a change; ndl: how the Diet record writes it';
"""


def ensure_table(cur) -> None:
	cur.execute(DDL)


def all_names(cur) -> List[Tuple[int, str, Optional[str]]]:
	"""(person_id, name_kanji, name_kana) for every person row, then every alias."""
	ensure_table(cur)
	cur.execute("SELECT person_id, name_kanji, name_kana FROM person ORDER BY person_id")
	rows = [(int(p), k, kn) for p, k, kn in cur.fetchall()]
	cur.execute("SELECT person_id, name_kanji, NULLIF(name_kana, '') FROM person_alias ORDER BY id")
	return rows + [(int(p), k, kn) for p, k, kn in cur.fetchall()]


def add(cur, person_id: int, name_kanji: str, name_kana: Optional[str] = None, kind: str = "other",
		source: Optional[str] = None, note: Optional[str] = None) -> bool:
	"""True if a new row was added (an existing name for that person is left alone)."""
	ensure_table(cur)
	cur.execute(
		"""INSERT INTO person_alias (person_id, name_kanji, name_kana, kind, source, note)
		VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
		(person_id, name_kanji, name_kana or "", kind, source, note),
	)
	return cur.rowcount == 1


def remove(cur, alias_id: int) -> bool:
	ensure_table(cur)
	cur.execute("DELETE FROM person_alias WHERE id = %s", (alias_id,))
	return cur.rowcount == 1


def listing(cur, person_ids: Iterable[int] = ()) -> List[tuple]:
	ensure_table(cur)
	ids = list(person_ids)
	cur.execute(
		"""SELECT a.id, a.person_id, p.name_kanji, a.name_kanji, a.name_kana, a.kind, a.source, a.note
		FROM person_alias a JOIN person p USING (person_id)
		WHERE %s OR a.person_id = ANY(%s) ORDER BY a.person_id, a.id""",
		(not ids, ids),
	)
	return cur.fetchall()
