# Backend (`backend/`)

FastAPI application serving processed parliamentary data from S3 (deployed) or `s3_mirror/` (local).

## Entry points

- `backend/app/main.py` — FastAPI app, CORS, domain verification middleware, router registration
- `backend/app/core/config.py` — settings via pydantic (`ENVIRONMENT`, `STORAGE_BACKEND`, `LOCAL_DATA_ROOT`, `DATA_LAKE_BUCKET_NAME`, `API_KEY`, Stripe keys)
- `backend/app/core/storage.py` — local filesystem vs S3 data access
- `backend/app/core/security.py` — API key dependency, domain/host allowlists

## Routers

| Router | File | Purpose |
|---|---|---|
| speeches | `routers/speeches.py` | Speech archives, issues, relevance/productivity |
| parliamentMember | `routers/parliamentMember.py` | Current/historical member metadata |
| electionHistory | `routers/electionHistory.py` | Per-politician election timelines |
| geo | `routers/geo.py` | District / city geography |
| ideology | `routers/ideology.py` | Ideological scaling / embedding outputs |
| donors | `routers/donors.py` | Donor data |
| payment | `routers/payment.py` | Stripe payment intents / sessions |

Public health check: `GET /health` (no API key).

## Data source

The backend does **not** read `data/data/` pipeline paths directly. It reads from:

- **Local dev:** `s3_mirror/kokkai-doc/` (default when `ENVIRONMENT=local`)
- **Deployed:** S3 data-lake bucket (`kokkai-doc-data-lake-bucket-{env}`)

See [DATA-LAYOUT.md](./DATA-LAYOUT.md) for the pipeline → mirror mapping table.

## Running locally

```bash
cd backend
pip install -r requirements.txt
# Set API_KEY and optionally LOCAL_DATA_ROOT in .env
uvicorn app.main:app --reload --port 8000
```

Container port in production: **8000** (see [INFRA.md](./INFRA.md)).
