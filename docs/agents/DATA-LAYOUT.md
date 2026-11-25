# Data layout (`data/data/`)

Python scripts live directly under `data/`; committed/processed datasets live under `data/data/`. Do not confuse the two levels.

## Path conventions

- `params/paths.py` defines:
  - `ROOT_DIR` → the `data/` package directory
  - `DATA_DIR` → `data/data/` (dataset root)
- Most scripts use `os.path.join(DATA_DIR, "<subdir>")` or `os.path.join(ROOT_DIR, "data", "<subdir>")` — both resolve to `data/data/<subdir>`.
- Legacy scripts may still write under repo-root `data_prepping/` (see bottom).
- Large subtrees are partially gitignored via `data/data/.gitignore` (`data_all_speeches/*`, `data_repr_speeches/`, `data_speeches/`).

## Pipeline data vs API-served data

Raw and intermediate pipeline outputs stay in `data/data/`. The FastAPI backend reads from `s3_mirror/kokkai-doc/` locally (or S3 in deployed envs). Think of `s3_mirror/` as the denormalized, upload-ready mirror of subsets the frontend needs.

| `data/data/` (pipeline) | `s3_mirror/kokkai-doc/` (API) | Backend router |
|---|---|---|
| `repr_speeches_id_organized/` | `repr_speeches_id_organized/` | `routers/speeches.py` |
| `election_history/` | `electionHistory/` | `routers/electionHistory.py` |
| `data_all_speeches/` (per issue) | `issues/{issueID}/` | `routers/speeches.py` |
| Postgres `label_result` (via `data/speech_quality/publish.py`) | `speech_quality/aggregate.json` + `speech_quality/persons/{person_id}.jsonl` + `speech_quality/site_stats.json`; `quality` object on exchange-starting lines in `issues/{id}/speeches.jsonl` | `routers/speeches.py` (`/speeches/quality/*`, `/speeches/get_issue_by_id`) |
| (derived from repr/geo pipelines) | `parliamentMembers/`, `politicians/`, `geo/`, `ideology/` | `routers/parliamentMember.py`, etc. |
| `data/resource/experiment_config.json` (via `speech_update/topics.py`) | `topics/topics.json` — `{ version, generated_at, topics: [{ topic_name_en, topic_name, search_words }] }` | `routers/speeches.py` (`/speeches/topics`) |
| (fetched by `data/person_images/`) | `person_images/{person_id}.jpg` + `person_images/index.json` (source, licence, attribution) | none yet; frontend can read the index |
| `s3_mirror/.topic-scaling/` (summaries, embeddings, opinion cache) | `ideology/ideology.json.gz` + `ideology/history/ideology-YYYY-MM-DD.json.gz` | `routers/ideology.py` (written by `data/topic_scaling`) |
| `s3_mirror/.topic-scaling/summaries/` + `select.json` + opinion cache | `ideology/persons/{person_id}.json` (stance summaries, counts, contributing speech IDs; only changed files uploaded, never deleted) | `routers/ideology.py` `/ideology/person` (spec `specs/stance-summaries-panel/`) |

When adding a new dataset the frontend should consume, expect a pipeline step under `data/data/` **and** an upload/sync into `s3_mirror/kokkai-doc/`.

## Subdirectories

### Chamber metadata — `data_sangiin/`, `data_shugiin/`

Scraped from sangiin.go.jp / shugiin.go.jp by `collect_repr_list.py`.

- `repr_list/` — dated snapshots (`YYYYMMDD_repr_list.json`)
- `meeting_member_lists/` — committee rosters per Diet session
- `data_sangiin/voting_results/` — per-session vote tallies

### Raw speech archive — `data_all_speeches/` (very large)

One directory per NDL `issueID`: `meta.json` + `speeches.jsonl`. Written by `collect_all_speeches.py`.

### Per-politician speech index — `repr_speeches_id_organized/`

Keyed by Postgres `person_id`.

- `all_speeches.jsonl` — **complete** speech archive for that politician
- Topic files (`Defence.jsonl`, etc.) — subsets matching `resource/experiment_config.json` search words
- Built by `reorganize_all_repr_speeches.py`; kept current in `s3_mirror/` by `data/speech_update/` (lines sorted newest meeting first, keyed by `speechID`)

### Exchange quality labels — `s3_mirror/kokkai-doc/speech_quality/`

Not under `data/data/`: built straight from Postgres `label_result` by `python -m speech_quality.publish` (spec `specs/speech-quality-ui/`). `aggregate.json` holds per-person counts (function, contribution, issues, outcomes, as questioner and as answerer) plus corpus totals and the coverage window; `persons/{person_id}.jsonl` lists one person's labelled exchanges newest first. `site_stats.json` (~3 KB, spec `specs/dashboard-loading/` §8) holds site-wide numbers for the dashboard loading cards: corpus size from the `speeches` table since 2000, label coverage and site-wide shares, and top-5 current members by neutral counts (speeches, exchanges, lower-house terms; current = newest `parliamentMembers/` snapshot). Rewritten on every `rebuild()`; alone with `--site-stats`. The old relevance copies (`*_with_prd_and_rl/`, `relevance_data/`) are legacy and no longer read.

### Topic-classified opinions — `data_repr_speeches/` (often gitignored)

`{party}/{repr_name}/{topic}/opinions.json`. BERT-classified segments from `collect_politician_opinions.py`.

### Manifesto analysis — `data_manifesto/`

`2025UpperHouseElection/parties.json`; per-party `policies.json` and `investigated_coherence.json`.

### Geography — `data_geo/`

City population/coordinates, `senkyoku2022/` GeoJSON.

### Election timelines — `election_history/`

One `{person_id}.jsonl` per politician. Exported from the Postgres `election_result`
table — for term/cohort membership queries (e.g. "who was elected in the 49th HoR
term"), it's usually faster to query Postgres directly than to scan all jsonl files.
See [ENVIRONMENT.md](./ENVIRONMENT.md#local-postgres-kokkaidoc-db--check-this-before-grepping-flat-files)
for connection details, schema, and row counts (`person`, `election_result`,
`speeches`, `x_account`).

### Relevance source — `relevance_data/`

NDL TSV exports + `aggregate_processed.jsonl`.

### ML labelling corpora

`diet_speech_label/`, `youtube_label/`, `tweet_label/` — for `finetune_text_labeller.py`.

### UTAS candidate surveys — `u-tokyo-asahi/`

University of Tokyo–Asahi Shimbun Election Study Project (UTASP / UTAS) candidate-level
survey responses. One subdirectory per election wave:

| Subdir | Election | Files |
|---|---|---|
| `2019HoC/` | 2019 House of Councillors | `2019UTASP20191109.csv`, `2019UTASP_codebook20191109.docx` |
| `2021HoR/` | 2021 House of Representatives | `2021UTASP20211126_excludedQ11.csv`, `2021UTASP_English_20240502_temporary.docx` |
| `2022HoC/` | 2022 House of Councillors | `2022UTASP20220720.csv`, `2022UTASP_codebook20231201.docx` |
| `2024HoR/` | 2024 House of Representatives | `2024UTASP20241125.csv`, `2024UTASP_English_20250820.docx` |

Each CSV row is one candidate (`ID`, `NAME`, `KANA`, `PARTY`, district fields, `Q*_*`
policy items). Codebooks (`.docx`) define question wording and scales.

Not mirrored to `s3_mirror/` or served by the API — research ground truth for validating
ideological-scaling outputs (see [RESEARCHER.md](./RESEARCHER.md),
[`specs/ensemble-scaling-reliability/`](../../specs/ensemble-scaling-reliability/README.md)).

### Other dirs

- `data_local_gov/` — local gov scrape configs
- `data_visual/` — visualization outputs
- `data_x_account_manual/` — manual X/Twitter account merges
- `tmp/` — scratch (`tmp_idea_analysis/`)

### Supporting (not datasets)

| Directory | Role |
|---|---|
| `results/` | Stance-quantification outputs (embeddings, UMAP, logs) |
| `axis/` | Per-topic controversy-axis artifacts; `axis/midpoints.json` = calibrated con→pro cut per sub-topic (which sub-topics get published) |
| `unused/` | Deprecated scripts (may reference `data_prepping/`) |
| `data_venv/`, `mecab-ipadic-neologd/` | Local tooling — not project data |

## Legacy: `data_prepping/` (repo root)

- `data_prepping/data_sangiin/voting_results` — `collect_sangiin_votes.py`
- `data_prepping/data/data_geo` — early geo pipeline output

Prefer `data/data/` for new work.
