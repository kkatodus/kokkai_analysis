# POLIS — session handover (2026-07-04)

Context for resuming work after a session clear. Read [README.md](./README.md) (the spec) first; this file covers only what the spec does not: session state, environment facts, and next actions.

## Where things stand

1. **Spec is written and agreed.** [README.md](./README.md) in this directory encodes the full design from a grill session with Ken (all major decisions confirmed one-by-one). `specs/README.md` index row added. Neither is committed yet (repo has many unrelated uncommitted changes — ask before committing).
2. **Plan change AFTER the spec was written (not yet reflected in it):** the 512GB Mac Studio is delayed. Development happens **now on the local laptop** — RTX 3070 Laptop, **8GB VRAM / 64GB RAM**, CUDA 13.2 driver, WSL2, Python 3.10.12, `uv` available. Everything gets built and validated at **Qwen2.5-0.5B dev scale** (QLoRA up to ~3B possible), then ported to the Studio for the 7–8B main run later. **First pending task: amend spec §3 and §5 accordingly** (phase 0 becomes a laptop toolchain check, not an MLX-vs-MPS spike).
3. **Implementation has not started.** Environment recon was done (GPU/Python above); nothing else.

## Task list at handover

| # | Task | Status |
|---|---|---|
| 1 | Update spec §3/§5 for laptop-scale dev plan | **done** (§3 dev/main-run hardware split; §5 phase 0 → laptop CUDA toolchain check; §6 risks updated) |
| 2 | Survey environment + existing persona pipeline + data availability | data + env side **done** (see facts below); persona-repo code survey still blocked on path confirmation |
| 3 | DPO-pair export pipeline (session-grounded) in `data/` | **done.** `data/export_polis_dpo_pairs.py` (prompt/chosen; `--max-pairs`/`--sample` cap; verified 581 for 1088) + `data/generate_polis_rejected.py` (fills `rejected` via **Gemini 2.5-flash-lite**, resumable, verified). Both live in `data/` (Gemini = API not GPU, so NOT in `../idea/persona`). |
| 4 | Anchor selection with coverage check (dev-scale, ~4 anchors parameterized to 6–10) | **done.** `data/select_polis_anchors.py` → `data/data/polis/anchors.json`. Default = top-1 per major party (9 anchors, 岸田文雄→山本太郎, 71.4% per-axis coverage); `--max-anchors 4` for dev scale; `--parties` to force span endpoints. |

## Facts verified this session (don't re-derive)

- `data/data/idea_summaries/{person_id}/{TopicEn}/summary.json` exists and holds per-politician per-topic LLM-distilled stance summaries (e.g. person 1087 = 坂口力, Defence, 72 opinions → multiple summaries). Confirms topic-matched data exists, though the chosen DPO design doesn't use it.
- **Speech schema confirmed.** `repr_speeches_id_organized/{person_id}/all_speeches.jsonl` records have keys: `speechID`, `speechOrder`, `speaker`, `speakerYomi`, `speakerGroup`, `speakerPosition`, `speakerRole`, `speech`, `startPage`, `createTime`, `speechURL`, `meta`. `speechID = "{issueID}_{speechOrder}"`; `meta` (stringified dict) carries `issueID`, `session` (Diet session #), `nameOfHouse`. Per-topic JSONL files (`Defence.jsonl`, `NuclearPower.jsonl`, …) sit alongside.
- **Context source confirmed.** `data/data/data_all_speeches/{issueID}/speeches.jsonl` holds *all* speeches for one sitting, ordered by `speechOrder` (row 0 = 会議録情報 header, rows 1+ = real speeches; ~283 rows in the sampled issue). Context reconstruction = target's `issueID`+`speechOrder` → take rows with `0 < speechOrder < target` from this file. Each issue also has a `meta.json`.
- **UTAS name fields confirmed.** `data/data/u-tokyo-asahi/{2019HoC,2021HoR,2022HoC,2024HoR}/*.csv`; columns include `ID, NAME (kanji), KANA, PARTY, PREFEC, DISTRICT, …`. Matchable to speech `speaker`/`speakerYomi`. English codebooks are `.docx` alongside.
- GPU: RTX 3070 Laptop 8GB, CUDA 13.2, driver 596.36. Python 3.10.12. `uv` 0.11.20 at `/root/.local/bin/uv`. `/root/projects/idea` exists (not probed deeper — see caution).

## Caution

- Two attempts to `ls` the sibling persona repo (`/root/projects/idea/persona/code/`) were **rejected by Ken in the permission prompt**. Unclear if this was path-related or intentional — **ask Ken before touching `../idea/`**, and confirm the actual path of the persona repo (RESEARCHER.md says `../idea/persona/code/` with `train_one_politician_persona.py` consuming prompt/chosen/rejected JSONL, default Qwen2.5-0.5B-Instruct).
- Per the spec's code-home decision: training/merging/BO code belongs in the persona repo; this repo gets data-prep/export scripts (under `data/`), UTAS eval assets, spec, paper.

## Design decisions NOT in the spec (conversation nuance worth keeping)

- The session-grounded DPO design is **Ken's explicit vision**: prompt = prior session context, chosen = actual utterance, rejected = base-model output. My topic-matched cross-politician-negative alternative was discussed and dropped because no parallel Q&A data exists; the collinearity risk it addressed is instead handled by the phase-2 cosine kill check (spec §6).
- Rejected completions = base model **role-playing the specific politician** (not generic assistant) — chosen deliberately so DPO trains against the caricature the paper's abstract attacks.
- UTAS agreement was chosen as headline metric specifically because it is external and untouched by training/BO; scaling-space position was rejected as primary due to circularity + the embedding-instability findings in `specs/ensemble-scaling-reliability/`.

## Trainer contract (verified — `../idea/persona/code/train_one_politician_persona.py`)

- TRL `DPOTrainer` reads string columns `prompt`/`chosen`/`rejected`; `accepted` is auto-renamed to `chosen`. Extra columns are harmless (`remove_unused_columns=False`).
- `DPOConfig(max_length=1024)` caps **prompt + completion** (tokens). Default model `Qwen/Qwen2.5-0.5B-Instruct`; LoRA r=16 on q/k/v/o_proj; `--quantize` → 4-bit QLoRA. README is empty.
- Export uses a **char budget as a token proxy** (JA ≈ 1 tok/char); `--max-context-chars` default 1200 keeps prompts safely under the cap. Prompt = optional 「あなたは〇〇議員です…」 header + up to K preceding speeches + `〇〇（会派）：` cue (identical string reused for the rejected generation).

## `rejected` = Gemini caricature (deviation from spec §2.2, agreed with Ken)

Spec §2.2 said `rejected` = the *base model (Qwen)* role-playing the anchor. We instead use **Gemini 2.5-flash-lite** (generic strong-LLM caricature): cheaper (API, no GPU), fits the repo's Gemini-first convention. DPO signal shifts from "real vs the policy's own caricature" to "real vs a capable LLM's role-play." Documented in `generate_polis_rejected.py`. Cost is negligible: measured ~600 input / ~250 output tokens per call → ~$0.0002/call at flash-lite pricing ($0.10/$0.40 per 1M in/out); even ~20k pairs/anchor × 10 anchors ≈ $36. Bounded further by `--max-pairs`.

## Data-prep pipeline (all in `data/`, all done + verified)

1. `select_polis_anchors.py` → `data/data/polis/anchors.json` (anchor list + coverage report). Coverage source = `ideology.json.gz` (person_id-keyed 1D scaling, 631 pols × 60 axes; per-axis span coverage since axes have independent orientation). Note: coverage-optimal ≠ party-span-complete — greedy `--max-anchors 4` keeps 上田清司 over 山本太郎; use `--parties` to force ideological endpoints.
2. `export_polis_dpo_pairs.py --person-id <id> --max-pairs N` → `data/data/polis/dpo_pairs/{id}.jsonl` (prompt/chosen).
3. `generate_polis_rejected.py --person-id <id>` → `data/data/polis/dpo_pairs_full/{id}.jsonl` (adds Gemini `rejected`; resumable).

## Dev-scale run — COMPLETE (2026-07-05)

Full pipeline run for 4 dev anchors (`--max-anchors 4`, `--max-pairs 1500`):
**6000 complete DPO triples** in `data/data/polis/dpo_pairs_full/{152,3631,2377,5520}.jsonl`
(岸田文雄 自民 / 福島みずほ 立憲 / 塩川鉄也 共産 / 上田清司 民主). Spot-checked: real-vs-caricature
contrast is meaningful (real politician's rhetorical edge vs Gemini's flattened stereotype).
`generate_polis_rejected.py` gained `--workers` (thread pool, default 8) for throughput; the run
took ~1 hr. Ready to feed `../idea/persona` DPO trainer at 0.5B.

## Phase 0 — laptop toolchain gate (session 2026-07-05b)

**Core loop PROVEN at 0.5B.** Anchor 152 (岸田) DPO-trained to completion (188 steps, ~19 min, final `train_loss` 0.094, `rewards/accuracies` 1.0, `rewards/margins` 8.0 → the adapter reliably prefers the real utterance over the Gemini caricature). Adapter at `../idea/persona/code/output/polis_152_kishida/`. The option-logprob scorer then ran base-vs-adapter on two real UTAS-2024 items — the full **load → forward → option-logprob → argmax/expectation** loop closes.

**Findings (honest, worth keeping):**
- **0.5B Likert discrimination is weak.** Length-normalised per-option log-probs are near-flat → the answer distribution is close to uniform. This is the spec §6 risk "0.5B may fail at reliable Likert answering" *observed*, and is the empirical case for the 7–8B main run. (Raw *summed*-logprob softmax collapses degenerately to ~1.0 on the shortest option — a length artefact; the scorer therefore builds `probs`/`argmax`/`expectation` from **length-normalised** log-probs. If 7–8B is still weak, switch to numeric-label scoring: enumerate options in the prompt, score the "1".."5" token.)
- **The metric responds to the adapter, directionally correctly for an LDP anchor:** small-government item expectation 3.08 → 2.82 (toward *agree*); nuclear item argmax shifts toward "…Bに近い" (retain nuclear). Shifts are small — expected, since the DPO adapter learns register/rhetoric at 0.5B, not survey-answering.

**Still open in Phase 0:** QLoRA ~3B smoke test; BO backend choice (Optuna TPE vs BoTorch GP).

## Phase 2a — anchor-delta cosine kill-check: **PASSED** (session 2026-07-05b)

All 4 anchors trained at 0.5B (152 岸田, 3631 福島, 2377 塩川, 5520 上田; adapters in `../idea/persona/code/output/polis_*`). Ran `anchor_delta_cosine.py` (new, in persona repo) over the reconstructed ΔW=(α/r)·B·A vectors:

- **Pairwise cosine max 0.058, mean 0.047** (all pairs ~0.04–0.06 regardless of party). Delta norms 0.76–0.82 (real signal, consistent across anchors).
- **The spec §6 collinearity risk did NOT materialize** — anchors are near-orthogonal in weight space, so the merge has plenty of per-anchor residual to interpolate. The negative-design worry ("shared real-register direction dominates") is retired for the 0.5B dev scale. (Caveat to re-check at 7–8B: high-dim LoRA deltas are somewhat orthogonal by default; the consistent substantial norms argue it's genuine, but re-run this check on the main model.)

Note: the 3-anchor sequential run was ~1–2 h/anchor (vs 19 min for 152) — thermal throttling / overnight contention on the laptop, not a correctness issue; all adapters saved with margins ~6.8, accuracies 1.0.

## Phase 3 start — DARE-TIES merge smoke test: **PASSED** (session 2026-07-05b)

`merge_anchors_dare_ties.py` (new, persona repo) loads base + all 4 anchors into one PeftModel and builds a uniform `add_weighted_adapter(combination_type="dare_ties", density=0.1)` merge (density 0.1 = spec's ~0.9 drop rate). Merged model answers cleanly through the option-logprob scorer — the **merge → forward → option-logprob** path is proven at 0.5B.

- Uniform-merge sanity: nuclear item E[1..5] 2.97 (base) → 2.50 (merged, toward "abolish"), consistent with 3 of 4 anchors (福島 SDP, 塩川 JCP, 上田) leaning anti-nuclear vs the lone LDP anchor. The metric responds to anchor composition as expected.
- Uses PEFT's built-in global per-adapter weighting; the **custom layer-group merge** for BO (§2.4) is still to be written.

### What is now DONE at 0.5B dev scale (all green)
Phase 0 loop · 4 anchor adapters · Phase 2a cosine kill-check · Phase 3 DARE-TIES merge path. New scripts: `data/polis_option_logprob.py` (kokkai), `anchor_delta_cosine.py` + `merge_anchors_dare_ties.py` (persona repo).

### Original session-start state below

State at time of writing:

- **Persona venv confirmed working.** `/root/projects/idea/persona/.venv/bin/python` has torch 2.12.0+cu130 (CUDA available), trl 1.4.0, peft 0.19.1, transformers 5.9.0, bitsandbytes 0.49.2. RTX 3070 8GB, Qwen2.5-0.5B-Instruct already in HF cache. The `../idea/` access-rejection caution from the prior session no longer applies — reads succeeded this session.
- **Trainer invocation (verified command):**
  ```
  /root/projects/idea/persona/.venv/bin/python \
    /root/projects/idea/persona/code/train_one_politician_persona.py \
    --data /root/projects/kokkai_analysis/data/data/polis/dpo_pairs_full/152.jsonl \
    --model Qwen/Qwen2.5-0.5B-Instruct \
    --output /root/projects/idea/persona/code/output/polis_152_kishida --epochs 1
  ```
  188 steps (1500 pairs, batch 1 × grad-accum 8, 1 epoch), ~6 s/it → ~18 min, ~6.8/8 GB VRAM. Anchor 152 (岸田) adapter is the first-trained. **Adapters live in the persona repo's `code/output/`, not this repo** (per the spec's code-home split).
- **Option-logprob scorer built (this repo):** `data/polis_option_logprob.py` — the spec §4.4 headline-metric primitive. `score_options(model, tokenizer, system, question, options)` → summed/length-normalised log-probs, softmax option distribution, argmax, and 1..N expectation (MAE-ready for Likert). Model-agnostic; run with the persona venv. Ships the standard UTAS scales in Japanese (`LIKERT_AGREE_JA` = Q4 agree/disagree, `AB_SCALE_JA` = Q5 A/B) and a `--demo` mode running two real UTAS-2024 items (small-government Q4_5, nuclear Q5_6) as the base-model UTAS-format reliability check.
- **UTAS parsing facts (verified):** CSV names/kana are **Shift-JIS** (`＝` between surname/given, `・` in kana), not UTF-8. Policy Likert items are coded `Q4_*` (5-pt agree/disagree) and `Q5_*` (5-pt A/B); English question wording + option labels are in the `.docx` codebook (`word/document.xml` inside the zip). Party is a numeric code.

**Remaining in Phase 0 (not yet done):** run the scorer `--demo` on the 0.5B base + validate the 152 adapter (`validate_persona.py`) once training finishes (blocked on VRAM while training runs); QLoRA smoke test up to ~3B; BO backend choice (Optuna TPE vs BoTorch).

## UTAS name-matching infra — DONE (session 2026-07-05c)

Resume-order item 3 built and verified. `data/match_utas_to_person.py` maps each
UTAS candidate → kokkaidoc `person.person_id` via the **live local Postgres**
(`kokkaidoc` DB, peer-auth as `postgres` OS user, or password from
`data/.env:PSQL_DATABASE_PASSWORD` for a psycopg2 connection — system `python3`
has psycopg2, the persona venv does **not**). Reuses `dbio.representative_db`
(`connect_db`, `get_person_by_column`, `get_closest_person_by_name`) + pg_trgm
`similarity()`.

- **Matcher instead of speech-string matching.** The `person` table (4818 rows:
  `person_id`, `name_kanji`, `name_kana` hiragana, `election_signature`) *is* the
  id map — cleaner than the speaker/speakerYomi route the old plan assumed. Strip
  UTAS `＝`/`・` separators, then tiered match: kanji-exact → kanji+kana
  disambiguation → kana-exact → pg_trgm fuzzy (review-only, never auto-accepted).
- **Output:** `data/data/u-tokyo-asahi/person_map/{wave}.json` (confident map
  `utas_id → {person_id, tier, …}`) + `{wave}.review.json` (ambiguous/fuzzy/none).
- **Match rates:** 2024HoR 683/1344, 2021HoR 641/1051, 2022HoC 297/668, 2019HoC
  280/491. The ~50% is a genuine **coverage ceiling**, not a matcher bug: top
  fuzzy scores are ~0.15 (e.g. 小林悟→小林元), i.e. the unmatched are losing /
  non-Diet candidates absent from `person` (which is built from Diet members).
  Confident tiers are all exact — trustworthy. HoC waves lack a KANA column →
  kanji-only there (handled).
- **All 4 anchors resolve, in their correct chamber (wave selection §4.4):**
  岸田(152)→2021HoR/2024HoR · 塩川(2377)→2021HoR/2024HoR · 福島(3631)→2019HoC/2022HoC ·
  上田(5520)→2022HoC. **2024HoR + 2022HoC together cover all four** → use those two
  waves for the headline metric. Same person keeps the same person_id across waves.

**Next after this:** extract the actual UTAS Likert answers (`Q4_*` 5-pt
agree/disagree, `Q5_*` 5-pt A/B; English wording in the `.docx` codebook
`word/document.xml`) for the matched anchor person_ids → ground-truth vector for
`data/polis_option_logprob.py`. That closes the real headline metric (the 0.5B
`--demo` was only a mechanism check).

## UTAS ground truth + real headline metric — DONE (session 2026-07-05d)

The real headline metric (spec §4.4) now runs end-to-end on **actual UTAS answers**,
not the `--demo` mechanism check.

- **`data/build_utas_ground_truth.py`** → `data/data/polis/utas_ground_truth/{wave}.json`.
  Parses each wave's `.docx` codebook (tables + paragraphs flattened; regex guards the
  item body from spanning across `(Qn_...` markers — needed because the 2024 codebook has
  many parenthesised numbers before Q4) into the Q4_* (5-pt agree/disagree) + Q5_* (5-pt
  A/B) catalog, attaches the anchor's coded answers (`99`/`66`/blank → null), keyed by
  person_id via `person_map/{wave}.json`. **2022HoC codebook is native Japanese** (used
  verbatim, `provenance: native`); **2024HoR is English-only** → translated to Japanese
  once via **Gemini 2.5-flash** (`--translate`, temp 0, `provenance: translated_from_en`;
  `source_text` keeps the English for review). Built for the two anchor waves:
  - `2022HoC.json` — 37 items; 福島みずほ 37/37, 上田清司 37/37.
  - `2024HoR.json` — 33 items; 岸田文雄 33/33, 塩川鉄也 22/33 (塩川 skipped most Q5 with 99).
- **`data/polis_option_logprob.py` gained `--utas-eval <wave.json> --person-id <id>
  [--adapter ...] [--neutral]`** (`evaluate_anchor()`): administers every answered item
  to the persona (named-anchor system prompt by default, mirroring the DPO training
  header; `--neutral` = weights-only persona), scores via the existing option-logprob
  primitive, reports per-item truth vs argmax vs E[1..5] and aggregate MAE(argmax),
  MAE(E), exact, within-1.

**First real numbers — 岸田 (152), 2024HoR, 33 items, named persona:**

| model | MAE(argmax) | MAE(E) | exact | within-1 |
|---|---|---|---|---|
| base 0.5B | 1.152 | 0.764 | 0.273 | 0.667 |
| 岸田 DPO adapter | 1.545 | 0.753 | 0.182 | 0.545 |

**Honest reading (the mechanism is proven; the 0.5B signal is not):** the loop
real-truth → administer → option-logprob → MAE closes. But at 0.5B **argmax is
noise** — it collapses degenerately (base → option 1 across Q5, adapter → option 5),
so the adapter's argmax metrics look *worse* while MAE(E) barely moves (0.764 → 0.753,
E stays pinned near 3.0). This is exactly the Phase-0 "weak Likert discrimination"
finding, now quantified against real ground truth, and is the baseline the 7–8B main
run must beat. **Actionable next:** at 7–8B, if argmax is still degenerate, switch to
numeric-label scoring (enumerate options, score the "1".."5" token) per the Phase-0 note.

## Numeric-label scoring tested at 0.5B — does NOT rescue the metric (session 2026-07-05e)

The Phase-0 note (repeated in two prior sections) said: "if argmax is still degenerate,
switch to numeric-label scoring (enumerate options, score the '1'..'N' token)." Built it
(`score_options_numeric` + `evaluate_anchor(numeric=True)` + `--numeric` flag in
`data/polis_option_logprob.py`) and A/B'd it against verbose-option scoring on 岸田 (152),
2024HoR, 33 items:

| model | scoring | MAE(argmax) | MAE(E) | exact | within-1 |
|---|---|---|---|---|---|
| base 0.5B | verbose-option | 1.152 | **0.764** | 0.273 | 0.667 |
| 岸田 adapter | verbose-option | 1.545 | 0.753 | 0.182 | 0.545 |
| base 0.5B | numeric-label | 1.545 | 1.38 | 0.182 | 0.394 |
| 岸田 adapter | numeric-label | 1.545 | 1.45 | 0.182 | 0.394 |

**Numeric-label is strictly worse at 0.5B.** It swaps one degeneracy for another: verbose
scoring collapses toward register/length (E pinned ~3.0), numeric scoring collapses to a
**first-option / "agree" bias** — argmax = "1" on all 33 items, high-confidence (p≈0.94–0.98
on content items).

Diagnosed the mechanism (throwaway probe: score `score_options_numeric` on a content-free
"（内容なし）"/empty question vs. real items, normal vs. reversed option order), and it kills the
obvious fix:
- **Content-free** prompts ("（内容なし）"/empty) peak at label **"2"** (0.45–0.58), *not* "1".
- **Content-bearing** prompts collapse to **"1"** — incl. an absurd sanity item ("consumption
  tax to 100% immediately" → "そう思う"/agree at p=0.98). The 0.5B model genuinely lacks Likert
  competence; this is spec §6's risk, now nailed for *both* scoring modes.
- Because the content-free prior (≈"2") ≠ the content collapse ("1"), **contextual calibration**
  (Zhao et al. — divide by null-prompt prior) will *not* cleanly remove it. Reversing option
  order *does* move the distribution (some content sensitivity), so **permutation / order-averaging
  debiasing (PriDe-style)** is the better companion to numeric scoring — but it can't be validated
  at 0.5B (model is incompetent on the absurd item), so it's left as a **7–8B main-run task**, not
  built now (per build-then-port discipline).

**Decision:** keep the numeric-scoring code (it's the planned 7–8B path) but **use verbose-option
E[1..5] as the least-bad 0.5B proxy**. The metric-reliability question defers to the Studio 7–8B
run exactly as the spec anticipated. At 7–8B: try numeric-label **with order-averaging**; if argmax
is usable there, it becomes primary.

## Suggested resume order

0. **Real headline metric + UTAS ground truth** ✅ **DONE** (2026-07-05d, section above).
1. ~~**Anchor-delta cosine kill check (Phase 2a)**~~ ✅ **DONE** (2026-07-05b, PASSED — near-orthogonal, section above).
2. ~~**DARE-TIES merge smoke test (Phase 3 start)**~~ ✅ **DONE** (2026-07-05b, PASSED, section above). Custom layer-group weighting is the later BO surface.
3. ~~**UTAS name-matching infra**~~ **DONE** (2026-07-05c, see section above).
4. ~~**Numeric-label scoring** to fix degenerate argmax~~ ✅ **DONE** (2026-07-05e, section above) — tested & rejected at 0.5B (worse than verbose); deferred to 7–8B with order-averaging. Verbose E[1..5] is the 0.5B proxy.
5. **Remaining Phase 0 loose ends:** QLoRA ~3B smoke test; BO backend choice (Optuna TPE vs BoTorch GP). ← *cheapest laptop-runnable next steps.*
6. **ICL baseline kill check (Phase 2b)** once a pilot target exists. NB: at 0.5B all methods sit near the same degenerate floor, so this gate is only decisive at 7–8B — run it there, or expect an inconclusive dev-scale result.
