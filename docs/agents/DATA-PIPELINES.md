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
