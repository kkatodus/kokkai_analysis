# POLIS — 7B main-scale run on a rented GPU (runbook)

Every command needed to get the pending 7B merge-method comparison running on a
RunPod box, in order. Copy-paste top to bottom.

**What this produces:** the paper's pending table — base / uniform / best-single /
POLIS on held-out NLL *and* UTAS, across the 3 genuine held-out 2024HoR targets
(1279 高市, 2053 赤嶺, 2289 枝野). See
[`paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex`](../../paper/parameter-optimization-for-low-resource-ideological-simulation/main.tex)
§Discussion, which currently marks it *pending on higher-throughput hardware*.

**Code:** [`research/polis/`](../../research/polis/) · **Guide:** [`research/README.md`](../../research/README.md)

---

## 0. Pod requirements

| | |
|---|---|
| VRAM | **~31 GB** (15.2 GB bf16 model + 13.2 GB fp32 anchor deltas + transients). 40 GB floor; 48 GB comfortable. |
| Cards that fit | A40 48 · L40 / L40S 48 · A6000 / RTX 6000 Ada 48 · A100 80 · H100 80 |
| Template | RunPod **PyTorch** (ships torch; sshd pre-configured) |
| Networking | **Public IP + exposed TCP port 22** — required. The proxied `ssh.runpod.io` connection does not support SCP/SFTP/rsync, and you must move 522 MB of adapters. |
| Network volume | Optional. Saves one 15 GB model download per pod restart; forces Secure Cloud (Community Cloud pods cannot attach one) and pins every future pod to that datacenter. |

---

## 1. Laptop — prerequisites

```bash
cd ~/workspace/projects/kokkai_analysis

kdata mount                  # datasets live on the external SSD
git push origin dev          # the pod clones this branch

cat ~/.ssh/id_ed25519.pub    # paste into RunPod -> Settings -> SSH Public Keys
```

Verify the payload is present before paying for a GPU:

```bash
du -csh research/polis/output/polis_*_qwen7b | tail -1        # expect 522M
ls data/data/polis/dpo_pairs_targets                          # expect 1279 2053 2289 .jsonl
ls data/data/polis/utas_ground_truth/2024HoR.json             # expect present
```

---

## 2. Pod — clone

**Clone before rsync.** rsync would create the destination directories, and
`git clone` refuses a non-empty target.

```bash
git clone https://github.com/kkatodus/kokkai_analysis.git /workspace/kokkai_analysis
cd /workspace/kokkai_analysis && git checkout dev
mkdir -p /workspace/kokkai_data/polis
```

---

## 3. Laptop — ship the two payloads

Neither is in git (adapters are ~1 GB of safetensors; datasets live on the SSD).

```bash
REPO=~/workspace/projects/kokkai_analysis
IP=<pod-ip>; PORT=<pod-port>          # from the RunPod "Connect" panel

# adapters (~522 MB)
rsync -avP -e "ssh -p $PORT" \
  $REPO/research/polis/output/polis_{152,2377,3631,5520}_qwen7b \
  root@$IP:/workspace/kokkai_analysis/research/polis/output/

# data inputs (~4 MB)
rsync -avP -e "ssh -p $PORT" \
  $REPO/data/data/polis/dpo_pairs_targets \
  $REPO/data/data/polis/utas_ground_truth \
  root@$IP:/workspace/kokkai_data/polis/
```

---

## 4. Pod — bootstrap

```bash
cd /workspace/kokkai_analysis
./research/polis/scripts/setup_pod.sh
```

Checks VRAM, installs deps against the image's torch, verifies both payloads
landed, caches the model, and ends on the merge self-test.

> ### ⚠️ The gate
> The self-test must print **four DISTINCT NLLs** (base / uniform / upper-only /
> lower-only) and an exact restore. `[OK]` alone is **not** sufficient.
>
> If they are not distinct, the merge is not biting and every hour after this is
> wasted. Cause: under `device_map="auto"` the overflow layers become meta tensors
> and the merger's in-place ΔW writes silently no-op — the BO then optimises a flat
> objective for hours without erroring. This is why `--device cuda` is passed
> explicitly. Stop and debug; do not start the run.

Reference values from the 0.5B self-test (7B numbers differ, but the *shape* —
four distinct values, exact restore — is the same):

```
base NLL                 = 2.0808
uniform merge NLL        = 3.4785
upper-group-only merge   = 2.2633
lower-group-only merge   = 2.3963
restored base NLL        = 2.0808  (should match base)
```

---

## 5. Pod — calibrate before committing

RunPod SSH sessions drop; always run inside tmux.

```bash
tmux new -s polis
cd /workspace/kokkai_analysis
export KOKKAI_DATA_DIR=/workspace/kokkai_data

time TRIALS=5 TARGETS=1279 ./research/polis/scripts/run_7b_bo_gpu.sh
```

**Why:** this BO loop has never been run on a GPU. Per-trial cost is now dominated
by the re-merge (writing ΔW for 4 anchors × 822M adapted params every trial), not
the forwards, so the old CPU timings predict nothing. Measure seconds-per-trial,
then multiply: single-split is 3 targets × 40 trials; nested is ~5× that.

Detach with `Ctrl-b d`, reattach with `tmux attach -t polis`.

---

## 6. Pod — the actual runs

You need **both**: nested CV has no `--utas-eval` path, so the single-split run is
the only source for the UTAS half of the table.

```bash
# single-split (NLL + UTAS) -- matches the 0.5B protocol
./research/polis/scripts/run_7b_bo_gpu.sh

# nested 5-fold CV (unbiased, error bars) -- ~5x the cost
NESTED=1 ./research/polis/scripts/run_7b_bo_gpu.sh
```

Tunable via environment (defaults shown):

| Var | Default | Meaning |
|---|---|---|
| `BASE` | `Qwen/Qwen2.5-7B-Instruct` | base model |
| `DEVICE` | `cuda` | must pin one device; see the gate above |
| `BUDGET` | `30` | target utterances the BO tunes on |
| `TEST` | `30` | held-out test utterances |
| `TRIALS` | `40` | GP trials per target/fold |
| `FOLDS` | `5` | nested-CV folds (`NESTED=1` only) |
| `TARGETS` | `1279 2053 2289` | person_ids |

Logs: `specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/target_<id>.log`

### Optional, same session

The granularity sweep in the paper (§`sec:granularity`) is 0.5B-only, which is why
it currently concedes *"we do not claim that per-depth granularity improves fidelity
at development scale."* 7B is where that claim could land, and the marginal cost is
small once the model is loaded.

```bash
cd research/polis
python bo_granularity_ablation.py \
  --target 1279 --budget 30 --folds 4 --trials 20 \
  --groups 1 3 \
  --adapters output/polis_{152,2377,3631,5520}_qwen7b \
  --base Qwen/Qwen2.5-7B-Instruct
```

`--groups 1 3` is deliberate. The default sweeps `[1, 3, n_layers]`, and at 7B that
third bookend is 4×28 = **112 coefficients** — the most expensive cell by far, to
re-derive a result 0.5B already settled decisively (96 dims scored 3.441 vs base
2.880; badly-chosen coefficients actively corrupt the model). Add `28` back only if
you specifically want the upper bookend at main scale.

---

## 7. Laptop — retrieve results

**Do this before destroying the pod.** Logs are the deliverable.

```bash
REPO=~/workspace/projects/kokkai_analysis
rsync -avP -e "ssh -p $PORT" \
  root@$IP:/workspace/kokkai_analysis/specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs \
  $REPO/specs/polis-low-resource-persona/artifacts/

cd $REPO && git add specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs && git commit
```

Then destroy the pod — a stopped pod still bills for its disk, and a network
volume bills whether or not anything is running.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Self-test NLLs identical or only two distinct values | Merge not biting (meta-tensor no-op). Confirm `--device cuda` and that the model fits VRAM. **Do not run the BO.** |
| `rsync: connection unexpectedly closed` | You're on the proxied `ssh.runpod.io` connection. Redeploy with public IP + TCP 22. |
| `git clone` says destination not empty | You rsynced before cloning. Move the files aside, clone, move back. |
| `ModuleNotFoundError: optuna` | `setup_pod.sh` not run, or its pip step failed. Re-run it. |
| `FATAL: missing .../2024HoR.json` | Step 3 didn't land, or `KOKKAI_DATA_DIR` is unset. |
| CUDA OOM during merge | Card below 40 GB, or something else resident. `nvidia-smi` to check. |
| Session died mid-run | Not in tmux. Logs survive; re-run the affected target only via `TARGETS=<id>`. |
| Pod restarted, model re-downloading | No network volume (expected), or `HF_HOME` unset. Re-run `setup_pod.sh`. |

## Notes

- Always pass adapters **explicitly**. `output/polis_*` globs the 0.5B, 7B and
  smoke directories together, and mixing scales silently produces a nonsense merge.
- `research/polis/paths.py` honours `KOKKAI_DATA_DIR` / `KOKKAI_S3_MIRROR`, which is
  how the pod finds data without the SSD symlink.
- Don't `pip install -r research/requirements.txt` on the pod: it pins
  torch 2.12+cu130 and the whole `nvidia-*` wheel set, which fights the image's
  torch. `setup_pod.sh` installs the right subset.
