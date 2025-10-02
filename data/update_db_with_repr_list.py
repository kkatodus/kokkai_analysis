import os, json, re
from datetime import date
from dateutil.parser import parse as dtparse
import boto3
from dotenv import load_dotenv
import hashlib
load_dotenv()

# --- env vars (we'll set these in the workflow) ---
CLUSTER_ARN = os.environ["RDS_RESOURCE_ARN"]
SECRET_ARN  = os.environ["RDS_SECRET_ARN"]
DATABASE    = os.environ.get("RDS_AURORA_DB_NAME", "postgres")
AWS_REGION  = os.environ.get("AWS_REGION", "ap-northeast-1")

rds = boto3.client("rds-data", region_name=AWS_REGION)

def make_signature(election_data):
    # Build a string like "第25回衆議院議員総選挙|宮崎1区|自由党;..."
    parts = []
    for y in election_data:
        # normalize fields to avoid whitespace issues
        ename = (y.get("election_name") or "").strip()
        dist  = (y.get("district") or "").strip()
        party = (y.get("party") or "").strip()
        parts.append(f"{ename}|{dist}|{party}")
    combined = ";".join(sorted(parts))  # sort so order doesn’t affect signature
    return hashlib.sha256(combined.encode("utf-8")).hexdigest() if combined else None


def exec_sql(sql, params=None):
    return rds.execute_statement(
        resourceArn=CLUSTER_ARN,
        secretArn=SECRET_ARN,
        database=DATABASE,
        sql=sql,
        parameters=params or [],
        includeResultMetadata=True,
    )

DDL = [
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

def ensure_schema():
    for stmt in DDL:
        exec_sql(stmt)

def parse_jp_int(s):
    if not s: return None
    m = re.search(r"(\d+)", s)
    return int(m.group(1)) if m else None

def build_date(year, month, day):
    try:
        y = int(re.sub(r"\D","", year)) if year else None
        m = int(re.sub(r"\D","", month)) if month else 1
        d = int(re.sub(r"\D","", day)) if day else 1
        return date(y,m,d).isoformat() if y else None
    except Exception:
        return None

def upsert_person(name_kanji, name_kana, election_data):
    signature = make_signature(election_data)

    # Check if someone with same name+signature already exists
    res = exec_sql("""
        SELECT person_id FROM person
        WHERE name_kanji = :kanji AND name_kana = :kana AND election_signature = :sig
    """, [
        {"name": "kanji", "value": {"stringValue": name_kanji or ""}},
        {"name": "kana",  "value": {"stringValue": name_kana  or ""}},
        {"name": "sig",   "value": {"stringValue": signature or ""}},
    ])

    if res["records"]:
        print(f"⚠️ Possible duplicate: {name_kanji} {name_kana} (signature={signature[:8]}..)")
        return res["records"][0][0]["longValue"]

    # Otherwise insert new person
    res = exec_sql("""
        INSERT INTO person (name_kanji, name_kana, election_signature)
        VALUES (:kanji, :kana, :sig)
        RETURNING person_id;
    """, [
        {"name": "kanji", "value": {"stringValue": name_kanji or ""}},
        {"name": "kana",  "value": {"stringValue": name_kana  or ""}},
        {"name": "sig",   "value": {"stringValue": signature or ""}},
    ])
    return res["records"][0][0]["longValue"]

def upsert_election(person_id, election_date, election_name, district, party, result, election_number, raw_json):
    exec_sql("""
        INSERT INTO election_result
        (person_id, election_date, election_name, district, party, result, election_number, raw_json)
        VALUES
        (:pid, CAST(:edate AS DATE), :ename, :dist, :party, :result, :enum, CAST(:raw AS JSONB))
        ON CONFLICT (person_id, election_date, election_name, district, party)
        DO UPDATE SET
          result = EXCLUDED.result,
          election_number = EXCLUDED.election_number,
          raw_json = EXCLUDED.raw_json;
    """, [
        {"name":"pid","value":{"longValue": person_id}},
        {"name":"edate","value":{"stringValue": election_date}},           # stays text; CAST in SQL
        {"name":"ename","value":{"stringValue": election_name or ""}},
        {"name":"dist","value":{"stringValue": district or ""}},
        {"name":"party","value":{"stringValue": party or ""}},
        {"name":"result","value":{"stringValue": result or ""}},
        {"name":"enum","value":{"longValue": election_number} if election_number is not None else {"isNull": True}},
        {"name":"raw","value":{"stringValue": json.dumps(raw_json, ensure_ascii=False)}},
    ])

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    n_people = 0
    n_elec   = 0
    for p in payload.get("data", []):
        name_kanji = p.get("name_kanji")
        name_kana  = p.get("name_kana")
        election_record = p.get("election_data")
        # for avoiding duplicates
        pid = upsert_person(name_kanji, name_kana, election_record)
        n_people += 1

        for e in p.get("election_data", []):
            edate = build_date(e.get("year"), e.get("month"), e.get("day"))
            if not edate:
                cand = (p.get("years") or [None])[0]
                try:
                    edate = dtparse(cand).date().isoformat() if cand else None
                except Exception:
                    edate = None
            if not edate:
                continue

            upsert_election(
                person_id=pid,
                election_date=edate,
                election_name=e.get("election_name"),
                district=e.get("district"),
                party=e.get("party"),
                result=e.get("result"),
                election_number=parse_jp_int(e.get("election_freq")),
                raw_json=e
            )
            n_elec += 1

    print(f"Upserted persons={n_people}, elections={n_elec}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 2:
        print("Usage: python load_kokkai_json.py path/to/your.json")
        raise SystemExit(1)
    ensure_schema()
    load_json(sys.argv[1])
