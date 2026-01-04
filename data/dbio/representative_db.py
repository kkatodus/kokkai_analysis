from __future__ import annotations

import os
import re
import json
import hashlib
from dataclasses import dataclass
from datetime import date
from typing import Iterator, List, Optional, TypedDict, NewType, Literal, Any

import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from collections import Counter
from utils.string_process import clean_repr_name

PersonId = NewType("PersonId", int)

DIGITS = re.compile(r"\d+")

def _parse_int(s: str) -> Optional[int]:
    m = DIGITS.search(s)
    return int(m.group(0)) if m else None

def parse_election_date(y: str, m: str, d: str) -> date:
    yy = _parse_int(y) or 1
    mm = _parse_int(m) or 1
    dd = _parse_int(d) or 1
    return date(yy, mm, dd)

def parse_election_number(freq: str) -> Optional[int]:
    # "（1回目）" -> 1
    return _parse_int(freq)

def generate_election_signature(raw: RawPersonFile) -> str:
    # Deterministic: hash sorted key/value pairs of the FIRST election entry
    # (Adjust to include more entries if you want a stronger signature)
    if not raw["election_data"]:
        base = f"{raw['name_kanji']}|{raw['name_kana']}|no_elections"
    else:
        first = raw["election_data"][0]
        parts = [f"{k}:{first[k]}" for k in sorted(first.keys())]
        base = f"{raw['name_kanji']}|{raw['name_kana']}|" + "|".join(parts)
    return hashlib.sha256(base.encode("utf-8")).hexdigest()

DDL: list[str] = [
    """CREATE TABLE IF NOT EXISTS person (
        person_id BIGSERIAL PRIMARY KEY,
        name_kanji TEXT NOT NULL,
        name_kana  TEXT,
        election_signature TEXT,
        CONSTRAINT uq_person UNIQUE (name_kanji, name_kana, election_signature)
    );""",
    """CREATE TABLE IF NOT EXISTS election_result (
        id BIGSERIAL PRIMARY KEY,
        person_id BIGINT NOT NULL REFERENCES person(person_id),
        election_date DATE NOT NULL,
        election_name TEXT,
        district TEXT,
        party TEXT,
        result TEXT,
        election_number INT,
        raw_json JSONB,
        CONSTRAINT uq_election UNIQUE (person_id, election_date, election_name, district, party)
    );""",
    """
    CREATE TABLE IF NOT EXISTS x_account (
        person_id BIGINT PRIMARY KEY REFERENCES person(person_id),
        account_id TEXT NOT NULL,
        CONSTRAINT uq_person_account UNIQUE (account_id, person_id)
    );
    """,
	"""
	CREATE TABLE IF NOT EXISTS speeches (
		issue_id TEXT NOT NULL,
		name_of_house TEXT NOT NULL,
		name_of_meeting TEXT NOT NULL,
		date DATE NOT NULL,
		pdf_url TEXT,
		speech_id TEXT PRIMARY KEY,
		speaker TEXT NOT NULL,
		speech TEXT NOT NULL,
		speech_url TEXT NOT NULL,
		person_id BIGINT NOT NULL REFERENCES person(person_id)
		
	);
	"""
]

class RawElection(TypedDict):
    year: str          # e.g., "1952年"
    month: str         # e.g., "10月"
    day: str           # e.g., "1日"
    election_name: str
    district: str
    party: str
    result: str        # e.g., "当選"
    election_freq: str # e.g., "（1回目）"

class RawPersonFile(TypedDict):
    name_kanji: str
    name_kana: str
    election_data: List[RawElection]

@dataclass(frozen=True)
class Person:

    name_kanji: str
    name_kana: str
    election_signature: str
    person_id: Optional[PersonId] = None

    def __str__(self) -> str:
        return f"{self.person_id}-{self.name_kanji} ({self.name_kana})"

@dataclass(frozen=True)
class PersonMatch:
    person: Person
    score: float

    def __str__(self) -> str:
        return f"{self.person.person_id}-{self.person.name_kanji} ({self.person.name_kana}) - {self.score}"

@dataclass(frozen=True)
class ElectionResult:
    person_id: PersonId
    election_date: date
    election_name: str
    district: str
    party: str
    result: str
    election_number: Optional[int]  # parsed from "（1回目）"
    raw_json: dict[str, Any]

    def __str__(self) -> str:
        return f"Election date: {self.election_date} Election name: {self.election_name} District: {self.district} Party: {self.party} Result: {self.result} ({self.election_number})"

@dataclass(frozen=True)
class XAccount:
    person_id: PersonId
    account_id: str

@dataclass(frozen=True)
class Speech:
	issue_id: str
	name_of_house:str
	name_of_meeting:str
	date: str
	pdf_url:str
	speech_id:str
	speaker: str
	speech: str
	speech_url:str
	person_id: PersonId
# ---------- DB ops ----------
def run_ddl(cur: psycopg2.extensions.cursor) -> None:
    for stmt in DDL:
        cur.execute(stmt)
        

def insert_person(cur: psycopg2.extensions.cursor, p: Person) -> PersonId:
    cur.execute(
        """
        INSERT INTO person (name_kanji, name_kana, election_signature)
        VALUES (%s, %s, %s)
        ON CONFLICT (name_kanji, name_kana, election_signature) DO UPDATE
        SET name_kana = EXCLUDED.name_kana
        RETURNING person_id;
        """,
        (p.name_kanji, p.name_kana, p.election_signature),
    )
    pid = cur.fetchone()[0]
    return PersonId(pid)

def insert_elections_bulk(cur: psycopg2.extensions.cursor, rows: list[ElectionResult]) -> None:
    if not rows:
        return
    execute_values(
        cur,
        """
        INSERT INTO election_result (
            person_id, election_date, election_name, district, party, result, election_number, raw_json
        )
        VALUES %s
        ON CONFLICT DO NOTHING;
        """,
        [
            (
                int(r.person_id),
                r.election_date,
                r.election_name,
                r.district,
                r.party,
                r.result,
                r.election_number,
                json.dumps(r.raw_json)
            )
            for r in rows
        ],
    )

def insert_speeches_bulk(cur: psycopg2.extensions.cursor, rows: list[Speech]) -> None:
	if not rows:
		return
	execute_values(
		cur,
		"""
		INSERT INTO speeches
		(issue_id, name_of_house, name_of_meeting, date, pdf_url, speech_id, speaker, speech, speech_url, person_id)
		VALUES %s
		ON CONFLICT DO NOTHING;
		""",
		[
			(
				s.issue_id,
				s.name_of_house,
				s.name_of_meeting,
				s.date,
				s.pdf_url,
				s.speech_id,
				s.speaker,
				s.speech,
				s.speech_url,
				s.person_id
			)
			for s in rows
		],
	)
	print(f"Inserted {len(rows)} speeches")
    

def upsert_person_and_elections(cur: psycopg2.extensions.cursor, raw: RawPersonFile) -> None:
    sig = generate_election_signature(raw)
    person = Person(
        name_kanji=raw["name_kanji"],
        name_kana=raw["name_kana"],
        election_signature=sig,
    )
    pid = insert_person(cur, person)

    results: list[ElectionResult] = []
    for e in raw["election_data"]:
        results.append(
            ElectionResult(
                person_id=pid,
                election_date=parse_election_date(e["year"], e["month"], e["day"]),
                election_name=e["election_name"],
                district=e["district"],
                party=e["party"],
                result=e["result"],
                election_number=parse_election_number(e["election_freq"]),
                raw_json=e,
            )
        )
    insert_elections_bulk(cur, results)

def insert_x_account(cur: psycopg2.extensions.cursor, person_id: PersonId, account_id: str) -> None:
    cur.execute(
        """
        INSERT INTO x_account (person_id, account_id)
        VALUES (%s, %s)
        ON CONFLICT (person_id) DO UPDATE
            SET account_id = EXCLUDED.account_id;
        """,
        (int(person_id), account_id),
    )

# reading from DB
def iterate_all_persons(cur: psycopg2.extensions.cursor) -> Iterator[Person]:
    cur.execute("SELECT person_id, name_kanji, name_kana, election_signature FROM person;")
    for row in cur.fetchall():
        yield Person(
            person_id=row[0],
            name_kanji=row[1],
            name_kana=row[2],
            election_signature=row[3]
        )

def get_election_result_by_person_id(cur: psycopg2.extensions.cursor, person_id: PersonId) -> List[ElectionResult]:
    cur.execute(
        """
        SELECT election_date, election_name, district, party, result, election_number, raw_json
        FROM election_result
        WHERE person_id = %s
        ORDER BY election_date;
        """,
        (int(person_id),)
    )
    results = []
    for row in cur.fetchall():
        results.append(
            ElectionResult(
                person_id=person_id,
                election_date=row[0],
                election_name=row[1],
                district=row[2],
                party=row[3],
                result=row[4],
                election_number=row[5],
                raw_json=row[6],
            )
        )
    return sorted(results, key=lambda x: x.election_date)

def get_x_account_by_person_id(cur: psycopg2.extensions.cursor, person_id: PersonId) -> Optional[str]:
    cur.execute(
        """
        SELECT account_id
        FROM x_account
        WHERE person_id = %s;
        """,
        (int(person_id),)
    )
    row = cur.fetchone()
    if row and row[0] != '' and row[0] is not None:
        return XAccount(
            person_id=person_id,
            account_id=row[0]
        )
    return None

def get_by_x_account(cur: psycopg2.extensions.cursor, account_id: str) -> Optional[XAccount]:
    cur.execute(
        """
        SELECT person_id, account_id
        FROM x_account
        WHERE account_id = %s;
        """,
        (account_id,)
    )
    row = cur.fetchone()
    if row:
        return XAccount(
            person_id=PersonId(row[0]),
            account_id=row[1]
        )
    return None

def get_person_by_column(cur: psycopg2.extensions.cursor, column: Literal["person_id", "name_kana", "name_kanji", "election_signature"], value: Any) -> Optional[Person]:
    query = f"""
        SELECT person_id, name_kanji, name_kana, election_signature
        FROM person
        WHERE {column} = %s;
    """
    cur.execute(query, (value,))
    rows = cur.fetchall()
    return_array = []
    for row in rows: 
        return_array.append(Person(
            person_id=row[0],
            name_kanji=row[1],
            name_kana=row[2],
            election_signature=row[3]
        ))
    return return_array

def get_closest_person_by_name(cur: psycopg2.extensions.cursor, name: str, limit: int = 30) -> Optional[Person]:
	query = """
		WITH q AS (
			SELECT regexp_replace(%s, '[[:space:]\u3000]+', '', 'g') AS query_norm
		)
		SELECT
			person_id,
			name_kanji,
			name_kana,
			election_signature,
			similarity(
				regexp_replace(coalesce(name_kanji,'') || coalesce(name_kana,''), '[[:space:]\u3000]+', '', 'g'),
				q.query_norm
			) AS score
		FROM person, q
		ORDER BY score DESC
		LIMIT %s;
	"""
	cur.execute(query, (name, limit))
	rows = cur.fetchall()
	return_array = []
	for row in rows:
		return_array.append(PersonMatch(
			person=Person(
				person_id=PersonId(row[0]),
				name_kanji=row[1],
				name_kana=row[2],
				election_signature=row[3],
			),
			score=float(row[4])
		))
	return_array.sort(key=lambda x: x.score, reverse=True)
	return return_array

def get_politician_id_by_name(cur: psycopg2.extensions.cursor, name_kanji: str, name_kana: str, party: str, stop_for_input: bool = True) -> Optional[PersonId]:
	repr_name_clean = clean_repr_name(name_kanji)
	print("Working on ", name_kanji)
	person = get_person_by_column(cur, "name_kanji", repr_name_clean)
	hiragana_person = get_person_by_column(cur, "name_kana", clean_repr_name(name_kana))
	if len(person) > 1:
		if not stop_for_input:
			return None
		print(f"{name_kanji} ({name_kana}) is found in multiple persons.")
		print(f"{party}")
		for idx, p in enumerate(person):
			print(f"{idx}: {name_kanji} ({name_kana})")
			election_result = get_election_result_by_person_id(cur, p.person_id)
			print("\n".join([str(e) for e in election_result]))
	
		selected_idx = int(input(f"{name_kanji} ({name_kana}) is found in multiple persons. Please select the correct one: "))
		return person[selected_idx].person_id

	elif len(person) == 1:
		return person[0].person_id

	elif len(hiragana_person) == 1:
		return hiragana_person[0].person_id
	else:
		if not stop_for_input:
			return None
		candidates = get_closest_person_by_name(cur, clean_repr_name(name_kanji))
		if len(candidates) == 0:
			raise ValueError(f"No person found for {name_kanji} ({name_kana})")
		for idx, candidate in enumerate(candidates):
			print(idx, candidate)
		selected_idx = int(input(f"{name_kanji} ({name_kana}) is not found in the database. Please select the correct one: "))
		return candidates[int(selected_idx)].person.person_id

def get_speech_by_column(cur: psycopg2.extensions.cursor, column: Literal["issue_id", "speaker", "speech_id"], value: Any) -> List[Speech]:
	query = f"""
		SELECT issue_id, name_of_house, name_of_meeting, date, pdf_url, speech_id, speaker, speech, speech_url, person_id
		FROM speeches
		WHERE {column} = %s;
	"""
	cur.execute(query, (value,))
	rows = cur.fetchall()
	if not rows:
		return None
	return_array = []
	for row in rows:
		return_array.append(Speech(
			issue_id=row[0],
			name_of_house=row[1],
			name_of_meeting=row[2],
			date=row[3],
			pdf_url=row[4],
			speech_id=row[5],
			speaker=row[6],
			speech=row[7],
			speech_url=row[8],
			person_id=PersonId(row[9])
		))
	return return_array

def get_all_data_for_column_for_table(cur: psycopg2.extensions.cursor, column: Literal["person_id", "name_kana", "name_kanji", "election_signature"], table: Literal["person", "election_result", "x_account", "speeches"]) -> List[Any]:
	query = f"""
		SELECT {column}
		FROM {table};
	"""
	cur.execute(query)
	return_array = []
	for row in cur.fetchall():
		return_array.append(row[0])
	return return_array

def create_tables_if_not_exist(cur: psycopg2.extensions.cursor) -> None:
    run_ddl(cur)

def connect_db(dbname:str="kokkaidoc",
               user:str="postgres",
               password:str="password",
               host:str="localhost",
               port:str="5432"
               ) -> psycopg2.extensions.connection:
    try:
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port,
        )
        return conn
    except Exception as e:
        print("Unable to connect to the database")
        raise e