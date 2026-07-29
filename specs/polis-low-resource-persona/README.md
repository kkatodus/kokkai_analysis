# POLIS — Parameter Optimization for Low-resource Ideological Simulation

**Status:** draft
**Paper skeleton:** [`paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex`](../../paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex)
**Target venue:** ACL/EMNLP-track NLP conference (method + automatic eval; human eval optional appendix)
**Code home:** [`research/polis/`](../../research/polis/) — the whole pipeline (dataset export, DPO training, merging, BO, UTAS eval) lives there alongside the spec and the paper. Consolidated 2026-07-29 from the retired `idea/persona` repo plus the POLIS scripts formerly in `data/`; see [research/README.md](../../research/README.md).
**Related guides:** [RESEARCHER.md](../../docs/agents/RESEARCHER.md) · [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md) · [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md)
**Sibling spec:** [`ensemble-scaling-reliability`](../ensemble-scaling-reliability/README.md) — shares the UTAS candidate-name-matching infrastructure (build once, use in both).

## 1. Headline claim

For a politician with little available text, an **optimized weight-space merge of adapters trained on data-rich politicians** reproduces the target's ground-truth ideological positions better than (a) fine-tuning directly on the sparse data (SFT *and* DPO) and (b) prompting-based approaches.

Everything in the experimental design serves this one falsifiable comparison. Secondary narratives (caricature/bias reduction, layer-wise vs. global merging) are supporting analyses, not headline claims.

**Testbed:** Japanese Diet members only. One deep domain with real, externally collected ground truth (UTAS candidate surveys) beats two shallow domains without it.

## 2. Method pipeline

### 2.1 Anchor set (data-rich adapters)

- **~6–10 anchor politicians**, selected for **ideological coverage**: the most speech-rich politician(s) per party/bloc, spanning LDP factions through JCP.
- Coverage is verified quantitatively against existing scaling positions (`s3_mirror/kokkai-doc/ideology/`) and/or UTAS answers before training — the merge can only express ideologies inside the anchors' span.
- Anchor-set size is an ablation (§4.3).

### 2.2 DPO training data (session-grounded preference pairs)

One instance per real utterance by the anchor in a Diet session:

| Field | Content |
|---|---|
| `prompt` | Last **K** speeches preceding the target utterance in the same session (K ≈ 3–5), truncated to a **1–2k token budget**, always keeping the immediately preceding speech intact (it is usually the question being answered) |
| `chosen` | The politician's **actual next utterance** in the session |
| `rejected` | The **base model role-playing that politician** ("あなたは〇〇議員です…") on the same session context |

Rationale, recorded from design review:

- No parallel Q&A corpus exists (no two politicians answered the same context), so cross-politician negatives are not constructible in this design — and are not needed.
- The rejected side makes the paper's caricature critique the *literal training signal*: the adapter learns "the real politician, not the LLM's stereotype of them."
- Ideological contrast **between** anchors comes from the `chosen` side (each anchor's real responses carry their positions). The shared "real Diet register, not LLM role-play" direction across anchors is *desirable* in the merged persona; TIES sign-resolution preserves consistent shared directions while anchor-specific residuals carry the interpolation signal.

Source data: `data/data/repr_speeches_id_organized/{person_id}/all_speeches.jsonl` (+ session/issue context from `data_all_speeches/`). Export script: `research/polis/export_polis_dpo_pairs.py`; output JSONL matches the `prompt`/`chosen`/`rejected` format `research/polis/train_one_politician_persona.py` consumes.

### 2.3 Merging: DARE-TIES over anchor LoRA deltas

- Merge the anchor LoRA deltas with DARE (drop-and-rescale) + TIES (sign resolution), weighted by mixing coefficients.
- **DARE drop rate fixed (~0.9)** with a sensitivity check — *not* part of the BO search space (amendable default).
- PEFT's `add_weighted_adapter(combination_type="dare_ties")` covers global per-adapter weights; **layer-group-wise weighting needs custom merge code** (straightforward tensor arithmetic over the deltas) — budgeted as an implementation task.

### 2.4 Bayesian optimization of mixing coefficients

- **Search space: layer-groups × anchors.** Layers partitioned into 3–4 depth groups (e.g. lower/middle/upper) → ~24–32 dimensions with 8 anchors. Honestly "layer-wise" (coefficients vary by depth) while staying inside vanilla-BO territory.
- Ablation bookends: global per-anchor (~8 dims) and full layer-wise (~192 dims, only if a high-dim method like TuRBO/SAASBO proves workable) — yields a granularity-vs-optimizability curve.
- **Objective: k-fold cross-validated NLL** of the target's sparse session-grounded instances under the merged model, k = min(5, budget) (amendable default).
- Each BO evaluation = merge + forward passes (no training) → cheap even at 7–8B.
- BO library (Optuna TPE vs. BoTorch GP) is a phase-0 decision (amendable default).

## 3. Models & infrastructure

- **Main model:** ~7–8B Japanese-capable instruct — Qwen2.5-7B-Instruct or Llama-3.1-Swallow-8B. Requirement that drove this choice: the headline metric needs reliable Likert-format answering in Japanese, which a 0.5B model may simply fail at.
- **Dev loop + scale ablation:** Qwen2.5-0.5B-Instruct (the `research/polis` trainer default).
- **Dev hardware (now):** local laptop — RTX 3070 Laptop, **8GB VRAM / 64GB RAM**, CUDA 13.2 driver, WSL2, Python 3.10.12, `uv`. The 512GB Mac Studio is delayed, so the entire toolchain is built and validated here first: everything runs at **0.5B** (full LoRA/DPO), with **QLoRA reaching ~3B** to exercise the pipeline near main scale. 7–8B main-run training does **not** fit and is deferred to the Studio.
- **Main-run hardware (later):** 512GB unified-memory Mac Studio. Memory is not the constraint there; **throughput is**. Cross-platform port: dev is CUDA/PyTorch (TRL/PEFT + bitsandbytes QLoRA); the Studio is Apple Silicon (MLX or TRL/PEFT on MPS). MLX-trained adapters need conversion before PyTorch-side merging/PEFT tooling — the MLX-vs-MPS throughput spike happens **when the Studio arrives**, not now.

## 4. Experimental design

### 4.1 Main protocol: synthetic sparsity

- **Targets:** 15–20 speech-rich politicians *excluded from the anchor set*, stratified across parties.
- **Budgets:** each method sees only {5, 20, 50} of the target's speeches; the rest is held out.
- **Skyline:** full-data DPO adapter per target (upper bound).
- Produces the paper's key figure: resource-vs-fidelity curves per method.

### 4.2 Case study: genuinely sparse politicians

3–5 real backbenchers/first-termers with few speeches, evaluated on UTAS agreement only (no held-out text exists). Demonstrates the actual motivating use case.

### 4.3 Baselines (all must-have)

1. Zero-shot role-play prompting (base model)
2. **ICL:** base model + the target's budget speeches in-prompt — *the cheapest strong competitor; if it matches POLIS the method is unnecessary. Kill criterion — run early (phase 2).*
3. SFT on the sparse target data
4. DPO on the sparse target data
5. Uniform DARE-TIES merge of all anchors
6. Best single anchor adapter
7. POLIS (full method)

Ablations: layer-group vs. global vs. full layer-wise coefficients; anchor-set size; model scale (0.5B vs. 7–8B); DARE drop-rate sensitivity.

### 4.4 Evaluation

**Primary (headline): UTAS answer agreement.**

- Administer UTAS policy items (defence, nuclear restart, tax, …) with enumerated answer options; the persona's answer = argmax / expectation over **option log-probabilities** (no free-text parsing failures; expectation gives a continuous position for MAE on Likert items, accuracy on categorical items).
- UTAS is never touched by training or BO — clean external ground truth.
- Small free-generation consistency check in the appendix.

**Secondary:** held-out NLL on the target's full corpus (synthetic-sparsity arm); stance-embedding distance via the existing scaling pipeline (noting its instability per the `ensemble-scaling-reliability` findings); caricature/bias reduction vs. zero-shot as a supporting analysis, not a headline claim.

**Temporal alignment:** pick **one anchor UTAS wave** — 2021HoR or 2024HoR, whichever maximizes matched politicians after name matching — and restrict all training/eval speech data to a window around it (the preceding Diet term). Kills the position-drift confound at the cost of some training data for long-serving anchors.

**Mechanism analysis (must-have):** correlate learned mixing coefficients with (a) anchor–target ideological distance (UTAS/scaling) and (b) anchor–target topic-distribution overlap (from `repr_speeches_id_organized/` topic files). This measures, rather than assumes, whether POLIS does *ideological interpolation* or *topic matching* — either outcome is publishable if reported honestly.

## 5. Phases

| Phase | Gate / deliverable |
|---|---|
| **0 — Laptop toolchain check** | On the RTX 3070 laptop (CUDA/PyTorch): stand up TRL/PEFT DPO for one anchor at 0.5B and a QLoRA smoke test up to ~3B; confirm the merge → forward-pass → option-logprob loop end-to-end at dev scale; zero-shot UTAS-format answer reliability of the 0.5B base (7–8B check deferred to the Studio); BO library choice. **Gate: lock the dev toolchain + BO backend; validate the full pipeline at 0.5B before porting.** *(Deferred to Studio arrival: MLX-vs-MPS throughput spike + 7–8B feasibility.)* |
| **1 — Data & shared infra** | DPO-pair export pipeline (session windowing, role-play rejected generation); UTAS candidate-name matching (shared with `ensemble-scaling-reliability`); wave selection; anchor-set selection with coverage verification. |
| **2 — Anchors + early kill checks** | Train all anchor adapters. **Immediately check:** (a) pairwise cosine of anchor deltas — near-collinear anchors invalidate the design; (b) run the ICL baseline — if it matches merged personas on a pilot target, reassess before building the full matrix. |
| **3 — Merging + BO** | Custom layer-group DARE-TIES merge code; BO loop; pilot on 2–3 targets. |
| **4 — Full matrix** | 15–20 targets × 3 budgets × 7 methods; case-study politicians; ablations. |
| **5 — Analysis & paper** | Mechanism analysis, significance tests (paired across targets), qualitative case studies, write-up into the existing LaTeX skeleton. |

## 6. Risks (recorded, with detection points)

| Risk | Detection | Response |
|---|---|---|
| ICL baseline matches POLIS | Phase 2 pilot | Reframe (e.g. POLIS + ICL complementarity) or kill |
| Anchor deltas near-collinear (shared direction dominates) | Phase 2 cosine check | Revisit negative design (hybrid negatives / two-stage register adapter were considered and deferred, not rejected) |
| 7–8B DPO won't fit the laptop; MPS/MLX throughput at 7–8B unknown until Studio | Phase 0 (dev at 0.5B/QLoRA-3B); re-checked at Studio arrival | Validate pipeline at dev scale first; on the Studio drop to a smaller main model or rent CUDA time for anchor training only |
| CUDA-dev → Apple-Silicon-run port breaks (adapter/format friction) | Studio-arrival port | Keep training in TRL/PEFT on MPS (skip MLX) if conversion proves costly |
| 7–8B model unreliable at Likert answering even zero-shot | Phase 0 | Swap base model candidate |
| Coefficients track topics, not ideology | Phase 5 mechanism analysis | Honest reporting; still a publishable finding |
| UTAS name-matching yields too few matched politicians | Phase 1 | Switch anchor wave; fall back to per-politician nearest wave |

## 7. Amendable defaults (set by spec, not yet validated)

- DARE drop rate ≈ 0.9, fixed, with sensitivity check
- k-fold CV with k = min(5, budget)
- BO backend: Optuna TPE or BoTorch GP — phase-0 choice
- Context window: K = 3–5 prior speeches, 1–2k token cap
- Layer groups: 3–4 depth-based partitions

## 8. Out of scope

- English / second-domain replication (single-domain by design)
- Human evaluation as a primary metric (optional confirmatory appendix at most)
- Serving POLIS personas on the KOKKAI DOC site (separate future spec if ever)
- BO-tuning the DARE drop rate
