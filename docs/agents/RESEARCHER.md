# Research (`paper/`, stance pipelines)

Computational political science and ideological-scaling research built on top of the data pipelines.

## Papers (`paper/`)

| Directory | Topic |
|---|---|
| `kokkaidoc-an-llm-driven-framework-for-scaling-parliamentary-repr/` | Published platform paper ([arXiv:2505.07118](https://arxiv.org/abs/2505.07118)) — read `main.tex` + `references.bib` only |
| `latent-space-ensembles-for-dynamic-ideological-scaling/` | Latent-space ensembles for dynamic ideological scaling |
| `parameter-optimization-for-low-resource-ideological-simulation/` | Parameter optimization for low-resource ideological simulation |

LaTeX sources + `references.bib` in each. For agent context, read `.tex` and `.bib` only — skip `figs/` if present and any build output (see `.gitignore`). Figures and PDFs are on [arXiv](https://arxiv.org/abs/2505.07118) for the published paper.

## Core research pipelines

### Stance quantification

`data/quantify_politician_stance_to_topics.py`:

1. Summarize rep opinions per topic (legacy OpenAI path)
2. Embed summaries with SentenceTransformer `cl-tohoku/bert-base-japanese-v3`
3. Generate controversy axes and UMAP projections

Outputs under `data/results/` (date-stamped) and `data/axis/` (`{topic}/{topic}_axis.txt`, plots).

### Idea summaries (embedding input)

`create_idea_summaries.ipynb` / `create_idea_summaries.py`:

- Reads `repr_speeches_id_organized/` topic files
- Extracts `意見文` segments via BERT classifier
- Summarizes with `SummaryPrompt` + `DeepResearchGemini`
- Writes anonymized multi-summary arrays to `idea_summaries/` for embedding diversity

### ML labelling & fine-tuning

| Corpus dir | Producer | Consumer |
|---|---|---|
| `diet_speech_label/` | `idea_label_parliament_speech.py` | `finetune_text_labeller.py` |
| `youtube_label/` | `idea_label_youtube.py` | `finetune_text_labeller.py` |
| `tweet_label/` | `idea_label_tweets.py` | `finetune_text_labeller.py` |

Notebook: `data/finetune_text_labeller.ipynb`.

### Experimental comparisons

- `idea_compare_platform_speeches.py` — cross-platform speech comparison (uses `tmp_idea_analysis/`)
- `create_readable_summaries_of_stances.py` — stub, not fully implemented

## External validation data — UTAS

Candidate-level survey responses from the University of Tokyo–Asahi Shimbun Election
Study Project (UTASP) live under `data/data/u-tokyo-asahi/` — one wave per election
(`2019HoC/`, `2021HoR/`, `2022HoC/`, `2024HoR/`). Each wave has a CSV of candidate
answers plus a codebook (`.docx`). See [DATA-LAYOUT.md](./DATA-LAYOUT.md) for file names.

Primary use: correlate LLM/embedding-based politician positions with UTAS policy items
(e.g. Defence, nuclear restart) for validity checks. Planned work:
[`specs/ensemble-scaling-reliability/`](../../specs/ensemble-scaling-reliability/README.md)
(candidate-name matching and item→topic mapping still TODO).

## Served research outputs

Ideological scaling / embedding artifacts are synced to `s3_mirror/kokkai-doc/ideology/` and served by `backend/app/routers/ideology.py`. Frontend visualization: `components/visualizations/IdeologicalScatterPlot.tsx`.

## Topic configuration

Topics (English names, Japanese search words, BERT labels) live in `data/resource/experiment_config.json`. Used by opinion collection, labelling, and summary pipelines.

## Experiment code (`research/`)

Code for the papers lives in [`research/`](../../research/README.md), one directory
per project. Datasets resolve through `research/polis/paths.py` (`DATA_DIR` →
`data/data`, overridable with `KOKKAI_DATA_DIR` for GPU boxes without the drive).

| Path | What |
|---|---|
| `research/polis/` | POLIS — low-resource persona simulation via DPO + LoRA anchors merged with DARE-TIES, mixing coefficients tuned by Optuna GP-BO. Covers the whole pipeline: anchor selection → session-grounded DPO pair export → Gemini caricature `rejected` → `train_one_politician_persona.py` (TRL `DPOTrainer`, PEFT; `--quantize` for 4-bit QLoRA at 7B) → `merge_layer_group.py` / `bo_merge_coeffs.py` → `polis_option_logprob.py` UTAS scoring. Paper: `paper/parameter-optimization-for-low-resource-ideological-simulation/`; plan and handover: `specs/polis-low-resource-persona/`. |
| `research/polis/output/` | Trained LoRA adapters, **gitignored** (~1 GB). Four anchors at 0.5B and 7B. |

Consolidated 2026-07-29 from the separate `idea/persona` repo plus the POLIS
scripts that used to live in `data/`; older notes referencing either location
describe the same files.

## Related code (sibling repos)

Separate git repos alongside this one (`../idea/`), not part of `kokkai_analysis`:

| Path | What |
|---|---|
| `../idea/scaling/survey/` | Human pairwise-comparison web app (Next.js frontend + FastAPI backend, Firestore/CSV) collecting "which speech is more pro-X" labels per topic — a human-label source for the ideological-scaling axes in `paper/`. Frontend runs a non-standard Next.js: read `node_modules/next/dist/docs/` before editing. |

## When working on research

1. Read [DATA-LAYOUT.md](./DATA-LAYOUT.md) for input data paths (`repr_speeches_id_organized/`, `data_repr_speeches/`, `idea_summaries/`, `u-tokyo-asahi/`)
2. Read [DATA-PIPELINES.md](./DATA-PIPELINES.md) for LLM and scraping conventions
3. Trace served outputs through [BACKEND.md](./BACKEND.md) and [FRONTEND.md](./FRONTEND.md) if publishing to the live site
