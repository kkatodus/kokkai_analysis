Project quickstart for agents
=============================

What this repo is about
-----------------------
- Visualises Japanese Diet activity: scraped vote records, representative info, speeches, and manifesto analysis.
- Three pillars: `api/` (Express server that serves processed data), `frontend/` (CRA React app), and `data/` (Python pipelines for scraping, processing, and LLM-based analysis). `infra/` holds the AWS CDK stack for static hosting.

High-level layout
-----------------
- `api/` – Express app (`api/index.js`) wiring routes for Sangiin, Shugiin, speeches, stats, geo, repr lists, payment, donors, policy, and manifesto. Serves static files from `api/public`.
- `frontend/` – CRA app, entry at `frontend/src/App.jsx`; routes for landing, Diet menus, rep lists, committee lists, analysis tools, stats, payment results, privacy/terms, and manifesto analysis.
- `data/` – All scraping/processing scripts plus intermediate data under `data/data_*`. Key helpers in `data/file_handling`, `data/api_requests`, `data/dbio`, `data/prompts`, `data/data_process`, `data/utils`.
- `infra/` – TypeScript CDK stack (`infra/lib/frontend-stack.ts`) provisioning an S3 bucket with CloudFront (SPA rewrites optional) and optional logging bucket.

Backend notes (api/)
--------------------
- `api/index.js` boots Express on port `process.env.PORT || 5000`, with CORS allowlist for localhost and production domains (Netlify/Vercel previews also allowed). The API guide at `/` lists key endpoints.
- Routes of interest:
  - `routes/manifesto/*` reads per-party data from `api/data_manifesto/2025UpperHouseElection/<party>/policies.json` and `investigated_coherence.json`.
  - Other routers mirror the data collected in `data/`: Sangiin/Shugiin lists, speeches summaries, stats, geo, reprs, donors, policy, etc.
- Environment: Node 18+ per `frontend/package.json`; backend uses pure Express (no TS). Data folders are read directly from the repo.

Frontend notes (frontend/)
--------------------------
- Router lives in `src/App.jsx` (React Router v6). Main pages: landing, info, Sangiin/Shugiin menus (`pages/SangiinMenuPage`, `pages/ShugiinMenuPage`), rep lists (`SangiinReprPage`, `ShugiinReprPage`), committee lists, meeting detail, analysis menu, speech summary/graph, search, stats, payment results, privacy/terms.
- Manifesto experience at `pages/PartyManifestoPage`: splits display and coherence panels. Data fetched via `src/services/manifestoService.js` hitting `/manifesto/party/:name` with caching and fallback samples (`components/ManifestoDisplay/sample.jsx`, `components/CoherenceMonitor/sample.jsx`).
- Resources/endpoints constants in `src/resource/resources.jsx`. Shared layouts live under `src/layouts/`; shared cards/components under `src/sharedComponents/`.

Data pipelines (Python, data/)
------------------------------
- Common helpers:
  - `file_handling/file_read_writer.py` for JSON/HDF5/dir utilities and freshness checks.
  - `api_requests/meeting_convo_collector.py` wraps the National Diet Library speech API pagination.
  - `api_requests/prompter.py` thin wrappers around OpenAI (GPTPrompter) and Gemini (`DeepResearchGemini`, returns text + grounding chunks/supports). Expect `OPENAI_API_KEY`/`GEMINI_API_KEY` in env.
  - `dbio/representative_db.py` psycopg2 models and DDL for `person`, `election_result`, and `x_account` tables; helpers to upsert persons/elections and fetch X accounts.
  - `params/paths.py` defines `ROOT_DIR`, `CHROMEDRIVER_PATH`.
  - `scrape/general_scraper.py` basic Selenium wrapper (Chrome via webdriver_manager or Firefox via bundled `geckodriver`).
- Scraping/collection:
  - `collect_repr_list.py` scrapes current Sangiin/Shugiin representative lists and committee memberships (Selenium) into `data/data_sangiin` and `data/data_shugiin` under `repr_list/` and `meeting_member_lists/`.
  - `collect_sangiin_votes.py` scrapes Sangiin vote outcomes and per-party tallies into `data_prepping/data_sangiin/voting_results`.
  - `collect_all_speeches.py` walks through NDL speech API by issueID and speaker, saving meta + `speeches.jsonl` per issue under `data/data_all_speeches`.
  - `collect_politician_opinions.py` classifies speech segments (BERT `kkatodus/jp-speech-classifier`) for topics defined in `resource/experiment_config.json`; stores per-rep/topic opinions in `data/data_repr_speeches`. Includes historical collection helpers and stats.
  - `collect_local_gov_json_for_member_list.py` interactive scraper setup for local gov member pages (writes scraping config).
  - `collect_repr_x_accounts.py` reads persons from Postgres via `dbio` and uses Gemini to guess X handles; writes to `x_account` table.
  - `get_city_coordinate_and_population.py` builds `city_population_array.json` and mapping files from CSV + stats JSON under `data_prepping/data/data_geo`.
  - `convert_shape_to_geojson.py` simplifies 2022 district shapefile to GeoJSON (`data/data_geo/senkyoku2022`).
- Analysis/LLM workflows:
  - `analyze_manifesto_of_parties.py` orchestrates manifesto collection (LLM scraping), policy parsing into `policies.json`, coherence flagging, and deeper investigations into `investigated_coherence.json` per party under `data_manifesto/2025UpperHouseElection/`.
  - `quantify_politician_stance_to_topics.py` summarizes rep opinions per topic (LLM), embeds summaries (SentenceTransformer `cl-tohoku/bert-base-japanese-v3`), generates controversy axes and projections/UMAP plots under `results/`.
  - `create_readable_summaries_of_stances.py` stub for generating human-readable stance summaries (not fully implemented).
  - `create_local_db_for_politicians.py` initial Postgres ingest of historical election JSONs (similar to `dbio`).
  - `test_data_health.py` checks for duplicates/staleness in `data_repr_speeches`.
  - Prompt helpers in `prompts/summary.py`, `prompts/extract_controversy.py`, `prompts/generate_example.py` read templates from `prompts/txts/`.
- Utility modules:
  - `data_process/string_processor.py` for cleaning topic titles and tokenizing with MeCab.
  - `data_process/info_getter.py` extracts party lists/opinions from meeting JSON.
  - `utils/string_process.py` normalizes representative names.
  - `logger/Logger.py` minimal console/file logger.

Infrastructure (infra/)
-----------------------
- `lib/frontend-stack.ts` defines `FrontendStack`: private, versioned S3 bucket for static assets, CloudFront distribution with HTTPS redirect, optional logging bucket, and SPA-friendly 403/404 rewrites. Outputs bucket name, distribution domain, and ID. See `infra/cdk.json` for app entry (`bin` folder).

Environment and runtime expectations
------------------------------------
- Secrets: `.env` for LLM keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`), Postgres creds (`PSQL_DATABASE_PASSWORD`), and any AWS creds for CDK deploys. Some scripts reference `secrets/api_keys.py` for OpenAI legacy key.
- Tooling: Selenium with ChromeDriver/GeckoDriver, pandas, torch, transformers, sentence-transformers, psycopg2, geopandas. Many scripts assume writable `data/` subdirs and network access to NDL API/LLM vendors.
- Large data directories (`data/data_*`, `api/data_manifesto`) are part of the repo; avoid deleting unless you mean to regenerate.

Frontend–backend contract highlights
------------------------------------
- Manifesto pages call `GET /manifesto/party/:partyName` (URL-encoded, returns `{ party, policies, coherence }`) and `GET /manifesto/parties` (`{ parties: [{name, hasPolicies, hasCoherence}], count }`).
- Rep/committee pages call `/sangiin/repr`, `/shugiin/repr`, `/sangiin/commitee`, `/shugiin/commitee` using the JSON structure produced by `collect_repr_list.py`.
- Speech/analysis pages rely on `/speeches/*`, `/stats/*`, `/policy/*` endpoints backed by processed data under `data/`.

Tips for future agents
----------------------
- Mind the dirty working tree with large data changes; don’t delete/regenerate data unless asked.
- Many Python scripts are heavyweight (network/LLM/Selenium). Describe intent before running them; check env keys and drivers.
- React app still adds a `resize` listener in `src/App.jsx` on every render; consider refactoring to `useEffect` if you’re touching that file.
- For manifesto UI, API party list is at `/manifesto/parties`; current UI uses a hardcoded list/colors in `pages/PartyManifestoPage`.
