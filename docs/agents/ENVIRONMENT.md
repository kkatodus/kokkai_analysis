# Environment & agent tips

## Secrets (`.env`)

| Variable | Required for |
|---|---|
| `GEMINI_API_KEY` | Most current Python pipelines (`DeepResearchGemini`) |
| `OPENAI_API_KEY` | Legacy only (`quantify_politician_stance_to_topics.py`) |
| `PSQL_DATABASE_PASSWORD` | Postgres via `dbio/` |
| `API_KEY` | FastAPI backend (local + deployed) |
| AWS creds | CDK deploys, S3 storage in non-local envs |
| `STRIPE_SECRET_KEY` | Payment routes |

Some legacy scripts reference `secrets/api_keys.py` for OpenAI.

## Local Postgres (`kokkaidoc` DB) — check this before grepping flat files

A Postgres 14 server is **already running locally** with the `kokkaidoc` database
populated. Peer-auth as the `postgres` OS user works without a password:

```
sudo -u postgres psql -d kokkaidoc
```

App code connects via `data/dbio/representative_db.py:connect_db()`
(`dbname=kokkaidoc, user=postgres, host=localhost, port=5432`, password from
`PSQL_DATABASE_PASSWORD`).

Tables (row counts as of 2026-07):

| Table | Rows | What |
|---|---|---|
| `person` | 4,818 | Canonical politician identity (`person_id`, `name_kanji`, `name_kana`, `election_signature`). `person_id` here **is** the directory key under `repr_speeches_id_organized/{person_id}/`. |
| `election_result` | 22,576 | One row per election a person ran in (`election_name`, `election_date`, `district`, `party`, `result`). Same content as the `data/data/election_history/{person_id}.jsonl` export — query this table directly instead of re-parsing 4,818 jsonl files when you need term/cohort membership (e.g. 49th HoR term = `election_name = '第49回衆議院議員総選挙' AND result = '当選'`). |
| `speeches` | 7,048,027 | Full NDL speech archive with `person_id`, `date`, `name_of_house` already joined — a superset of `data_all_speeches/` + `repr_speeches_id_organized/`, directly queryable/filterable by date and house without touching per-politician files. |
| `x_account` | 1,825 | `person_id` → X/Twitter `account_id`. |

This is the fastest path to name↔`person_id` resolution, term/election-cohort
membership, and date/house-filtered speech volume — check here first instead of
grepping `data/data/election_history/` or scanning `repr_speeches_id_organized/` by hand.
Resolver code: `dbio/representative_db.py:get_politician_id_by_name` /
`get_closest_person_by_name`.

## Tooling

Python: Selenium (ChromeDriver/GeckoDriver), pandas, torch, transformers, sentence-transformers, psycopg2, geopandas, MeCab.

Node: Node 18+ for frontend. Backend is Python/FastAPI.

## Large data directories

Part of the repo or local mirror — avoid deleting unless regenerating:

- `data/data/data_*`
- `data/data/repr_speeches_id_organized/`
- `data/data/u-tokyo-asahi/` — UTASP candidate survey CSVs + codebooks (research validation)
- `s3_mirror/kokkai-doc/`

## Tips for agents

- **Use `./scripts/` helpers** before exploring the repo: `./scripts/agent-help.sh` lists compact discovery commands (`route-task.sh`, `show-guide.sh`, `list-api-routes.sh`, `tree-pillar.sh`, etc.). See [AGENTS.md](../../AGENTS.md).
- **Planned work** lives in `specs/` — start at [specs/README.md](../../specs/README.md); update that index when adding a new spec. List folders: `./scripts/list-specs.sh`.
- Mind dirty working trees with large data changes; don't delete/regenerate data unless asked.
- Pipeline data lives under `data/data/`; the backend reads from `s3_mirror/kokkai-doc/` — check both when tracing a feature end-to-end.
- Many Python scripts are heavyweight (network/LLM/Selenium). Describe intent before running; check env keys and drivers.
- When touching frontend auth or ISR, read `frontend/app/lib/server/README_AUTH.md`.
