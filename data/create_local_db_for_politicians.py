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

# ---------- Strong types ----------
PersonId = NewType("PersonId", int)

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

# ---------- DDL ----------
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
    );"""
]

# ---------- Helpers ----------
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

# ---------- IO over your historical dirs ----------
def iterate_over_historical_data(house_historical_dir: str) -> Iterator[RawPersonFile]:
    for file in os.listdir(house_historical_dir):
        if not file.endswith(".json"):
            continue
        data = read_json(os.path.join(house_historical_dir, file))  # type: ignore[name-defined]
        # Lightweight runtime shape check; keep it cheap
        if not isinstance(data, dict):
            continue
        if not data.get("name_kana"):
            continue
        yield data  # type: ignore[typeddict-item]

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
