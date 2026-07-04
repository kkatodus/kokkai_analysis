# Frontend–backend contracts

## Backend (FastAPI)

Base URL configured in `frontend/app/lib/config/api.ts`. Most routes require `X-API-KEY` header (see `backend/app/core/security.py`).

### Key routes

| Area | Endpoints | Data source |
|---|---|---|
| Speeches | `/speeches/*` | `s3_mirror/kokkai-doc/` — issues, organized speeches, relevance |
| Parliament members | `/parliamentMembers/*`, `/politicians/*` | Member metadata from pipeline sync |
| Election history | `/electionHistory/*` | Per-`person_id` JSONL timelines |
| Geo | `/geo/*` | District / city data |
| Ideology | `/ideology/*` | Embedding / scaling outputs |
| Donors | `/donors/*` | Donor records |
| Payment | `/payment/*` | Stripe (server-side secret key) |
| Health | `/health` | Public, no auth |

## Next.js API routes (`frontend/app/api/`)

Some browser-facing calls go through Next.js route handlers instead of hitting FastAPI directly:

- `app/api/speeches/*` — speech fetch, availability, first page of topics, issue by ID
- `app/api/electionHistory/route.ts`
- `app/api/donors/route.ts`
- `app/api/payment/*` — create payment intent / session

These may add server-side auth, caching, or revalidation (see `app/lib/revalidation-constants.ts`).

## Legacy manifesto endpoints

Older docs reference Express `api/routes/manifesto/*` reading from `api/data_manifesto/`. The current stack uses FastAPI + S3 mirror; manifesto data is produced under `data/data_manifesto/` by `analyze_manifesto_of_parties.py`. Confirm current frontend wiring before assuming manifesto routes are live on the deployed backend.

## Adding a new dataset end-to-end

1. Pipeline writes to `data/data/<subdir>/`
2. Sync/upload to `s3_mirror/kokkai-doc/<mirror-path>/`
3. Add or extend a FastAPI router under `backend/app/routers/`
4. Add frontend service + component (and optionally a Next.js API proxy route)

See the mapping table in [DATA-LAYOUT.md](./DATA-LAYOUT.md).
