"""Add a member to Postgres `person` / `election_result` and the S3 mirror files.

Input is the same JSON the earlier collectors produced (collect_all_repr_list):

  {"name_kanji": "木村義雄", "name_kana": "きむらよしお",
   "election_data": [{"year": "1986年", "month": "7月", "day": "6日",
                      "election_name": "第38回衆議院議員総選挙", "district": "香川2区",
                      "party": "自由民主党", "result": "当選", "election_freq": "（1回目）"}, …]}

Writes electionHistory/<id>.jsonl (raw_json rows by date, as for every other
person) and appends a row to politicians/table.csv(.gz). Only new ids are
written; existing files are never regenerated.
"""
from __future__ import annotations

import gzip
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from dbio.representative_db import generate_election_signature, parse_election_date, upsert_person_and_elections
from speech_update.state import write_atomic
from speech_update.variants import normalise_name

ELECTION_KEYS = ("year", "month", "day", "election_name", "district", "party", "result", "election_freq")
HIRAGANA = re.compile(r"^[ぁ-ゖー]+$")


class InvalidPerson(ValueError):
	pass


def load_person_file(path: Path) -> dict:
	raw = json.loads(path.read_text(encoding="utf-8"))
	return validate(raw)


def validate(raw: dict) -> dict:
	errors: List[str] = []
	kanji = re.sub(r"[\s　]+", "", raw.get("name_kanji") or "")
	kana = re.sub(r"[\s　]+", "", raw.get("name_kana") or "")
	if not kanji:
		errors.append("name_kanji is empty")
	if not HIRAGANA.match(kana):
		errors.append(f"name_kana must be hiragana without spaces, got {kana!r}")
	elections = raw.get("election_data")
	if not isinstance(elections, list) or not elections:
		errors.append("election_data must be a non-empty list (verify the history before adding)")
		elections = []
	for i, e in enumerate(elections):
		missing = [k for k in ELECTION_KEYS if k not in e]
		if missing:
			errors.append(f"election_data[{i}] is missing {missing}")
			continue
		if not re.fullmatch(r"\d{4}年", e["year"]) or not re.fullmatch(r"\d{1,2}月", e["month"]) or not re.fullmatch(r"\d{1,2}日", e["day"]):
			errors.append(f"election_data[{i}] date must look like 2026年 / 2月 / 8日, got {e['year']} {e['month']} {e['day']}")
			continue
		try:
			parse_election_date(e["year"], e["month"], e["day"])
		except ValueError as err:
			errors.append(f"election_data[{i}] bad date: {err}")
	if errors:
		raise InvalidPerson("; ".join(errors))
	# keep only the known keys, in the collector's order
	return {
		"name_kanji": kanji,
		"name_kana": kana,
		"election_data": [{k: e[k] for k in ELECTION_KEYS} for e in elections],
	}


def find_existing(cur, raw: dict) -> List[Tuple[int, str, str]]:
	"""People who already have this name or this reading."""
	cur.execute("SELECT person_id, name_kanji, name_kana FROM person")
	name, kana = normalise_name(raw["name_kanji"]), normalise_name(raw["name_kana"])
	return [
		(pid, k, kn) for pid, k, kn in cur.fetchall()
		if normalise_name(k) == name or normalise_name(kn) == kana
	]


def history_lines(cur, person_id: int) -> str:
	# election_result.raw_json comes back with jsonb's key order, which is what the
	# existing electionHistory files use
	cur.execute("SELECT raw_json FROM election_result WHERE person_id = %s ORDER BY election_date, id", (person_id,))
	return "".join(json.dumps(r[0], ensure_ascii=False) + "\n" for r in cur.fetchall())


def csv_field(value) -> str:
	# table.csv quotes a field iff it starts with a digit (as the original export did)
	s = "" if value is None else str(value)
	if any(c in s for c in ',"\r\n'):
		return '"' + s.replace('"', '""') + '"'
	return f'"{s}"' if s[:1].isdigit() else s


def table_row(person_id: int, name_kanji: str, name_kana: str, signature: str) -> str:
	return f"{person_id},{csv_field(name_kanji)},{csv_field(name_kana)},{csv_field(signature)}\r\n"


def append_table_row(table_csv: Path, row: str, backup_dir: Path) -> None:
	backup_dir.mkdir(parents=True, exist_ok=True)
	stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
	shutil.copy2(table_csv, backup_dir / f"table-{stamp}.csv")
	text = table_csv.read_text(encoding="utf-8", newline="")
	if not text.endswith("\r\n"):
		text += "\r\n"
	text += row
	write_atomic_bytes(table_csv, text.encode("utf-8"))
	write_atomic_bytes(table_csv.with_name(table_csv.name + ".gz"), gzip.compress(text.encode("utf-8"), mtime=0))


def write_atomic_bytes(path: Path, data: bytes) -> None:
	tmp = path.with_name(path.name + ".tmp")
	tmp.write_bytes(data)
	tmp.replace(path)


def add_person(conn, raw: dict, history_dir: Path, table_csv: Path, backup_dir: Path, dry_run: bool = False) -> Tuple[Optional[int], List[str]]:
	"""Insert, then write the mirror files. Returns (person_id, mirror paths written)."""
	signature = generate_election_signature(raw)
	if dry_run:
		return None, []
	with conn:
		with conn.cursor() as cur:
			person_id = upsert_person_and_elections(cur, raw)
			lines = history_lines(cur, person_id)
	history = history_dir / f"{person_id}.jsonl"
	if history.exists():
		raise RuntimeError(f"{history} already exists; person {person_id} was not new")
	write_atomic(history, lines)
	append_table_row(table_csv, table_row(person_id, raw["name_kanji"], raw["name_kana"], signature), backup_dir)
	rel = lambda p: str(p.relative_to(history_dir.parent))
	return person_id, [rel(history), rel(table_csv), rel(table_csv.with_name(table_csv.name + ".gz"))]
