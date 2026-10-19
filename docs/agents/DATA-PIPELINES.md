# Data pipelines (`data/`)

Python scripts for scraping, processing, and LLM-based analysis. Intermediate and committed datasets live under `data/data/` (see [DATA-LAYOUT.md](./DATA-LAYOUT.md)).

## Shared libraries

| Directory | Role |
|---|---|
| `file_handling/` | JSON/HDF5/dir utilities and freshness checks |
| `api_requests/` | NDL speech API client, LLM prompters |
| `dbio/` | Postgres models (`person`, `election_result`, `x_account`) |
| `prompts/` | LLM prompt templates (`prompts/txts/…`) |
| `data_process/` | String cleaning, MeCab tokenization, meeting JSON helpers |
| `utils/` | Representative name normalization |
| `scrape/` | Selenium wrapper (Chrome/Firefox) |
| `logger/` | Minimal console/file logger |
| `params/paths.py` | `ROOT_DIR` (the `data/` package), `CHROMEDRIVER_PATH` |
| `resource/` | Topic config (`experiment_config.json`), scrape configs |

## LLM conventions (`api_requests/prompter.py`)

**Prefer Gemini for new pipelines** via `DeepResearchGemini` (`google.genai`, `GEMINI_API_KEY`). Legacy OpenAI `GPTPrompter` is commented out.

| Use case | Model | Used by |
|---|---|---|
| Default / bulk summarization | `gemini-3.5-flash` | `DeepResearchGemini()` default, `idea_compare_platform_speeches.py`, `collect_repr_x_accounts.py`, `create_idea_summaries.ipynb` |
| Heavier research / web-grounded | `gemini-2.5-pro` | `analyze_manifesto_of_parties.py`, `collect_all_repr_list.ipynb` |
| Ad-hoc deep research | `gemini-3.1-pro-preview` | `create_local_db_for_politicians.ipynb` |
| Legacy (avoid for new work) | OpenAI `gpt-4o-mini` / `o3` | `quantify_politician_stance_to_topics.py` |

`DeepResearchGemini.prompt(prompt, system_prompt=...)` concatenates system + user text and enables Google Search grounding by default.

## Scraping / collection

| Script | Output |
|---|---|
| `collect_repr_list.py` | `data/data_sangiin`, `data/data_shugiin` — `repr_list/`, `meeting_member_lists/` |
| `collect_sangiin_votes.py` | `data_prepping/data_sangiin/voting_results` (legacy path) |
| `collect_all_speeches.py` | `data/data_all_speeches/` — one dir per NDL `issueID` |
| `collect_politician_opinions.py` | `data/data_repr_speeches/` — BERT-classified segments per topic |
| `collect_local_gov_json_for_member_list.py` | Scraping configs in `data/data_local_gov/` |
| `collect_repr_x_accounts.py` | Postgres `x_account` table via Gemini |
| `get_city_coordinate_and_population.py` | Geo JSON/CSV under `data/data_geo/` |
| `convert_shape_to_geojson.py` | `data/data_geo/senkyoku2022/` |
| `reorganize_all_repr_speeches.py` | `repr_speeches_id_organized/` per `person_id` |

### Incremental speech updater — `speech_update/`

`collect_all_speeches.py` + `reorganize_all_repr_speeches.py` are full one-off crawls. For keeping speeches current, use the `speech_update` package (spec: `specs/speech-auto-update/`). It works directly in `s3_mirror/kokkai-doc/` and uploads only changed files to `kokkai-doc-bucket-dev`.

- Own venv (`data/requirements.txt` doesn't install on macOS): `/opt/homebrew/bin/python3 -m venv .venv-speech-update && .venv-speech-update/bin/pip install -r data/requirements-speech-update.txt`
- Run from `data/`: `../.venv-speech-update/bin/python -m speech_update all [--dry-run] [--from YYYY-MM-DD]`. Stages: `fetch` (NDL `/api/meeting` date window, 60-day lookback) → `route` (speaker → `person_id` via Postgres, merge by `speechID`) → `upload` (boto3, profile `kokkai-speech-update`, never deletes).
- Scheduled wrapper: `./scripts/update-speeches.sh` (retry once, Slack on failure).
- State, logs and `unmatched_speakers.jsonl` live in `s3_mirror/.speech-update/`. After adding a new member to Postgres `person`: `route --retry-unmatched`, then `upload`.
- **Speaker review** (spec: `specs/speaker-review/`): speeches made outside the politician's elected terms without a 会派 are not attributed at all (`not_serving`). Unsure matches (kanji differ beyond old/new forms, election-history pick, a member speaking outside their known terms) are held, not filed, and queued in Postgres `speaker_review`. Review with `python -m speech_update.review` (interactive; `list`, `decide`, `scan`, `apply` also available). The nightly run applies decisions and moves already-filed speeches.
- **Other names** (`person_alias`, specs/speaker-review §3.5): names a person goes by besides `person.name_kanji` (name changes, kana spellings, NDL typos). Both the speech resolver and the member matcher use them. Add with `python -m member_update alias add ID NAME [--kana K] [--kind K]`, then move filed speeches with `python -m speech_update.review refile NAME [--scan]`. Duplicate people: `python -m member_update merge DROP KEEP` (DROP's name becomes an alias; S3 deletions listed in its backup folder need admin credentials).
- **Exchange labels** (`speech_quality/`, spec: `specs/speech-quality-labels/`): the `label` stage of `all` (or `python -m speech_quality.label_job run|status|write`) labels committee exchanges since 2000 with Gemini 3.8 Flash batches, newest first, under `SPEECH_LABEL_MONTHLY_CAP_USD` (100). Spend ledger and results in Postgres `label_batch` / `label_request` / `label_result` / `label_price`; labels go onto the exchange's first speech in `issues/{id}/speeches.jsonl` (`quality` + `is_relevant` / `is_productive` / `quality_reason`). Model comparison: `python -m speech_quality.evaluate`.
- Tests: `cd data && ../.venv-speech-update/bin/python -m unittest discover -s speech_update/tests -t .`; resolver regression: `python -m speech_update.check_resolver`.

### Monthly member list updater — `member_update/`

Replaces `collect_repr_list.py` (Selenium) for keeping `parliamentMembers/{shugiin,sangiin}_YYYYMMDD.json` current (spec: `specs/member-auto-update/`). Same venv and S3 profile as `speech_update`.

- Run from `data/`: `../.venv-speech-update/bin/python -m member_update all [--dry-run] [--house shugiin|sangiin]`. It scrapes shugiin.go.jp (10 pages) and sangiin.go.jp (`giin/current/` → current session), attaches `person_id`s (link → previous snapshot → name → reading), writes a new dated snapshot only if something changed, and uploads it.
- Members with no `person` row get `person_id: null` and are queued in `s3_mirror/.member-update/pending_members.json`. `member_update pending` writes a JSON template per member. Fill in a verified `election_data`, then `member_update add FILE` (Postgres `person` + `election_result`, `electionHistory/<id>.jsonl`, appends `politicians/table.csv(.gz)`), then `all`, then `speech_update route --retry-unmatched && speech_update upload`. If a member exists under another name: `member_update link HOUSE NAME PERSON_ID`.
- Schedule: `./scripts/install-member-update-schedule.sh install|status|run-now` (1st of the month, 05:00) runs `./scripts/update-members.sh` (retry once, Slack summary every run).
- Tests: `cd data && ../.venv-speech-update/bin/python -m unittest discover -s member_update/tests -t .`

## Analysis / LLM workflows

| Script | Purpose |
|---|---|
| `analyze_manifesto_of_parties.py` | Manifesto scrape → `data_manifesto/2025UpperHouseElection/` |
| `quantify_politician_stance_to_topics.py` | Stance summaries, embeddings, UMAP → `results/`, `axis/` |
| `create_idea_summaries.ipynb` / `.py` | Topic-scoped Gemini summaries → `idea_summaries/` |
| `process_relevance_data.py` | NDL relevance TSVs → enriched speech copies |
| `idea_label_*.py` | Labelling corpora for fine-tuning |
| `finetune_text_labeller.py` | Fine-tune text classifier on labelled corpora |
| `test_data_health.py` | Duplicate/staleness checks in `data_repr_speeches` |
| `create_local_db_for_politicians.py` | Initial Postgres ingest of election JSONs |

Prompt helpers: `prompts/summary.py`, `prompts/extract_controversy.py`, `prompts/generate_example.py`.

## Caution

Many scripts are heavyweight (Selenium, LLM calls, large I/O). Check env keys and drivers before running. Do not delete or regenerate large data dirs unless explicitly asked.
