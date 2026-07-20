# Handover — Ensemble Scaling Reliability

**As of:** 2026-07-05
**Spec:** [README.md](README.md) (the full plan; gates G1–G3, work items A–D)
**Status:** implementation in progress. A1 (volume gate, G3 resolved), B2, B3 done.
**Both corpus decisions are now resolved (see below), unblocking A3.** A3 (scope-aware
summaries) and A4 (embedding grid rows 1-5) are **built and validated end-to-end**; the
**term-scope A3 summarization batch is running** (started 14:26, ~469 members). Still TODO:
finish term A3 → run allhistory A3 → full A4 grid on both scopes → A5 Wordfish → A6 metrics
→ paper rewrite.

## Corpus decisions — RESOLVED 2026-07-05 (were the A3 blockers)

1. **House filter: HoR-only.** In-term 参議院 ministerial speeches (~18–22% of volume) are
   EXCLUDED. Applied to *both* corpus variants.
2. **Term-scoping: run BOTH and compare against UTAS.** The user does not want to pick term
   vs all-history a priori — corpus scope is an **empirical variable**. A3 therefore produces
   two summary sets that differ in exactly one thing (the date window); A6 reports UTAS
   validity for each. `scope="term"` = 2021-11-10→2024-10-09 衆議院; `scope="allhistory"` =
   all 衆議院 speeches, any date.

## A3/A4 — built 2026-07-05

- **A3 `data/ensemble_scaling/a3_build_summaries.py`** — scope-aware summariser. Reuses the
  production gate verbatim (jp-speech-classifier 意見文 filter + search words + MIN_OPINIONS=3
  + anonymised SummaryPrompt ×3 via gemini-2.5-flash-lite) but GPU-batches the classifier and
  keys output by scope. Writes `data/data/idea_summaries_ensemble/{scope}/{pid}/{topic}/`
  (`summary.json` mirrors the production schema; `opinions.json` for provenance) + manifest
  `artifacts/a3_summaries_{scope}.json`. Validated: term filter correct (all dates in-window),
  GPU gate + Gemini path produce clean anonymised stance summaries. `--scope`, `--limit`,
  `--no-llm`, `--force`. **Requires `python3`** (not `python` — deps live in the py3.10 dist).
  **Note:** `data/create_idea_summaries.py` was edited (its bottom run cell guarded under
  `if __name__ == "__main__":`) so A3 can import its pure helpers without triggering a run.
- **A4 `data/ensemble_scaling/a4_embed_grid.py`** — embedding grid rows 1-5 (sarashina-v2-1b,
  ruri-v3-310m, multilingual-e5-large, openai text-embedding-3-large, bert-base-japanese-v3).
  Reads A3 summaries, mean-pools each politician's runs, caches
  `artifacts/embeddings/{scope}/{topic}/{slug}.npz` (person_ids + parties + embeddings,
  row-aligned). e5/ruri doc-prefixes + legacy CLS pooling handled. Validated on bert-ja-v3.
  **Row 6 Wordfish is a separate script (work item A5), not in A4.** Big model downloads
  (sarashina/ruri/e5) happen on first full run; confirm the HF ids resolve.
- **Running now:** term-scope A3 batch (PID detached via nohup;
  log `artifacts/logs/a3_term.log`). The `cohort=1` in the manifest is stale from a dev run —
  it is overwritten when the full run finishes. **Nothing notifies on completion** (nohup
  detached from the harness); poll `find data/data/idea_summaries_ensemble/term -name summary.json | wc -l`
  and `pgrep -af a3_build_summaries.py`.

## Immediate next steps (in order)

1. Wait for term A3 to finish (~350 Defence + ~166 Nuclear summaries expected).
2. Run allhistory A3: `python3 data/ensemble_scaling/a3_build_summaries.py --scope allhistory`
   (heavier — opinion-extracts the full 68k-Defence / 18.5k-Nuclear corpus on GPU).
3. Run the full A4 grid on both scopes (downloads the 3 big models; needs OPENAI key for row 4,
   or `--skip-api` to defer). Confirm HF ids `cl-nagoya/ruri-v3-310m`, `sbintuitions/sarashina-embedding-v2-1b`.
4. A5 Wordfish baseline, then A6 metrics (instability / conclusion-sensitivity / LOMO / validity
   vs UTAS via `b3_utas_item_map` + `load_topic_scores`). G1/G2 fall out of A6.

## Prior status (still accurate)

## Latest update (2026-07-05, A1)

- **A1 done.** `data/ensemble_scaling/a1_volume_gate.py` → `artifacts/`
  (`a1_cohort_49th_hor.csv` = **469 unique winners**, 496 rows dedup'd for 27 重複立候補
  dual-candidacy members; `a1_volume_by_person_topic.csv`; `a1_volume_summary.md`). Cohort
  from Postgres (`election_result`), volume from the term-scoped topic jsonls
  (2021-11-10→2024-10-09, 衆議院); 460/469 have speech dirs.
- **G3 = FAIL.** Members clearing the ≥3-opinion-segment upper bound: Defence 350 (76%),
  NuclearPower 166 (36%), FamilySeparate 26 (5.7%), LGBT 39 (8.5%). Conditional topics
  dropped; **A2 not needed.**
- **Working min-text threshold:** ≥3 opinion segments (mirrors pipeline `MIN_OPINIONS=3`).
- **Two decisions surfaced for the user (not yet confirmed):**
  1. In-term **参議院 ministerial speeches** (~18–22% of volume) are currently EXCLUDED
     (corpus = HoR). Confirm before A3 caches embeddings.
  2. **Term-scoping keeps only ~12–20% of all-history speeches** the current pipeline
     uses. NuclearPower gets thin under term-scoping (median 3 term speeches). Confirm
     term-scoped corpus vs all-history before A3.
- **B2 done (pre-existing, now verified).** `data/match_utas_to_person.py` has already been
  run → `data/data/u-tokyo-asahi/person_map/{wave}.json`. UTAS 2021 HoR: 641/1051 matched,
  covering **463/469 (98.7%) of the A1 cohort**. Validation backbone essentially complete.
- **B3 done.** `data/ensemble_scaling/b3_utas_item_map.py` → `artifacts/b3_utas_item_map.{json,md}`.
  Defence primary `Q6_1` (+ `SQ8_1/2`, `Q7_1`, `Q6_2`); Nuclear primary `Q7_5`. Oriented
  (`pro_sign`), directions validated vs party means. `load_topic_scores(wave, topic)` is the
  reusable {person_id → oriented answer} accessor for A6. Only 2021HoR; 2024HoR TODO.
- **Next:** the A3→A4→A6 core (multi-model embeddings → ensembles → metrics), **after** the
  user resolves the two corpus decisions above (participate house filter + term-scoping),
  since A3 caches embeddings and is expensive to redo.

## TL;DR

The 2026-07-04 grilling produced the spec and pivoted the paper to a pure methods paper
(see memory `ensemble-scaling-paper-pivot`). Since then **no analysis or paper work has
landed**. Notably, `paper/latent-space-ensembles-for-dynamic-ideological-scaling/main.tex`
is still the **pre-pivot cross-platform draft** — the rewrite (D1) has not begun. Pick up
at work item **A1** (volume gate) and **D1** (gut rewrite) — they unblock the most.

## What has actually been done

| Item | State | Evidence |
|---|---|---|
| **B1 — UTAS data acquired** | ✅ Done | `data/data/u-tokyo-asahi/{2019HoC,2021HoR,2022HoC,2024HoR}/` each hold one CSV + codebook (.docx). Confirmed present. |
| Spec written | ✅ Done | `specs/ensemble-scaling-reliability/README.md`, committed in `fd645dd6`. |
| Survey app exists (for C) | ✅ Pre-existing | `../idea/scaling/survey/` has `backend/`, `frontend/`, `data/`. **No judgments collected** — `data/` holds only `example.csv` (1.7 KB). |
| Local Postgres `kokkaidoc` | ✅ Reachable | `sudo -u postgres psql -d kokkaidoc` works; `election_result` etc. present. Needed for A1. (Run psql from a dir postgres can `cd` into, e.g. `/tmp` — it errors on `cd` into the repo dir but the query still runs.) |
| Defence/Nuclear anchor questions | ✅ Already authored | `data/resource/experiment_config.json`: topic 1 (防衛) and topic 4 (原発) both have non-blank `question` + prompts. |

## What is NOT done (everything else)

### A. Pipeline (`data/`) — nothing started
- **A1 — Volume check (feeds G3):** not started. No artifact. Use the Postgres route from
  the spec (`election_result` for the 49th-term HoR cohort → `speeches` for date/house
  volume; topic membership from `repr_speeches_id_organized/{person_id}/{Topic}.jsonl`).
- **A2 — Anchor questions for 夫婦別姓 (topic 10) + LGBT (topic 13):** not done.
  Confirmed **both `question` fields are BLANK** in `experiment_config.json` (as the spec
  said). Only author these if G3 passes.
- **A3 — Multi-model embedding grid (5 models + Wordfish):** not started. Grepped `data/`
  for `sarashina|ruri|multilingual-e5|bert-base-japanese` → **zero hits**. The current
  pipeline is still single-embedder; it has not been extended or cached per-model.
- **A4 — Ensemble estimators (concat+PCA, Procrustes+avg, z-average):** not started
  (no `procrustes|ensemble` code in `data/`).
- **A5 — Wordfish baseline:** not started (no `wordfish` code).
- **A6 — Metrics notebook (instability / conclusion-sensitivity / LOMO / validity):** not started.

### B. UTAS — data in hand, no processing
- **B2 — candidate-name → Diet-roster matching pipeline:** not started. Grep for
  `utas|u-tokyo-asahi|taniguchi` across `data/` scripts → **zero hits**; no matching code exists.
- **B3 — UTAS item → topic mapping:** not started (depends on reading the codebooks).
  Reminder from spec: CSVs are Shift-JIS; 2021 file excludes Q11; 2021 codebook is temporary.

### C. Bradley-Terry study — app exists, no design/data
- **C1** (pair-sampling design + freeze stimulus summaries), **C2** (deploy for
  crowdworkers + procurement), **C3** (collect ~1.5–2k judgments, fit BT) — all not started.

### D. Paper (`paper/latent-space-ensembles-for-dynamic-ideological-scaling/`) — untouched since pivot
- **D1 — gut rewrite: not started.** `main.tex` is still the **old cross-platform draft**:
  - Title still `Latent Space Ensembles for Dynamic Ideological Scaling: Measuring
    Rhetorical Consistency in the Japanese Diet` (spec wants "Dynamic" dropped, lead with
    reliability/ensembles).
  - Killed content still present: `\section{Theory and Hypotheses}` with **H1–H5**,
    cross-platform Motivation, X/YouTube data sections (16.5M artifacts, 5.3M tweets, etc.).
  - These are exactly the sections the spec marks as dead weight to cut.
  - Salvageable-as-is per spec: Intro framing, Diet-corpus data description, pipeline
    section, summarization-prompt appendix (`\section{Summarization Prompt}` present).
- **D2 — related work** (position vs KOKKAI DOC / L(u)PIN / embedding-ensemble lit): not done.
  `references.bib` is **empty (0 bytes)**.
- **D3 — results sections:** blocked on A6; G1 decides framing.

### Gates
- **G1 (deflation), G2 (within-party validity), G3 (topic volume):** none run — all
  depend on pipeline output (A1/A3/A6) that does not exist yet.

## Recommended next steps (unblock order)

1. **A1 — volume gate** via Postgres. Produces the cohort + per-(politician, topic) volume
   distribution → sets the min-text threshold and resolves **G3** (whether 夫婦別姓/LGBT
   are in). Cheapest high-leverage step; everything topic-related waits on it.
2. **B2/B3 — UTAS matching + item mapping.** Data is already local; this is the validation
   backbone (the "referee") and has no external dependencies. Read the codebooks for B3.
3. **A3 → A4 → A6 — the diagnosis+fix core.** Multi-model embeddings, then ensembles, then
   the metrics notebook. G1/G2 fall out of A6.
4. **D1 — paper rewrite** can start in parallel with 1–3 (cut H1–H5 / cross-platform, keep
   pipeline + appendix, new title). D2/D3 follow the results.
5. **C (Bradley-Terry)** is the longest-lead, lowest-blocking item (needs procurement +
   crowdworkers); freeze stimulus summaries (C1) only after A3 fixes the summarization step.

## Open parameters still unresolved (from spec)

- API embedder for grid row 4 (OpenAI `text-embedding-3-large` vs Gemini) — budget call.
- Crowdsourcing platform + budget for BT (¥50k–150k, Yahoo! Crowdsourcing / Lancers).
- Min-text threshold — set empirically from A1's distribution.
- Final title.
- Coauthor confirmation on venue/timeline (Kimura, Mikiya, Mori, Yoshida, Kasuya).

## Pointers

- Plan of record: [README.md](README.md)
- Existing single-embedder pipeline it extends: [RESEARCHER.md](../../docs/agents/RESEARCHER.md),
  [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)
- Postgres schema/row counts: [ENVIRONMENT.md](../../docs/agents/ENVIRONMENT.md#local-postgres-kokkaidoc-db--check-this-before-grepping-flat-files)
- Config: `data/resource/experiment_config.json`
- UTAS raw: `data/data/u-tokyo-asahi/`
- Survey app: `../idea/scaling/survey/` (sibling repo, no data collected)
