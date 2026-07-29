# POLIS — session handover (2026-07-04)

Context for resuming work after a session clear. Read [README.md](./README.md) (the spec) first; this file covers only what the spec does not: session state, environment facts, and next actions.

---
> ## 📁 CODE MOVED (2026-07-29) — read before following any path below
> All POLIS code now lives in **`research/polis/`** in this repo. The separate `idea/persona` repo is retired
> and its contents were merged in, along with the POLIS scripts that used to sit in `data/`. Sections below are
> a chronological log and still name the **old** paths; translate them:
>
> | Old | New |
> |---|---|
> | `../idea/persona/code/*.py` | `research/polis/*.py` |
> | `../idea/persona/code/output/` | `research/polis/output/` (gitignored, ~1 GB) |
> | `data/{polis_option_logprob,export_polis_dpo_pairs,generate_polis_rejected,select_polis_anchors,build_utas_ground_truth}.py` | `research/polis/` (same filenames) |
> | `artifacts/run_7b_bo_gpu.sh`, `run_7b_bo_overnight.sh` | `research/polis/scripts/` |
> | `../idea/persona/.venv/bin/python` | `research/.venv/bin/python` (`research/requirements.txt`) |
>
> `from params.paths import DATA_DIR` became `from paths import DATA_DIR` (`research/polis/paths.py`), which also
> honours `KOKKAI_DATA_DIR` / `KOKKAI_S3_MIRROR` for boxes without the data drive. `bo_merge_coeffs.py` no longer
> needs `KOKKAI_REPO` — the UTAS scorer is a sibling import now. Run logs stay under `specs/.../artifacts/`.
> Verified after the move: `merge_layer_group.py` self-test at 0.5B prints four distinct NLLs and an exact restore.
---
> ## 🔴 START HERE (latest, 2026-07-26 — nested-CV + 7B orthogonality DONE; only the 7B merge table is left)
> **Two more results are in the paper, both laptop-only.** (1) **Nested 5-fold CV at 0.5B on all 3 genuine held-out
> targets** (spec §2.4, resume item 6b — was the last open Phase-3 item): POLIS beats best-single in **15/15 folds**
> and base in **14/15**, unbiased, now `\ref{tab:nested-nll}` in the paper. (2) **7B anchor-delta cosine re-check**
> (Result D's "re-check at 7B" caveat, now closed): max 0.090 / mean 0.076, norms 1.25–1.33 — and the off-diagonals
> **separate by bloc at 7B** (every left–left pair ≈0.088 > every pair with the LDP anchor ≈0.064), which at 0.5B they
> did not. First weight-space evidence that the deltas encode ideology, not only register.
> **Environment (bit us this session, see "Migration fallout"):** workspace moved root → user `ken`; datasets live in
> `D:\wsl_data.vhdx` mounted at `/mnt/wsl/wsldata` (use `kdata mount`, added to `~/.zshrc`); HF cache was lost.
> **Still pending, unchanged:** the **7B merge-method comparison** (base/uniform/best-single/POLIS × NLL + UTAS × 3
> targets). Driver is written and preflight-gated: **`research/polis/scripts/run_7b_bo_gpu.sh`**. Needs ~31 GB VRAM (15.2 GB model
> + 13.2 GB fp32 anchor deltas); 40 GB floor, 48 GB comfortable. Estimated **~1 GPU-hour**, i.e. ~$5–20 rented — the
> "compute wall" is the 8 GB laptop, not the job.
---

## Session 2026-07-26 — nested CV, 7B orthogonality, migration fallout

**Results added to the paper** (`main.tex` rebuilds clean, 12 pp, xelatex):

1. **Nested 5-fold CV at 0.5B, all 3 held-out targets** (`artifacts/nested_cv_05b/target_{1279,2053,2289}.log`),
   budget 30 / 40 GP trials per fold, all methods rotated over identical folds:

   | target | base | uniform | best-single | **BO** | Δ vs base (folds won) | Δ vs best-1 (folds won) |
   |---|---|---|---|---|---|---|
   | 1279 高市 | 2.875 | 4.046 | 2.932 | **2.842** | +0.033 ± .006 (5/5) | +0.090 ± .026 (5/5) |
   | 2053 赤嶺 | 2.938 | 4.026 | 2.986 | **2.894** | +0.045 ± .025 (4/5) | +0.092 ± .020 (5/5) |
   | 2289 枝野 | 3.173 | 4.250 | 3.179 | **3.107** | +0.066 ± .019 (5/5) | +0.072 ± .011 (5/5) |

   **15/15 folds vs best-single, 14/15 vs base** (the miss is one 赤嶺 fold, −0.003 = a wash). Absolute values differ
   from the single-split Table 1 because CV scores the 30-utterance budget itself, not a disjoint later block — noted
   in the paper so it doesn't read as an inconsistency. Best-single picked 岸田 in **all 15 folds**, consistent with
   the standing "岸田 = shared fluent-Diet-register backbone at 0.5B" finding.

2. **7B anchor-delta cosine (Result D at main scale)** — `anchor_delta_cosine.py` on the four `*_qwen7b` adapters,
   822,083,584 adapted params each, CPU-only (~13 GB RAM), no base model needed:
   max 0.090 / mean 0.076, norms 1.25–1.33 (0.5B was max 0.058 / mean 0.047, norms 0.76–0.82). Collinearity risk
   retired at 7B. **New:** bloc structure — JCP–SDP 0.090, SDP–DP 0.089, JCP–DP 0.086 vs **every** LDP pair 0.063–0.065.
   3 pairs per side, so suggestive not significant; reported that way.

3. **Granularity ablation bookends** (spec §2.4/§4.3, resume item 6b's other half — `bo_granularity_ablation.py`,
   first ever run). Target 1279, nested 4-fold CV, budget 30. Logs: `artifacts/nested_cv_05b/granularity_1279*.log`.

   | granularity | dims | sampler | 20 trials/fold | 60 trials/fold |
   |---|---|---|---|---|
   | global | 4 | GP | 2.8504 | 2.8473 |
   | layer-group | 12 | GP | 2.8573 | **2.8427** |
   | full-layer-wise | 96 | TPE | 3.4408 | — (infeasible) |

   (base 2.8804 · uniform 4.0500 · best-single 2.9376 throughout.)

   **⚠️ This forced a correction to the paper.** Two sentences claimed layer-group granularity was "the right knob"
   and added fidelity "beyond … a global weight". Neither is supported: the global↔layer-group gap is ≤0.005 nats
   and **changes sign with trial budget**, against a ±0.11 fold spread. Both were rewritten; the paper now says
   explicitly that per-depth granularity is *expressible and not harmful* but **not shown to improve fidelity at
   0.5B**. New `\paragraph{Granularity versus optimizability}` (`sec:granularity`) reports the full curve.

   What *is* solid: (a) only layer-group improves with more search (2.857→2.843) while global is converged at 20
   trials (2.850→2.847) — the extra dims carry usable signal but cost budget; (b) **full-layer-wise at 96 dims is
   worse than not merging at all** (3.441 vs base 2.880), drifting toward the uniform-merge failure — 20 trials
   cannot locate 96 coefficients, and bad coefficients actively corrupt the model. That non-monotonic curve is the
   empirical justification for the GP→TPE dimensionality policy, which was previously just asserted.

   **Caveats:** one target only; per-fold numbers aren't printed by the sweep, so global-vs-layer-group can't be
   compared *paired* (which would be far more sensitive) — worth adding if this is pursued. And the question is
   arguably only meaningful at 7B, where adapters carry ideology rather than register; a 7B layer-group-vs-global
   run would supersede all of this.

**Code fixes (persona repo)** — all three were latent breakage or silent-failure risks:
- `bo_merge_coeffs.py`: `/root/projects/...` hardcoding → `KOKKAI_REPO` env var defaulting to a path derived from the
  file location. Fixes the migration; also what makes the GPU port work.
- `merge_layer_group.py`: **`LayerGroupMerger` now raises if any target module is a meta tensor.** This is the bug that
  cost ~days (device_map="auto" offload ⇒ in-place ΔW writes silently no-op ⇒ BO optimises a flat objective). It can no
  longer fail silently.
- Both: `--device` now pins any device (`cuda`, `cpu`), not just `cpu` vs `auto`.

**New driver: `artifacts/run_7b_bo_gpu.sh`** (supersedes `run_7b_bo_overnight.sh`, the CPU attempt). Env-var paths,
explicit 7B adapters (the `output/polis_*` glob mixes 0.5B + 7B + smoke dirs — a silent-nonsense trap), full
budget 30 / test 30 / 40 trials, `NESTED=1` for the CV variant, and a **preflight gate**: runs the merge self-test
first and aborts unless it reports `[OK]` with four distinct NLLs. Do not skip reading those four numbers.

### Migration fallout (2026-07-21, diagnosed 2026-07-26)
Workspace moved **root → user `ken`** (uid 1001). Consequences hit this session:
- Repo now at `/home/ken/workspace/projects/`; **every `/root/projects/...` path in this file and in older code is stale.**
- **Datasets are in a 92 GB ext4 VHDX, `D:\wsl_data.vhdx`**, mounted at `/mnt/wsl/wsldata` — where `data/data` and
  `s3_mirror` symlink. `/mnt/wsl` is tmpfs, so it must be remounted after every `wsl --shutdown`. Added **`kdata
  mount|umount|status`** to `~/.zshrc`. **Trap:** `mount -t drvfs D: /mnt/wsl/wsldata` appears to succeed and shows
  plausible dirs, but that's the raw exFAT drive, not the image — `kokkai_data/` is missing and everything breaks
  confusingly. Correct command needs an **Administrator** shell:
  `Dismount-DiskImage -ImagePath 'D:\wsl_data.vhdx'; wsl --mount --vhd 'D:\wsl_data.vhdx' --name wsldata`.
- **HF cache lost** — 0.5B re-downloaded automatically; 7B (~15 GB) will re-download on first use.
- The persona `.venv` still works despite being built under `/root`.

---
> ## (previous) START HERE (2026-07-07 — paper draft DONE)
> **The "populate the paper with preliminary findings" task is COMPLETE** (see "✅ PAPER POPULATED" section just
> below this banner). `paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex` is now a full
> preliminary draft: all section bodies written, Results A/C/D in `booktabs` tables, honestly framed as preliminary,
> abstract kept verbatim, Ken's reference URLs preserved as source `% TODO(lit-review)` comments. Compiles cleanly
> with **xelatex** (11 pages; `.latexmkrc` sets pdf_mode=5; CJK via xeCJK + IPAexMincho). Methods refs (DPO/DARE/
> TIES/LoRA/QLoRA/Optuna/etc.) added to `references.bib`. **Nothing committed** (repo has many unrelated changes — ask Ken).
> **Next agent options:** (a) let Ken review the PDF/draft and revise; (b) flesh out Related Work / Preliminaries
> (needs real lit review, not our data); (c) when the **Mac Studio** arrives, run the full 7B merge/BO+UTAS
> comparison (the pending Main-Results-at-scale table). No compute pending on the laptop; laptop 7B BO is a confirmed
> dead-end (~days on CPU). Everything below is chronological history.
---

## ✅ PAPER POPULATED with preliminary findings (session 2026-07-07)

Ken's active request is done. `paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex` went
from skeleton → full preliminary draft. What was written:

- **Kept verbatim:** the abstract. **Preserved:** every reference URL Ken left, moved into source
  `% TODO(lit-review)` comments (they carried `&`/`_` that break LaTeX in body text) next to the subsection each belongs to.
- **Filled with real results:** Introduction (+ Contributions), Preliminaries (DPO loss, DARE-TIES), full POLIS
  Framework (problem formulation with the $W=W_{base}+\mathrm{TIES}(\{c_{a,g}\mathrm{DARE}(\Delta W)\})$ formalism),
  Experimental Setup (Datasets/Baselines/Metrics), Results (Main = **Result A** 0.5B NLL table; Ablations + **Result D**
  orthogonality; Qualitative/Main-Scale = **Result C** 7B floor-break table + **Result B** 0.5B degenerate floor prose),
  Discussion/Limitations (compute wall, register-not-ideology, scale-gated Likert), Conclusion, Ethics Statement.
- **Kept light** (need lit review, not our data): Related Work, Preliminaries depth.
- **Honest framing throughout:** a "Preliminary report" note under the abstract states the 0.5B pipeline is fully
  validated, 7B is early/partial, and the full-scale merge comparison is **pending on higher-throughput hardware**.
- **`references.bib`:** added methods refs (rafailov2023direct DPO, yu2024language DARE, yadav2023ties TIES, hu2022lora,
  dettmers2023qlora, qwen2025qwen25, akiba2019optuna, shahriari2016taking, argyle2023out, zhao2021calibrate).

**Build:** compiles clean with **xelatex** → 11-page `main.pdf`, 0 undefined refs/cites, all 7 JA politician names
render (xeCJK + IPAexMincho/IPAexGothic, guarded by `iftex` so pdflatex still builds without CJK glyphs).
Added `.latexmkrc` (`$pdf_mode=5`) so bare `latexmk` uses xelatex, and a `.gitignore` for LaTeX artifacts.
Preamble gained `booktabs, amsmath, amssymb, url, iftex, xeCJK`. **Nothing committed.**

**Pending in the paper (needs Studio):** the main-scale merge-method comparison table (base/uniform/best-single/POLIS
on NLL + UTAS across the 3 targets) — currently Table 1 is the 0.5B result as the Main Result and Result C is the
main-scale proof-of-concept; the 7B merge comparison is described in Discussion as the primary open item.

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

## Phase 0 CLOSED — QLoRA 3B smoke test + BO backend locked (session 2026-07-05f)

The last two Phase-0 loose ends are done; the spec §5 phase-0 gate ("lock the dev
toolchain + BO backend; validate the full pipeline at 0.5B before porting") is met.

**QLoRA ~3B smoke test — PASSED.** `train_one_politician_persona.py --quantize`
(4-bit nf4, bf16 compute, `paged_adamw_8bit`) on **Qwen2.5-3B-Instruct** ran DPO
end-to-end on the 8GB RTX 3070: model loaded in 4-bit, 3 steps on a 24-pair subset
of anchor 152 (~24.5 s/it, ~74s), adapter saved. Proves the toolchain runs
near-main-scale under quantization on the laptop. (Model now in HF cache, 5.8G.
The trainer's `--quantize` path is the one to reuse for any QLoRA anchor training
on the laptop; full 7–8B still deferred to the Studio.)

**BO backend — LOCKED: Optuna harness + native `GPSampler` (GP-BO), TPE fallback
for the high-dim ablation.** Reasoning + empirical grounding:
- The main search (§2.4) is **continuous, ~24–32 dim (layer-groups × anchors),
  expensive evals (merge + forward passes), low budget** → classic GP-BO territory;
  TPE wins only when evals are cheap and dims high/mixed.
- Validated on a synthetic 24-dim mixing-coefficient bowl (smooth + mild coupling +
  small noise), 45-eval budget, `../idea/persona/code/bo_backend_validate.py`:
  **random best 1.18 · TPE 0.64 · GP 0.19** — GP ≈3× better than TPE, ≈6× better than
  random, the expected ordering. Full 3×45-eval sweep incl. GP refits ran in ~7s, so
  harness overhead is negligible next to the real objective.
- **Use optuna's native `optuna.samplers.GPSampler`** (built into optuna 4.9, torch-based)
  — no `optuna-integration[botorch]` needed. Keep **TPESampler** for the ~192-dim
  full-layer-wise ablation bookend (GP scales poorly there; TuRBO/SAASBO via botorch is
  the alternative if that ablation is pursued).
- **Deps installed into the persona venv** (`../idea/persona/.venv`, where BO code lives
  per the code-home split): `optuna` 4.9.0 + `botorch` (the latter only for a possible
  high-dim TuRBO/SAASBO ablation; the locked default `GPSampler` does **not** require it,
  so botorch can be dropped to slim the port if that ablation is cut). Note: this venv is
  **Python 3.14** (not 3.10.12 as an earlier section says for the system python).

**Next real work = Phase 3** (spec §5): custom layer-group DARE-TIES merge code (the
per-layer-group weighting the uniform `add_weighted_adapter` smoke test in Phase 3-start
did *not* cover) → wrap merge+forward+k-fold-CV-NLL as an Optuna objective with `GPSampler`
→ pilot on 2–3 targets. The ICL kill check (Phase 2b) rides along but is only decisive at
7–8B.

## Phase 3 core — custom layer-group DARE-TIES merge + BO loop: **CLOSES at 0.5B** (session 2026-07-05g)

The spec §5 Phase-3 deliverable ("custom layer-group DARE-TIES merge code; BO loop; pilot on
2–3 targets") now runs end-to-end at 0.5B. Two new scripts in the persona repo (`code/`):

- **`merge_layer_group.py` — `LayerGroupMerger`.** The per-layer-group merge PEFT's
  `add_weighted_adapter` cannot do (it only supports one global weight per anchor). Reconstructs
  ΔW=(α/r)·B·A per module, applies **DARE with a fixed seeded drop mask** (density 0.1 → objective
  is deterministic in the coefficients; drop rate is a fixed hyperparam, not a BO dim, per §2.3),
  weights each anchor's delta by `coeff[anchor, depth_group]`, does **TIES** sign-election +
  disjoint-mean, and writes W_base+ΔW into the live model. `apply(coeffs)` restores base then
  re-merges (no reload/train per BO eval); `restore()` is exact (self-test: base NLL 2.0808 →
  merge → restore → 2.0808). 24 layers → 3 contiguous depth groups (0–7 / 8–15 / 16–23). Self-test
  confirms per-group coeffs change behaviour (upper-only ≠ lower-only NLL).
- **`bo_merge_coeffs.py`.** Wraps the merger as an Optuna objective, searches the [n_anchors×n_groups]
  coefficient matrix with the Phase-0-locked **`GPSampler`**, objective = mean session-grounded NLL
  (`prompt`→`chosen` from `dpo_pairs_full/{target}.jsonl`) over a `--budget` train split; reports
  held-out `--test` NLL of the tuned coeffs vs three spec baselines (base / uniform merge / best
  single anchor). `--target <id>` picks the objective politician; `--exclude-target` withholds its
  own adapter (honest leave-one-out = the real sparse-target use case).

**Pilot results (target 152 岸田, 30 train / 30 test, 40 GP trials), held-out test NLL:**

| framing | base | uniform | best-single | **BO layer-group** |
|---|---|---|---|---|
| all 4 anchors (self-validating) | 2.730 | 3.974 | 2.718 (152) | **2.659** |
| leave-one-out (152 adapter withheld) | 2.730 | 3.833 | 2.835 (2377) | **2.698** |

Findings (green, honest):
- **BO beats every baseline in both framings**, incl. the target's own single adapter (+0.059) —
  i.e. **layer-group granularity adds value over a global weight**, the §2.4 claim, shown at dev scale.
- **BO recovers sensible structure unprompted:** with all anchors, it zeroed the 3 ideologically-distant
  anchors and kept only Kishida (g0 0.96 / g1 0.00 / g2 0.65 — a layer-group pattern a global merge
  can't express). The **uniform all-ones merge is much *worse* than base** (deltas overshoot) → the
  spec baseline-5 is beatable exactly as designed, and coefficient tuning is doing real work.
- **Graceful degradation:** in leave-one-out (LDP target, only left/center anchors) BO still beats base
  but only slightly (2.730→2.698), using *small* coefficients rather than overshooting. It never does
  worse than base. The small gain is the honest low-resource-fidelity signal to quantify at 7–8B with
  proper anchor coverage.

**Not yet done in Phase 3:** (a) nested k-fold CV for unbiased model selection (§2.4 — current code
uses a single train/test split as the dev-scale proof; wrap folds around the BO for the full matrix);
(b) the low-dim (global ~8) and high-dim (~192 full-layer-wise, TuRBO/SAASBO) ablation bookends;
(c) run on real held-out targets outside the anchor set (needs DPO-pair export for target politicians).

## Genuine held-out targets — BO beats every baseline on all 3 (session 2026-07-05h)

Resume item 6a done: `bo_merge_coeffs.py` run on **real held-out politicians outside the anchor
set** (not anchors self-validating). Picked 3 targets in **2024HoR** (one wave → one ground-truth
file) spanning the spectrum, each mapping onto an anchor: 高市早苗(1279, 自民-right)→岸田,
赤嶺政賢(2053, 共産)→塩川, 枝野幸男(2289, 立憲)→福島/上田. All answer 33/33 UTAS items and are
speech-rich (reliable train/test), while BO still tunes on only a **30-utterance budget** — so it's
low-resource on the tuning side even for data-rich targets.

New/changed plumbing:
- **`data/export_polis_dpo_pairs.py … --output-dir data/data/polis/dpo_pairs_targets`** — targets get
  prompt/chosen only (**no Gemini `rejected`**: a held-out target gets *no adapter of its own*, its
  persona is reconstructed by merging the 4 anchors, so DPO training / caricature negatives are moot).
  Exported 300 pairs each for 1279/2053/2289 (`data/data/polis/dpo_pairs_targets/{id}.jsonl`).
- **`bo_merge_coeffs.py` gained `--dpo-dir`** (default `dpo_pairs_full` for anchors; pass
  `.../dpo_pairs_targets` for held-out targets). `--exclude-target` is a **no-op** for genuine targets
  (there is no `polis_{target}_` adapter to withhold) — just run all 4 anchors into the merge.
- **`data/build_utas_ground_truth.py` gained `--all-matched`** — emits UTAS answers for *every*
  matched person in the wave (names from person_map `db_name_kanji`), not just the 4 anchors, so any
  held-out target's ground-truth vector is available for the §4.4 headline metric. Rebuilt both waves:
  **2024HoR = 676 persons, 2022HoC = 296** (`data/data/polis/utas_ground_truth/{wave}.json`; anchors
  still included — it's a superset). 2024 re-translated via Gemini 2.5-flash (temp 0), 2022 native JA.

**Held-out test NLL (lower=better), all 4 anchors merged, budget 30 / test 30 / 40 GP trials:**

| target | party | base | uniform | best-single | **BO layer-group** | BO vs base | BO vs best-single |
|---|---|---|---|---|---|---|---|
| 高市早苗 1279 | 自民 | 2.870 | 4.010 | 2.914 (岸田) | **2.823** | +0.047 | +0.092 |
| 赤嶺政賢 2053 | 共産 | 3.256 | 4.224 | 3.269 (岸田) | **3.186** | +0.070 | +0.083 |
| 枝野幸男 2289 | 立憲 | 3.317 | 4.356 | 3.320 (岸田) | **3.250** | +0.067 | +0.070 |

Findings (green, but honestly caveated):
- **BO beats every baseline on every genuine target** — base, best-single-anchor, and (by >1.0) the
  uniform merge. The margin over best-single (+0.07–0.09) is *larger* than the anchor leave-one-out
  pilot's, i.e. the low-resource-fidelity signal survives on real held-out politicians.
- **Uniform all-ones merge is much worse than base everywhere** (deltas overshoot) → spec baseline-5 is
  beatable by design; coefficient tuning does real work.
- **Coefficient structure is only *cleanly* ideological for the LDP target.** 高市: BO put 岸田 g0=0.855
  and zeroed the distant anchors — textbook. But for 赤嶺(共産) and 枝野(立憲), **岸田 g0 dominates every
  merge and is the best *single* anchor for all three targets.** Reason: at 0.5B the DPO adapters encode
  **register/rhetoric, not ideology** (a standing finding), and 岸田's adapter is the strongest (trained
  clean in 19 min vs the thermally-throttled 1–2 h others). So 岸田 g0 is a shared "fluent-Diet-register"
  backbone; BO adds *target-specific residual* in the other groups (e.g. 枝野 gets 上田 g2=0.356). **Clean
  ideological coefficient recovery is a 7–8B expectation, not a 0.5B result** — flag for mechanism
  analysis (6c) and the main run.
- Absolute NLL gains are small (~0.05–0.09), as expected when the adapters learn register not survey
  answering. The result is the **directional consistency**: BO > all baselines, 3/3 targets, no exceptions.

**§4.4 UTAS headline metric now wired onto the merged model (same session).** `bo_merge_coeffs.py`
gained **`--utas-eval <wave.json>`**: after the BO, it imports `evaluate_anchor` from the kokkai repo's
`data/polis_option_logprob.py` (added `sys.path.insert`) and scores **base / uniform / best-single / BO**
merges against the target's *real* UTAS answers (in-memory, no model save). Proven end-to-end on 1279:

| config | MAE(E) | MAE(argmax) | within1 | exact |
|---|---|---|---|---|
| base | 1.115 | 1.424 | 0.576 | 0.273 |
| uniform | 1.112 | 1.485 | 0.455 | 0.212 |
| best-single(岸田) | 1.142 | 1.788 | 0.424 | 0.182 |
| **BO** | **1.110** | 1.455 | 0.515 | **0.303** |

**Mechanism closes; numbers are the expected 0.5B degenerate floor.** MAE(E) is flat (1.11–1.14) across
*all* configs — E stays pinned ~3.0 (the standing 0.5B weak-Likert finding). BO has the lowest MAE(E) and
highest exact_acc, but the spread is within noise. So the merge→§4.4-metric path is *proven and ported-
ready*; a decisive UTAS comparison of the merge methods is a **7–8B main-run task** (per resume item 7).
The NLL proxy (above) is where BO's advantage is *visible* at 0.5B. Run with:
`bo_merge_coeffs.py --target <id> --dpo-dir …/dpo_pairs_targets --utas-eval …/utas_ground_truth/2024HoR.json`.

## 7B QLoRA training FITS the 8GB laptop — main-run deferral is broken (session 2026-07-05i)

Ken fixed the hard-drive mount (`D:\` → `/mnt/d`, 774 GB free; root ext4 still has ~90 GB, where the HF cache lives). Storage was never the binding constraint — **VRAM** was, and that's what the whole "defer 7–8B to the Studio" plan rested on. Tested it directly.

**Smoke test PASSED.** `train_one_politician_persona.py --quantize` on **Qwen2.5-7B-Instruct** (4-bit nf4, bf16 compute, `paged_adamw_8bit`, grad-checkpointing, LoRA r=16 q/k/v/o), 24-pair subset of anchor 152, 3 steps, ran clean end-to-end and saved the adapter (`../idea/persona/code/output/polis_152_qwen7b_smoke/`, 20 MB).

| metric | 0.5B | 3B QLoRA | **7B QLoRA** |
|---|---|---|---|
| fits 8 GB | yes | yes | **yes — peak 8003/8192 MiB** |
| s/it | ~6 | ~24.5 | **~54.5** |

**Implication:** the 7–8B main run can happen **on this laptop via QLoRA**, not only on the delayed Studio. Extrapolated real anchor run = 1500 pairs → 188 steps × 54.5 s ≈ **2.85 h/anchor**; 6–10 anchors ≈ 17–28 h → overnight/multi-night viable. The Studio's remaining advantage is **throughput** (and full-precision 7–8B), not feasibility.

**Full-length run CONFIRMED (same session).** Ran anchor 152 to completion at 7B: `dpo_pairs_full/152.jsonl` (1500 pairs → **188/188 steps, 2:52:25, ~55 s/it**), VRAM stable ~7995/8192 throughout, no OOM. **train_loss 0.0545, rewards/accuracies 1.0, rewards/margins 8.79** — cleaner than the 0.5B 152 adapter (loss 0.094, margins ~8.0). Adapter saved: `../idea/persona/code/output/polis_152_qwen7b/` (20 MB). **Both caveats below are now closed** — the ~zero VRAM margin holds over a full run, and 7B DPO converges properly, not just fits. First real 7B anchor adapter exists.

**Caveats (now CLOSED, kept for the record):**
- ~~VRAM margin ~zero → full run might OOM~~ → held stable across all 188 steps.
- ~~DPO metrics at 3 steps are noise~~ → full run gives clean loss 0.0545 / margins 8.79.
- **Untested at 7B:** merge → forward → option-logprob and the BO loop under 4-bit quantization. `LayerGroupMerger` reconstructs full ΔW and writes into weights — needs verifying that path works on a 4-bit base (dequant/requant, or load the merge base in bf16 for inference-only ~15 GB… which does NOT fit 8 GB → likely merge/score in 4-bit or offload). **This is the next real question.**

**NB for a prior-session artifact:** `../idea/persona/code/bo_granularity_ablation.py` already exists and imports `nested_cv` from `bo_merge_coeffs` — so resume item 6b (nested k-fold CV + granularity bookends) looks **already implemented** but is undocumented above. Verify/run it before rebuilding.

## Suggested resume order

0. **Real headline metric + UTAS ground truth** ✅ **DONE** (2026-07-05d, section above).
1. ~~**Anchor-delta cosine kill check (Phase 2a)**~~ ✅ **DONE** (2026-07-05b, PASSED — near-orthogonal, section above).
2. ~~**DARE-TIES merge smoke test (Phase 3 start)**~~ ✅ **DONE** (2026-07-05b, PASSED, section above). Custom layer-group weighting is the later BO surface.
3. ~~**UTAS name-matching infra**~~ **DONE** (2026-07-05c, see section above).
4. ~~**Numeric-label scoring** to fix degenerate argmax~~ ✅ **DONE** (2026-07-05e, section above) — tested & rejected at 0.5B (worse than verbose); deferred to 7–8B with order-averaging. Verbose E[1..5] is the 0.5B proxy.
5. ~~**Remaining Phase 0 loose ends:** QLoRA ~3B smoke test; BO backend choice~~ ✅ **DONE** (2026-07-05f). **Phase 0 CLOSED.**
6. ~~**Phase 3 core:** custom layer-group DARE-TIES merge + Optuna/`GPSampler` BO loop, pilot~~ ✅ **DONE** (2026-07-05g). → sub-tasks:
   a. ~~**DPO-pair export for real held-out targets** → BO pilots on genuine targets~~ ✅ **DONE** (2026-07-05h — BO beats all baselines on 3/3 genuine held-out targets) ~~+ wire §4.4 UTAS metric onto the merged model~~ ✅ **DONE** (same session, `--utas-eval`; mechanism closes, 0.5B numbers degenerate as expected). → **Next real work is (b)/(c) below and item 7.**
   b. ~~**Nested k-fold CV** wrapper (§2.4) for unbiased selection on the full matrix~~ ✅ **DONE** (2026-07-26, all 3 held-out targets at 0.5B — 15/15 folds vs best-single, in the paper as `tab:nested-nll`). **Still open:** ablation bookends (global ~4-dim; ~96-dim full-layer-wise at 0.5B) via `bo_granularity_ablation.py` — implemented, never run; laptop-feasible at 0.5B (~4 min/target).
   c. **Mechanism analysis (§4.4):** correlate learned coeffs with anchor–target UTAS/scaling distance + topic overlap. NB: at 0.5B coeffs track *register* (岸田 g0 backbone dominates) not ideology — do this on the 7–8B main run.
7. **ICL baseline kill check (Phase 2b)** now that real pilot targets exist (1279/2053/2289). NB: at 0.5B all methods sit near the same degenerate floor, so this gate is only decisive at 7–8B — run it there, or expect an inconclusive dev-scale result.
8. **7–8B main run — NO LONGER Studio-blocked** (2026-07-05i): QLoRA 7B DPO fits the 8 GB laptop; ✅ (a) **full-length anchor 152 run DONE** (188 steps, loss 0.0545, margins 8.79, adapter `output/polis_152_qwen7b/`). ✅ **ALL 4 ANCHORS TRAINED AT 7B** (done 2026-07-06 20:38). Adapters in `../idea/persona/code/output/polis_{152,2377,3631,5520}_qwen7b/`, all clean: 152 loss 0.0545/margins 8.79 · 2377 0.0496/7.08 · 3631 0.0497/9.08 · 5520 0.0475/8.31 · all accuracies 1.0. Overnight throttling stretched wall-time to ~21 h (3631 8.2 h, 5520 9.1 h vs 152's 2.9 h) — throughput only, all rc=0. Next →

### ✅ 7B MERGE/BO PATH UNBLOCKED + 7B BREAKS THE DEGENERACY FLOOR (session 2026-07-06b)

Three results, all green:

**1. Root cause of the "silently wrong" merge was NOT the RAM cap — it was meta-tensor offload.**
Ken raised the `.wslconfig` cap (WSL now reports **47 GB total / 44 GB free**), but re-running
`merge_layer_group.py --base Qwen/Qwen2.5-7B-Instruct` under `device_map="auto"` was **still broken**
(upper-group-only NLL == base 1.0830, lower == uniform 1.7008). Reason: an 8 GB GPU **must** split a
15 GB bf16 model; `device_map="auto"` puts overflow layers on CPU as **meta tensors** with accelerate
hooks, and the merger's in-place `.data.copy_()` is a **silent no-op on meta modules**. Forward passes
are *correct* under offload (hooks move weights per-forward); only weight *writes* break. So RAM only
changed *where* offload lives, not the meta problem.

**Fix (done + verified): `--device cpu`** on both `merge_layer_group.py` and `bo_merge_coeffs.py` →
loads the whole model in RAM as real tensors (`device_map={"":"cpu"}`), no meta. CPU self-test now shows
all four NLLs **distinct** (base 1.0888 · uniform 2.6315 · upper-only **1.2255** · lower-only **1.7592**),
restore exact → **per-group coeffs bite at 7B.** Cost: CPU forwards are slow (~25 min for a 33-item UTAS
eval) → a handful of UTAS evals are fine, a **full BO (1000+ forwards) is infeasible on the laptop** →
run BO at **3B-on-GPU** (bf16 ~6 GB fits, needs 3B adapters retrained ~77 min ea) or on the **Studio**.

**2. 7B BREAKS the 0.5B degeneracy floor (the decisive result the 0.5B run could never give).**
`polis_option_logprob.py --base Qwen/Qwen2.5-7B-Instruct --utas-eval 2024HoR.json --person-id 152`,
base vs 岸田 7B adapter (33 items, named persona):

| model | MAE(argmax) | MAE(E) | exact | within1 |
|---|---|---|---|---|
| base 7B | 1.485 | 1.151 | 0.152 | 0.545 |
| **岸田 adapter 7B** | **1.455** | **1.067** | **0.212** | 0.545 |

- **argmax is non-degenerate** — spans 1–5, responds to content (Q5_6 truth5→5, Q4_5 truth4→4, Q4_2
  truth3→3). At 0.5B argmax collapsed (all→1 on Q5 / length-pinned). Qualitative §6 risk **retired at 7B**.
- **The DPO adapter IMPROVES UTAS alignment on 3/4 metrics, none worse** (MAE(E) 1.151→1.067, exact
  0.152→0.212). At 0.5B the adapter made argmax *worse* via collapse; at 7B it moves the persona toward
  the real positions — the directional signal the whole method rests on, now shown against real ground truth.
- Residual: both still lean the Q5 (A/B) items toward "5", absolute MAE moderate → 7B is **competent but
  imperfect** at zero-shot Likert. This is now the regime where the deferred **numeric-label + order-averaging
  (PriDe) debiasing** is worth building (0.5B was too incompetent to validate it; 7B isn't).

**3. New CLI:** both merge scripts gained `--device cpu` (see fix above). Adapters/scorer paths unchanged.

**DECISION (made 2026-07-07): laptop 7B BO is INFEASIBLE → defer full 7B merge/BO+UTAS to the Studio; write up the preliminary findings into the paper now.**

**Why laptop 7B BO is dead:** Ken chose "7B on CPU overnight." I launched the merge-method BO on the 3 genuine
held-out 2024HoR targets (1279 高市 → 2053 赤嶺 → 2289 枝野) via
`specs/polis-low-resource-persona/artifacts/run_7b_bo_overnight.sh` (`--device cpu --budget 12 --test 15 --trials 20 --utas-eval`).
**After ~12 h it was still on target 1279 (of 3)** — healthy (770% CPU, ~32 GB RAM, no errors), just far too slow.
Root cause: the BO objective scores NLL over **session-grounded DPO contexts that are ~1,336 tokens median (max ~2,071)**,
and a *pure-CPU* 7B forward over ~1,300 tokens is ~1–3 min. 240 such for the BO + baselines + a 660-forward UTAS eval ⇒
**~days for 3 targets, not a night.** My original "~2.5 h/target" estimate was extrapolated from short-prompt forwards and was
~10× optimistic. **This is a genuine compute wall, not a bug** — `--device cpu` is *correct* (self-test verified), just slow.
The `--device cpu` fully-on-CPU path is the price of correct ΔW writes (GPU-offload path meta-no-ops the writes); so at 7B on the
8 GB laptop you cannot have both correct merges AND fast forwards. **All BO processes were killed; the driver + partial log are at
`specs/polis-low-resource-persona/artifacts/bo7b_logs/target_1279.log` (no results — never reached the print).**

**Ken's call:** don't chase laptop 7B BO further (3B-native was declined; it undercuts the 7B story). Instead **write the preliminary
findings into the paper** so he can review, and **run the full-scale 7B merge/BO+UTAS comparison on the Mac Studio** when it arrives
(fast full-precision 7B, no offload → BO cheap, UTAS decisive).

### ▶ NEXT AGENT: populate the paper with preliminary findings (Ken's active request, 2026-07-07)

**Paper:** `paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex` — currently a **skeleton**: the
**abstract is written (keep verbatim)**, every section body is a Japanese-comment placeholder + a few reference URLs Ken left
(preserve those URLs). Task = fill the sections we have real results for; leave Related Work / Preliminaries light (need lit review,
not our data). Frame everything **honestly as preliminary**: method fully validated at 0.5B dev scale; 7B results are early/partial;
the headline full-scale comparison is pending Studio. Preamble only has `graphicx` → add `booktabs`+`amsmath` for tables/math.

**All numbers below are verified this project — put them straight in, do NOT re-run to re-derive:**

- **Anchors (4, trained at BOTH 0.5B and 7B):** 152 岸田文雄 (自民/LDP) · 2377 塩川鉄也 (共産/JCP) · 3631 福島みずほ (社民/SDP) ·
  5520 上田清司 (民主/independent). 0.5B adapters `../idea/persona/code/output/polis_{152_kishida,2377_shiokawa,3631_fukushima,5520_ueda}`;
  7B adapters `output/polis_{152,2377,3631,5520}_qwen7b` (all clean: margins 7–9, accuracies 1.0).
- **Models/hparams:** dev = Qwen2.5-0.5B-Instruct (full LoRA/DPO); main = Qwen2.5-7B-Instruct (4-bit QLoRA, nf4/bf16, paged_adamw_8bit,
  grad-checkpointing). LoRA r=16 on q/k/v/o_proj. DPO (TRL). Merge = DARE (density 0.1, fixed seeded mask) + TIES sign-election,
  weighted per **[anchor × depth-group]**; 3 contiguous depth groups (0.5B 24L→0–7/8–15/16–23; 7B 28L→0–9/10–19/20–27). BO = Optuna
  `GPSampler` (GP-BO), objective = mean session-grounded NLL over a small budget, `--cmax 1.5`.
- **Data:** kokkaidoc Diet speeches → session-grounded DPO pairs (prompt = up to K preceding same-session speeches ≤1.2k chars;
  chosen = real next utterance; rejected = **Gemini 2.5-flash-lite** caricature role-play). UTAS (U-Tokyo/Asahi) candidate surveys
  2024HoR (33 items) + 2022HoC (37 items): Q4_* 5-pt agree/disagree, Q5_* 5-pt A/B; ground truth via name→person_id matcher
  (`data/data/polis/utas_ground_truth/{wave}.json`, `--all-matched`).
- **Metrics:** (1) held-out **session-grounded NLL** (likelihood proxy, the objective); (2) **UTAS headline** via option-logprob
  scorer (`data/polis_option_logprob.py`): per-item argmax + E[1..5] vs real coded answer → MAE(argmax), MAE(E), exact, within-1.

- **RESULT A — 0.5B dev-scale, BO beats every baseline on 3/3 genuine held-out targets** (held-out test NLL, lower=better;
  budget 30 / test 30 / 40 GP trials; all 4 anchors merged):

  | target | party | base | uniform | best-single | **BO layer-group** |
  |---|---|---|---|---|---|
  | 高市早苗 1279 | 自民 | 2.870 | 4.010 | 2.914 (岸田) | **2.823** |
  | 赤嶺政賢 2053 | 共産 | 3.256 | 4.224 | 3.269 (岸田) | **3.186** |
  | 枝野幸男 2289 | 立憲 | 3.317 | 4.356 | 3.320 (岸田) | **3.250** |

  BO > base, best-single, and (by >1.0) the uniform merge, every target. **Uniform all-ones merge is much worse than base**
  (deltas overshoot) — the tuning does real work. BO recovers sensible structure (for the LDP target it zeroed distant anchors,
  kept 岸田 with a per-group pattern a global weight can't express). Caveat: at 0.5B coeffs track **register**, not ideology
  (岸田 g0 is a shared fluent-Diet-register backbone) — clean ideological recovery is a 7B expectation.

- **RESULT B — 0.5B UTAS metric is a DEGENERATE FLOOR** (why 7B is needed): on merged 1279, MAE(E) is flat 1.11–1.14 across
  base/uniform/best-single/BO (E pinned ~3.0); argmax collapses (numeric-label scoring also fails: first-option/"agree" bias,
  p≈0.98 even on an absurd "consumption tax to 100%" sanity item). So the §4.4 headline is inconclusive at 0.5B by construction.

- **RESULT C — 7B BREAKS the floor (the key preliminary main-scale result).** base vs 岸田 7B DPO adapter, 152, 2024HoR, 33 items,
  named persona:

  | model | MAE(argmax) | MAE(E) | exact | within-1 |
  |---|---|---|---|---|
  | base 7B | 1.485 | 1.151 | 0.152 | 0.545 |
  | **岸田 adapter 7B** | **1.455** | **1.067** | **0.212** | 0.545 |

  argmax is now content-responsive across the full 1–5 scale (0.5B collapsed); the DPO adapter improves alignment on **3/4 metrics,
  none worse** — the SFT/DPO-vs-base premise and the metric itself validated at scale. Residual: both lean the Q5 (A/B) items toward
  "5", moderate absolute MAE → 7B is competent-but-imperfect at zero-shot Likert.

- **RESULT D — supporting: anchors are near-orthogonal in weight space** (Phase 2a cosine kill-check, 0.5B): pairwise ΔW cosine
  max 0.058 / mean 0.047, delta norms 0.76–0.82 → the merge has ample per-anchor residual to interpolate; the collinearity risk
  (spec §6) did not materialize. Re-check at 7B on the Studio.

**For Discussion/Limitations:** (i) 0.5B survey-answering is a degenerate floor → dev scale validates the *mechanism*, not the
headline number; (ii) **compute:** a correct 7B merge on an 8 GB GPU forces full-CPU forwards (device_map=auto meta-no-ops the ΔW
writes) → laptop 7B BO is infeasible (~days); full 7B merge/BO+UTAS deferred to higher-throughput hardware (Studio); (iii) at 0.5B
learned coeffs encode register not ideology — clean ideological recovery expected only at 7B; (iv) numeric-label + PriDe
order-averaging debiasing is the buildable-at-7B next methods step for the Likert metric.

**What is DONE and ready to just report (no compute needed for the paper):** full pipeline at 0.5B (Result A/B/D), 7B floor-break
(Result C), all 4 anchors trained at 7B, merger correctness at 7B (`--device cpu` verified). **What is PENDING (needs Studio):** the
full 7B merge-method comparison (base/uniform/best-single/BO on NLL + UTAS across the 3 targets) — the paper's Main Results table at
main scale. Draft the paper with the 0.5B table as the current Main Result + Result C as the main-scale proof-of-concept, and leave
the 7B merge-comparison table as a clearly-marked pending/placeholder to fill from the Studio run.

The cheap 7B pieces (single-adapter UTAS evals, merger correctness) are DONE; the throughput wall is why the merge-BO comparison waits for the Studio.

### ⚠️ 7B MERGE/BO PATH BLOCKED by WSL RAM cap (2026-07-06) — SUPERSEDED, see section above
7B QLoRA **training** works (4-bit model stays resident on the 8 GB GPU). But the **merge → BO → UTAS** path needs the full bf16 model (~15 GB) for the ΔW-baked forward passes, and it does **not** fit: `merge_layer_group.py --base Qwen/Qwen2.5-7B-Instruct --adapters <the 4 7B adapters> --n-groups 3` ran but was **silently wrong** — upper-group-only merge NLL == base NLL (1.0830), lower-group == uniform (1.7008), i.e. per-group coeffs did *not* bite (they DO at 0.5B). Cause: **`.wslconfig` caps WSL2 at `memory=10485760000` (~9.8 GB)** though the Windows host has 64 GB, so accelerate `device_map="auto"` offloaded upper layers to **disk/meta**, and the merger's in-place ΔW writes to meta tensors are **no-ops** → deltas dropped on offloaded modules (reversibility check still "passes" because no-op writes reverse to no-ops). The handover/spec "64 GB RAM" is the *host*, not WSL.

**Fix path:** raise `memory=` in `C:\Users\katok\.wslconfig` (host has 64 GB → e.g. 48 GB), then run `wsl --shutdown` **from Windows PowerShell** (NOT inside WSL — it kills this session) and reopen. Then bf16 7B fits in RAM, `device_map="auto"` offloads to **CPU RAM not disk**, and the merge is correct. **Caveat:** even fixed, CPU-offloaded 7B forwards are slow → a **single UTAS eval (base/uniform/best-single, ~33 items) is tractable (minutes)** and directly tests whether 7B beats the 0.5B degeneracy floor, but a **full BO (budget×trials×folds ≈ 1000+ forwards) is throughput-brutal** on an 8 GB GPU with offload → BO stage really wants the Studio or a bigger GPU. **Alternative fully-laptop-native path: run merge/BO at 3B** (bf16 ~6 GB fits the GPU, no offload, fast BO) — needs 3B anchor adapters retrained (QLoRA 3B ~77 min each). Decision pending with Ken. (b) **verify merge → forward → option-logprob + BO at 7B** (bf16 `device_map="auto"` auto-offloads the ~15 GB model's overflow to the 64 GB RAM; merger's ΔW edits are plain tensor math, no 4-bit weight-baking needed — just pass `--base Qwen/Qwen2.5-7B-Instruct`, expect slower forwards) → (c) the real headline UTAS comparison of merge methods, the decisive result the 0.5B degenerate floor could not give. Studio port stays relevant only for throughput / full-precision.
