#!/usr/bin/env python
# coding: utf-8

# In[17]:


import os
from google.cloud import bigquery
from params.paths import DATA_DIR


ORGANIZED_SPEECHES_DIR = os.path.join(DATA_DIR, "repr_speeches_id_organized")
PROJECT_ID = "idea-a"
TABLE_ID = "jpdiet.diet-speech"
client = bigquery.Client()


# In[ ]:


import json
import os
import random
import tempfile
import time
from datetime import datetime, timezone

from google.api_core.exceptions import BadRequest, Forbidden, TooManyRequests, ServiceUnavailable, InternalServerError

# Batch rows across MANY source files into one temp JSONL to reduce load-job count.
BATCH_ROWS = 10000

# Exponential backoff for rate limits / transient failures.
MAX_RETRIES = 8
BASE_DELAY_SECONDS = 2.0
MAX_DELAY_SECONDS = 120.0

schema = [
    # Prefer TIMESTAMP here: it parses RFC3339 strings like 2026-01-08T12:34:56Z reliably.
    bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="NULLABLE"),
    bigquery.SchemaField("source_path", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("person_id", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speechID", "STRING", mode="REQUIRED"),
    bigquery.SchemaField("speechOrder", "INT64", mode="NULLABLE"),
    bigquery.SchemaField("speaker", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speakerYomi", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speakerGroup", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speakerPosition", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speakerRole", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("speech", "STRING", mode="NULLABLE"),
    bigquery.SchemaField("startPage", "INT64", mode="NULLABLE"),
    bigquery.SchemaField("createTime", "DATETIME", mode="NULLABLE"),  # "2019-09-05 05:23:55"
    bigquery.SchemaField("updateTime", "DATETIME", mode="NULLABLE"),
    bigquery.SchemaField("speechURL", "STRING", mode="NULLABLE"),
    bigquery.SchemaField(
        "meta",
        "RECORD",
        mode="NULLABLE",
        fields=[
            bigquery.SchemaField("issueID", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("imageKind", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("searchObject", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("session", "INT64", mode="NULLABLE"),
            bigquery.SchemaField("nameOfHouse", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("nameOfMeeting", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("issue", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("date", "DATE", mode="NULLABLE"),  # "1981-04-15"
            bigquery.SchemaField("closing", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("pdfURL", "STRING", mode="NULLABLE"),
            bigquery.SchemaField("nextRecordPosition", "INT64", mode="NULLABLE"),
        ],
    ),
]

job_config = bigquery.LoadJobConfig(
    source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
    write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
    ignore_unknown_values=True,
    schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION],
    schema=schema,
)


def _sleep_with_jitter(seconds: float) -> None:
    # Add +/- 20% jitter to avoid synchronized retries.
    jitter = seconds * 0.2
    time.sleep(max(0.0, seconds + random.uniform(-jitter, jitter)))


def load_batch_with_backoff(tmp_path: str, rows: int) -> None:
    """Upload one NDJSON batch file with retry/backoff on rate limits/transient errors."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            with open(tmp_path, "rb") as f:
                job = client.load_table_from_file(f, TABLE_ID, job_config=job_config)
            job.result()
            print(f"Loaded batch: {rows} rows (job_id={job.job_id})")
            return
        except (TooManyRequests, ServiceUnavailable, InternalServerError) as e:
            if attempt >= MAX_RETRIES:
                raise
            delay = min(MAX_DELAY_SECONDS, BASE_DELAY_SECONDS * (2**attempt))
            print(f"Retryable error ({type(e).__name__}): {e}. Backing off {delay:.1f}s (attempt {attempt+1}/{MAX_RETRIES})")
            _sleep_with_jitter(delay)
        except (BadRequest, Forbidden) as e:
            # Non-retryable: schema issues, permission issues, invalid JSON, etc.
            raise


def _new_batch_file():
    tmp = tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", suffix=".jsonl", delete=False)
    return tmp, tmp.name


tmp = None
batch_path = None
batch_rows = 0
batch_idx = 0

def flush_batch() -> None:
    global tmp, batch_path, batch_rows, batch_idx
    if not tmp or batch_rows == 0:
        return

    tmp.flush()
    tmp.close()
    try:
        batch_idx += 1
        load_batch_with_backoff(batch_path, batch_rows)
    finally:
        if batch_path and os.path.exists(batch_path):
            os.remove(batch_path)

    tmp = None
    batch_path = None
    batch_rows = 0


try:
    tmp, batch_path = _new_batch_file()

    # Stream over all representative speech files, writing into batch files of ~BATCH_ROWS.
    for person_id in os.listdir(ORGANIZED_SPEECHES_DIR):
        repr_dir = os.path.join(ORGANIZED_SPEECHES_DIR, person_id)
        all_speeches_path = os.path.join(repr_dir, "all_speeches.jsonl")
        if not os.path.exists(all_speeches_path):
            continue

        with open(all_speeches_path, "r", encoding="utf-8") as src:
            for line in src:
                line = line.strip()
                if not line:
                    continue

                obj = json.loads(line)
                obj.setdefault("meta", {})
                obj["meta"]["nextRecordPosition"] = 0

                # Per-row additions
                # RFC3339 UTC timestamp string (best compatibility for BigQuery TIMESTAMP)
                obj["ingested_at"] = (
                    datetime.now(timezone.utc)
                    .isoformat(timespec="seconds")
                    .replace("+00:00", "Z")
                )
                obj["source_path"] = all_speeches_path
                obj["person_id"] = person_id

                tmp.write(json.dumps(obj, ensure_ascii=False) + "\n")
                batch_rows += 1

                if batch_rows >= BATCH_ROWS:
                    flush_batch()
                    tmp, batch_path = _new_batch_file()

    # Final partial batch
    flush_batch()
finally:
    # Cleanup if interrupted mid-batch
    try:
        if tmp and not tmp.closed:
            tmp.close()
    finally:
        if batch_path and os.path.exists(batch_path):
            os.remove(batch_path)


# In[ ]:




