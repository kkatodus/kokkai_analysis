# Ensemble Scaling Reliability — methods paper (KOKKAI DOC sequel)

**Status:** draft
**Paper directory:** `paper/latent-space-ensembles-for-dynamic-ideological-scaling/` (reworked in place)
**Predecessor:** `paper/kokkaidoc-an-llm-driven-framework-for-scaling-parliamentary-repr/` (published framework; this paper is its direct methodological sequel)
**Decided:** 2026-07-04 (grilling session)

## One-sentence claim

LLM-embedding-based ideological scaling (the L(u)PIN / KOKKAI DOC family) is materially
sensitive to the choice of embedding model — same texts, same anchors, different models
yield different politician rankings — and latent-space ensembles recover rankings that are
both more **stable** (leave-one-model-out) and more **valid** (agreement with UTAS and
human pairwise judgments) than any single model.

Structure: **diagnosis (headline) + fix (constructive payoff)**. This is a pure
methodology paper. No substantive political-science hypotheses.

## What this paper is NOT (decisions from the 2026-07-04 grilling)

All of the following were considered and **explicitly killed** — do not resurrect them
without revisiting the reasoning:

| Dropped | Why |
|---|---|
| Cross-platform (Diet vs X vs YouTube) consistency, H1 | Not enough per-politician data on X/YouTube for valid comparison |
| Electoral proximity, H2 | Session/quarter-level cells too thin; snap-election endogeneity |
| PR-vs-SMD tier, H3 | Pure-PR members concentrate in JCP/Komeito → tier confounded with party discipline |
| *Sekihairitsu* / marginality, H4 + party-discipline moderator, H5 | Whole substantive arm judged not exciting/defensible enough; pivoted to pure methods |
| Deviation-from-party-line DV, covariate assembly, regressions | Died with H4/H5 |
| Diachronic party trajectories | Already covered in the KOKKAI DOC paper; adds nothing to the reliability claims |
| Elo ratings | Order/path-dependent; use Bradley-Terry (standard latent-strength model, gives SEs) |

The current `main.tex` Theory/Motivation/Hypotheses sections and the X/YouTube data
sections are dead weight to be cut in the rewrite; Intro framing, data description of the
Diet corpus, the pipeline section, and the summarization-prompt appendix are salvageable.

## Positioning vs. our own prior paper

Related-work must state explicitly what is new over KOKKAI DOC:
1. Reliability *diagnosis* of the method family (model-choice instability, unquantified so far — including in our own prior work).
2. Ensemble estimators as the fix, with stability + validity evidence.
3. Validation upgraded from expert party-level estimates to **candidate-level UTAS** and **human Bradley-Terry pairwise comparisons**.

## Design

### Testbed corpus

- **Chamber/cohort:** House of Representatives, 49th term (2021–2024), all members.
  All filtered substantive Diet speech per (politician, topic), aggregated over the term.
- **Replication appendix:** 2024– cohort (50th term) against UTAS 2024.
- **Topics:** Defence (topic 1) + NuclearPower (topic 4) **committed** (defined anchor
  questions, continuously deliberated, direct UTAS counterpart items).
  夫婦別姓 (topic 10) + LGBT (topic 13) **conditional** on the volume gate (below);
  their `question`/anchor fields in `data/resource/experiment_config.json` are currently
  blank and must be authored before use.
  Excluded: economy/cost-of-living cluster (valence, not positional), ClimateChange
  (overlaps Nuclear), OnlineVoting/MyNumber (no left–right structure).

### Model grid (the diagnosis set)

| Row | Model | Role |
|---|---|---|
| 1 | `sbintuitions/sarashina-embedding-v2-1b` | current pipeline default |
| 2 | `cl-nagoya/ruri-v3` | strong Japanese retriever family |
| 3 | `intfloat/multilingual-e5-large` | multilingual reference point |
| 4 | one API embedder (OpenAI `text-embedding-3-large` or Gemini) | different training regime |
| 5 | `cl-tohoku/bert-base-japanese-v3` | legacy row ("how much does upgrading matter") |
| 6 | Wordfish on the summarized texts | classical text-scaling baseline |

### Ensemble variants (the fix set)

1. **Concat + PCA** (primary).
2. Procrustes-align spaces + average.
3. **Naive z-score-then-average of per-model projections** — mandatory simple baseline;
   if it matches the fancy variants, the recommendation becomes "just average."

### Metrics

- **Instability (headline):** pairwise Spearman/Kendall between per-model politician
  rankings, per topic — overall **and within-party** (within-party is the hard test;
  party-level separation is trivially easy for any method).
- **Conclusion sensitivity:** do substantive-style readings (party ordering, top/bottom
  deciles) flip under model swap?
- **Ensemble stability:** leave-one-model-out rank stability.
- **Validity (the referee):** correlation with UTAS candidate answers (overall +
  within-party) and with human Bradley-Terry scores, per topic.

### Validation apparatus

**UTAS (primary; zero collection cost, full coverage).**
Candidate-level Taniguchi–Asahi survey. Match politician *i*'s estimated position on
Defence/Nuclear to their UTAS 2021 answer on the corresponding item. Report Spearman
overall and within-party. Raw waves are committed under `data/data/u-tokyo-asahi/`
(2019 HoC, 2021 HoR, 2022 HoC, 2024 HoR); matching and item mapping still TODO — see work items.

**Bradley-Terry pairwise study (targeted audit: does human reading of the same summaries
reproduce the text-based ranking?).**
- Instrument: existing survey app in `../idea/scaling/survey/` (built, **no data collected yet**).
- Scope: 2 topics × ~100 politicians/topic, 12–15 comparisons per politician
  ≈ 1,500–2,000 judgments, 2–3 annotators per pair (report agreement).
- Sampling: stratified within party across the estimated-score range; pairs are a mix of
  random and adjacent-in-estimated-score (adjacent pairs test fine-grained ranking).
- Annotators: **crowdsourcing** (Yahoo! Crowdsourcing / Lancers), rough budget
  ¥50k–150k, with attention checks.
- Interpretation rule (pre-stated): UTAS strong but BT weak → investigate the
  summarization step (BT reads summaries, isolating embedding/projection);
  UTAS weak within-party → individual-level validity of the whole family is in question
  and the paper's framing shifts to that finding.

## Gates (run these BEFORE writing the paper around the results)

1. **G1 — Deflation gate (go/no-go for framing):** run the full grid on Defence +
   Nuclear, 2021 cohort. If a single strong model (e.g., sarashina) matches the ensemble
   on UTAS validity, claim (b) deflates to "ensembles as insurance against unknowable
   model bias" — still a paper, but choose that framing knowingly.
2. **G2 — Within-party validity gate:** if UTAS within-party correlation is ~0 for all
   models *and* ensembles, individual-level scaling claims are dead; the paper becomes a
   negative/diagnosis-only result. Decide with coauthors before proceeding.
3. **G3 — Topic volume gate:** per-(politician, topic, term) filtered-speech volume check
   for 夫婦別姓 and LGBT; add them only if enough politicians clear a minimum-text
   threshold in the 2021–2024 term. **RESOLVED 2026-07-05 (A1): FAIL.** Only 26 (夫婦別姓)
   and 39 (LGBT) of 460 cohort members clear the ≥3-opinion-segment bar — far below the
   ~100/topic the analysis and BT study need. Paper runs on **Defence + NuclearPower**.

## Work items

### A. Pipeline (this repo, `data/`)
- [x] A1. Volume check per (politician, topic) for the 49th-term corpus; fixes the topic
      set (G3) and the minimum-text threshold. **Done 2026-07-05.** Script
      `data/ensemble_scaling/a1_volume_gate.py`; artifacts in `artifacts/`
      (`a1_cohort_49th_hor.csv`, `a1_volume_by_person_topic.csv`, `a1_volume_summary.md`).
      Result: cohort = **469 unique winners** (496 election_result rows dedup'd — 27
      dual-candidacy 重複立候補 members); 460 have speech dirs. Term-scoped
      (2021-11-10→2024-10-09, 衆議院) coverage clearing the ≥3-opinion-segment upper bound:
      **Defence 350 (76%)**, **NuclearPower 166 (36%)**, FamilySeparate 26 (5.7%),
      LGBT 39 (8.5%). Working threshold = MIN_OPINIONS≥3 (mirrors the pipeline gate).
      **G3 fails for both
      conditional topics** → run on Defence + NuclearPower only; **A2 not needed**.
      Open decision surfaced: in-term 参議院 ministerial speeches (~18–22% of volume) are
      currently excluded (corpus = HoR); confirm before A3.
      Resolve the 49th-term (2021–2024) HoR cohort and per-politician speech volume via
      the local Postgres `kokkaidoc` DB (`sudo -u postgres psql -d kokkaidoc`), not by
      hand-scanning flat files: `election_result` (`election_name = '第49回衆議院議員総選挙'
      AND result = '当選'`) gives the cohort's `person_id`s, and `speeches`
      (`name_of_house`, `date`, `person_id` already joined, 7.05M rows) gives
      date/house-filtered volume directly. Topic membership still comes from the
      precomputed `repr_speeches_id_organized/{person_id}/{Topic}.jsonl` files. See
      [ENVIRONMENT.md](../../docs/agents/ENVIRONMENT.md#local-postgres-kokkaidoc-db--check-this-before-grepping-flat-files)
      for schema/row counts.
- [x] A2. Author anchor questions + prompts for 夫婦別姓 / LGBT in
      `experiment_config.json` — **not needed: G3 failed (A1), both topics dropped.**
- [ ] A3. Multi-model embedding runs: extend the current single-embedder pipeline to the
      5-model grid; cache embeddings per model.
- [ ] A4. Implement ensemble estimators: concat+PCA, Procrustes+average, z-average.
- [ ] A5. Wordfish baseline on the same summarized texts.
- [ ] A6. Metrics notebook: instability, conclusion-sensitivity, LOMO, validity tables.

### B. UTAS
- [x] B1. Acquire UTAS candidate-level data — committed in `data/data/u-tokyo-asahi/`
      (2019 HoC, 2021 HoR, 2022 HoC, 2024 HoR CSVs + codebooks).
      Notes: CSVs are Shift-JIS; columns include `NAME`/`KANA`/`PREFEC`/`DISTRICT`/
      `PR`/`PARTY`/`RESULT` — filter `RESULT` to elected to get the term cohort.
      Caveats: 2021 file excludes Q11; 2021 English codebook is marked temporary.
- [x] B2. Candidate-name → Diet-roster matching pipeline (kanji/kana variants, districts).
      **Done.** `data/match_utas_to_person.py` → `data/data/u-tokyo-asahi/person_map/{wave}.json`
      (+ `.review.json` for ambiguous/fuzzy). Tiered exact-kanji → kanji+kana → kana, fuzzy
      goes to review only. **UTAS 2021 HoR: 641/1051 candidates matched; covers 463/469
      (98.7%) of the A1 cohort** — the validation backbone is essentially complete.
- [x] B3. Map UTAS items to topics. **Done 2026-07-05** (Defence + Nuclear only; conditional
      topics dropped by G3). `data/ensemble_scaling/b3_utas_item_map.py` →
      `artifacts/b3_utas_item_map.{json,md}`. Defence primary = `Q6_1` (strengthen defense;
      + `SQ8_1/2` constitution/collective-self-defense exact-anchor secondaries, `Q7_1`,
      `Q6_2`); Nuclear primary = `Q7_5` (abolish-now / keep). Each item oriented (`pro_sign`)
      so higher = 'for'; directions validated against party means (LDP/Ishin high → JCP low).
      `load_topic_scores(wave, topic)` returns the {person_id → oriented answer} series A6
      consumes. Only 2021HoR mapped; **2024HoR item numbering still TODO** (needs 2024 codebook).

### C. Bradley-Terry study
- [ ] C1. Finalize pair-sampling design + attention checks; freeze politician summaries
      used as stimuli.
- [ ] C2. Deploy `../idea/scaling/survey/` for crowdworkers; procurement
      (Yahoo! Crowdsourcing / Lancers).
- [ ] C3. Collect ~1,500–2,000 judgments; fit BT model; agreement stats.

### D. Paper (`paper/latent-space-ensembles-for-dynamic-ideological-scaling/`)
- [ ] D1. Gut rewrite of `main.tex`: cut Theory/Hypotheses/cross-platform sections;
      new title (working: drop "Dynamic", lead with reliability/ensembles); rebuild Intro
      around the diagnosis; salvage pipeline + prompt appendix.
- [ ] D2. Related work: position vs KOKKAI DOC, L(u)PIN, embedding-ensemble and
      model-stitching literature (links already collected in the current draft stubs).
- [ ] D3. Results sections from A6 outputs; G1 decides the framing.

## Venue & timeline

- **Presentation ladder:** JSQPS (winter meeting, Jan) and/or PolMeth 2027.
- **Journal target:** *Political Analysis* / *PSRM*; fallback *Journal of Computational
  Social Science*.
- Implies a results-complete draft ~end of 2026. **Confirm with coauthors** (Kimura,
  Mikiya, Mori, Yoshida, Kasuya).

## Open parameters

- Which API embedder for grid row 4 (OpenAI vs Gemini) — budget/access call.
- Exact crowdsourcing platform + budget for the BT study.
- Minimum-text threshold value for A1/G3 (set empirically from the volume distribution).
- Final title.

## Related guides

- [RESEARCHER.md](../../docs/agents/RESEARCHER.md) — pipelines this builds on
- [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)
- Survey app: `../idea/scaling/survey/` (sibling repo)
