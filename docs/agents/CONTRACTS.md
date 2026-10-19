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

### Ideology file (`/ideology/`, `kokkai-doc/ideology/ideology.json.gz`)

Written by `data/topic_scaling` (spec `specs/topic-scaling-refresh/`). v2 is a superset of the original shape, so `IdeologicalScatterPlot.tsx` works with either:

```
{ version: 2, generated_at, embed_model, summary_model, current_members_as_of,
  data: [ { topic: "nuclear", topic_en: "NuclearPower", topic_jp: "原発",
            window: {from: "2011-03-11", to: null}, n_scaled, n_current,
            sub_topics: [ { topic, sub_topic: "restart", sub_topic_jp, axis: {pro, con},
                            "1d": {data: [point]}, "2d": {data: [point]}, "2d_current": {data: [point]} } ] } ] }
point = { idx, x, y, repr, hiragana, house, party, party_full, color, ref_point: "none"|"for"|"against",
          person_id, current: bool, n_opinions, n_speeches, last_speech }
```

`1d.x` is the projection onto the sub-topic axis (0 = midpoint, positive = pro); the frontend filters on `current` for the 現職のみ view and swaps `2d` for `2d_current`. Topic/sub-topic keys match `frontend/app/data/available.json`, which stays the manual on/off switch.

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
