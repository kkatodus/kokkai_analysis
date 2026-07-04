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

## Suggested resume order

1. **Train:** hand `dpo_pairs_full/` JSONL to the `../idea/persona` trainer at 0.5B (QLoRA for the ~3B check) — the Phase-0 laptop toolchain gate (spec §5). Data prep is done.
2. **UTAS name-matching infra** (shared with `ensemble-scaling-reliability`): match speech `speaker`/`speakerYomi` to UTAS `NAME`/`KANA`; reuse `utils/string_process.clean_repr_name`. Then wave selection (§4.4). NOTE: anchors come from the recent-era scaling set, so they should align with the 2021/2024 UTAS waves.
3. Then phase-2 kill checks (ICL baseline; anchor-delta cosine) once anchors are trained.
