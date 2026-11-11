# Frontend–backend contracts

## Backend (FastAPI)

Base URL configured in `frontend/app/lib/config/api.ts`. Most routes require `X-API-KEY` header (see `backend/app/core/security.py`).

### Key routes

| Area | Endpoints | Data source |
|---|---|---|
| Speeches | `/speeches/*` | `s3_mirror/kokkai-doc/` — issues, organized speeches, exchange quality labels (`speech_quality/`) |
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

### Per-person stance summaries (`/ideology/person`, spec `specs/stance-summaries-panel/`)

`GET /ideology/person?person_id=268` → `kokkai-doc/ideology/persons/{person_id}.json`, or `{ version: 1, person_id, topics: [] }` when the file is missing (never 500). Written by the same `topic_scaling` publish call as the ideology file; proxied by `app/api/ideology/person`; read by the detail pane's 立場 tab.

```
{ version: 1, person_id, generated_at, ideology_generated_at,
  topics: [ { topic: "defence", topic_en: "Defence", topic_jp: "防衛", window: {from, to},
              n_speeches, n_opinions, first_speech, last_speech,
              model, prompt_version, summarised_at,      # model may be "a, b" when runs fell back
              summaries: [run1, run2, run3],              # preamble already stripped
              speech_ids?: [...] } ] }                    # contributing speeches; absent when not reproducible
```

Topics are in `experiment_config.json` order. Only (person, topic) pairs plotted in the ideology file are written; orphan files are never deleted, so the frontend shows a topic only when the loaded ideology data plots the person on it. TypeScript: `PersonStances` / `PersonStanceTopic` in `frontend/app/types/index.ts`.

### Topic search words (`/speeches/topics`, spec `specs/topic-keyword-highlight/`)

- `GET /speeches/topics` → `kokkai-doc/topics/topics.json` as-is (404 if missing). Proxied by `app/api/speeches/topics` (1 h revalidate); `fetchSpeechTopics()` caches it per session. `lib/highlightKeywords.ts` re-finds the words in each speech (exact substring, longest match wins) for `HighlightedSpeech` in 発言（トピック別）. Frontend tests: `cd frontend && npm test`.

### Exchange quality labels (`/speeches/quality/*`, spec `specs/speech-quality-ui/`)

- `GET /speeches/quality/aggregate` → `kokkai-doc/speech_quality/aggregate.json`: `{ version, generated_at, prompt_version, models, coverage: {from, to, exchanges, meetings}, totals: {as_questioner, as_answerer}, persons: [{ person_id, name, group, as_questioner: Counts|null, as_answerer: AnswerCounts|null }] }`. Fetched server-side in `page.tsx` (raw, >1 MB) and passed to `SpeechQualityBarList` and `DetailPane`.
- `GET /speeches/quality/person?person_id=` → `{ exchanges: [{ role, start_speech_id, issue_id, date, house, meeting, questioner, questioner_group, orders, function, contribution, issues, responsible, outcomes, topic, reason, model }] }`, newest first; empty when nothing is labelled. Proxied by `app/api/speeches/quality_person`.
- Meeting view: the exchange's first speech in `/speeches/get_issue_by_id` carries `quality: { function, contribution, issues, responsible, outcomes, topic, reason, model, prompt, speech_ids }`; `speechSegmentation.ts` turns `speech_ids` into coloured segments.
- TypeScript shapes: `Quality*` in `frontend/app/types/index.ts`; Japanese vocabulary in `frontend/app/lib/quality.ts` (mirror of `data/speech_quality/prompt.py`).

## Next.js API routes (`frontend/app/api/`)

Some browser-facing calls go through Next.js route handlers instead of hitting FastAPI directly:

- `app/api/speeches/*` — speech fetch, availability, first page of topics, issue by ID, a person's labelled exchanges (`quality_person`), topic search words (`topics`)
- `app/api/ideology/person` — a person's stance summaries (`/ideology/person`)
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
