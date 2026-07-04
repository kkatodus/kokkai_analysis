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

## Tooling

Python: Selenium (ChromeDriver/GeckoDriver), pandas, torch, transformers, sentence-transformers, psycopg2, geopandas, MeCab.

Node: Node 18+ for frontend. Backend is Python/FastAPI.

## Large data directories

Part of the repo or local mirror — avoid deleting unless regenerating:

- `data/data/data_*`
- `data/data/repr_speeches_id_organized/`
- `s3_mirror/kokkai-doc/`

## Tips for agents

- **Use `./scripts/` helpers** before exploring the repo: `./scripts/agent-help.sh` lists compact discovery commands (`route-task.sh`, `show-guide.sh`, `list-api-routes.sh`, `tree-pillar.sh`, etc.). See [AGENTS.md](../../AGENTS.md).
- **Planned work** lives in `specs/` — start at [specs/README.md](../../specs/README.md); update that index when adding a new spec. List folders: `./scripts/list-specs.sh`.
- Mind dirty working trees with large data changes; don't delete/regenerate data unless asked.
- Pipeline data lives under `data/data/`; the backend reads from `s3_mirror/kokkai-doc/` — check both when tracing a feature end-to-end.
- Many Python scripts are heavyweight (network/LLM/Selenium). Describe intent before running; check env keys and drivers.
- When touching frontend auth or ISR, read `frontend/app/lib/server/README_AUTH.md`.
