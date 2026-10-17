Research code
=============

Experimental code for the papers under [`paper/`](../paper/). One subdirectory per
research project; plans and running handover notes live under [`specs/`](../specs/).

| Directory | Project | Paper | Spec |
|---|---|---|---|
| [`polis/`](polis/) | POLIS — low-resource political persona simulation via BO-tuned DARE-TIES merging of DPO anchor adapters | [`paper/parameter-optimization-for-low-resource-ideological-simulation/`](../paper/parameter-optimization-for-low-resource-ideological-simulation/) | [`specs/polis-low-resource-persona/`](../specs/polis-low-resource-persona/) |

This code was consolidated from a separate `idea/persona` repo (GPU training and
merge code) plus the POLIS scripts that used to sit in `data/`, so that the whole
pipeline versions as one tree with the paper it produces.

## Environment

```bash
python -m venv research/.venv
research/.venv/bin/pip install -r research/requirements.txt
```

`requirements.txt` is a full pinned freeze of the environment the published
results were produced in, including `nvidia-*` CUDA wheels for torch 2.12/cu130.
On a rented GPU box whose image already ships a working torch, install against
that instead of forcing these pins — the pipeline only needs
`transformers`, `peft`, `trl`, `datasets`, `bitsandbytes`, `optuna`, `safetensors`,
and (for the Gemini rejected-sample step) `google-genai` + `python-dotenv`.

## Data

Scripts resolve datasets through [`polis/paths.py`](polis/paths.py):

- `DATA_DIR` → `<repo>/data/data` — a symlink onto the external SSD. If it looks
  empty, the drive is not mounted: run `kdata mount`.
- `S3_MIRROR_DIR` → `<repo>/s3_mirror`.

Both are overridable (`KOKKAI_DATA_DIR`, `KOKKAI_S3_MIRROR`) for machines without
the drive, which is how the GPU runs are configured.

## POLIS pipeline

Run from inside `research/polis/` — the scripts import each other as siblings.

| Stage | Script | Output |
|---|---|---|
| 1. Pick data-rich anchors | `select_polis_anchors.py` | `data/data/polis/anchors.json` |
| 2. Session-grounded DPO prompts | `export_polis_dpo_pairs.py --person-id <id>` | `data/data/polis/dpo_pairs/{id}.jsonl` |
| 3. Caricature `rejected` completions (Gemini) | `generate_polis_rejected.py --person-id <id>` | `data/data/polis/dpo_pairs_full/{id}.jsonl` |
| 4. UTAS ground truth | `build_utas_ground_truth.py --all-matched` | `data/data/polis/utas_ground_truth/{wave}.json` |
| 5. DPO-train an anchor adapter | `train_one_politician_persona.py --data … --output … [--quantize]` | `polis/output/<name>/` |
| 6. Merge + BO the mixing coefficients | `bo_merge_coeffs.py --target <id> --adapters …` | stdout + logs |
| 7. Survey metric | `polis_option_logprob.py --utas-eval <wave.json> --person-id <id>` | stdout |

Supporting checks: `anchor_delta_cosine.py` (are anchor task vectors near-orthogonal?),
`merge_layer_group.py` (merge self-test — **must print four distinct NLLs**),
`merge_anchors_dare_ties.py` (uniform-merge smoke test),
`bo_backend_validate.py` (sampler choice), `bo_granularity_ablation.py`
(global vs layer-group vs full-layer-wise bookends).

### Adapters

`polis/output/` holds the trained adapters and is **gitignored** (~1 GB of
safetensors). Present locally: four anchors at both scales —
`polis_{152_kishida,2377_shiokawa,3631_fukushima,5520_ueda}` (0.5B) and
`polis_{152,2377,3631,5520}_qwen7b` (7B QLoRA). Copy them to a GPU box with
`rsync`; retraining the 7B set costs ~21 h.

Always pass adapters to the merge scripts **explicitly**. `output/polis_*` globs
the 0.5B, 7B and smoke directories together, and mixing scales silently produces
a nonsense merge.

### Main-scale run (rented GPU)

The paper's pending table (base / uniform / best-single / POLIS at 7B) is driven by
[`polis/scripts/run_7b_bo_gpu.sh`](polis/scripts/run_7b_bo_gpu.sh). It needs ~31 GB
VRAM (15.2 GB bf16 model + 13.2 GB fp32 anchor deltas + transients), so a 40 GB card
is the floor and 48 GB is comfortable.

[`polis/scripts/setup_pod.sh`](polis/scripts/setup_pod.sh) prepares a rented box:
checks VRAM, installs deps against the image's torch, verifies the adapters and data
were copied over, caches the model on the network volume, and runs the merge
self-test. Its header carries the `rsync` commands for the two payloads that are not
in git (adapters, and `data/data/polis/{dpo_pairs_targets,utas_ground_truth}`).
Time one target with `TRIALS=5 TARGETS=1279` before committing to the full run.

A correct merge requires the whole model on **one** device: under
`device_map="auto"` the overflow layers become meta tensors and the in-place ΔW
writes silently no-op, leaving the BO to optimise a flat objective for hours. Both
merge scripts take `--device` for this reason, and the run script preflights the
self-test and aborts unless it passes.
