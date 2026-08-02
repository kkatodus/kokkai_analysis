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

## Snippet index

Every runnable block below carries an ID. **`L#` runs on your laptop, `P#` runs on
the pod** — mixing those up is the most common way to lose an hour. Cite the ID
when asking about a block rather than describing its position.

| ID | Where | § | What it does |
|---|---|---|---|
| `L1` | laptop | 1 | prerequisites — mount data, push the branch, register the SSH key |
| `L2` | laptop | 1 | verify the payload exists before you rent a GPU |
| `P1` | pod | 2 | clone the repo (must happen before the rsync) |
| `L3` | laptop | 3 | ship the two payloads — adapters + data inputs |
| `P2` | pod | 4 | bootstrap — deps, model cache, merge self-test |
| `P3` | pod | 5 | calibration run (TRIALS=5, one target) |
| `P4` | pod | 5 | check the BO objective isn't flat |
| `P5` | pod | 5.5 | move the calibration log aside |
| `P6` | pod | 5.5 | everything after calibration, as one block (~65 min) |
| `L4` | laptop | 5.5 | retrieve logs after `P6` |
| `P7` | pod | 6 | single-split then nested, run separately (~52 min) |
| `P8` | pod | 6.1 | re-run single-split with numeric UTAS scoring (~12 min) |
| `P9` | pod | 6 | granularity ablation (~10 min) |
| `L5` | laptop | 7 | retrieve results before destroying the pod |
| `P10` | pod | Troubleshooting | clear the untracked-logs pull conflict, then pull |

`P6` is `P7` + `P9` concatenated — run *either* `P6` *or* the pair, never both.

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

**`[L1]`** · laptop · prerequisites — mount data, push the branch, register the SSH key
```bash
cd ~/workspace/projects/kokkai_analysis

kdata mount                  # datasets live on the external SSD
git push origin dev          # the pod clones this branch

cat ~/.ssh/id_ed25519.pub    # paste into RunPod -> Settings -> SSH Public Keys
```

Verify the payload is present before paying for a GPU:

**`[L2]`** · laptop · verify the payload exists before you rent a GPU
```bash
du -csh research/polis/output/polis_*_qwen7b | tail -1        # expect 522M
ls data/data/polis/dpo_pairs_targets                          # expect 1279 2053 2289 .jsonl
ls data/data/polis/utas_ground_truth/2024HoR.json             # expect present
```

---

## 2. Pod — clone

**Clone before rsync.** rsync would create the destination directories, and
`git clone` refuses a non-empty target.

**`[P1]`** · pod · clone the repo (must happen before the rsync)
```bash
git clone https://github.com/kkatodus/kokkai_analysis.git /workspace/kokkai_analysis
cd /workspace/kokkai_analysis && git checkout dev
mkdir -p /workspace/kokkai_data/polis
```

---

## 3. Laptop — ship the two payloads

Neither is in git (adapters are ~1 GB of safetensors; datasets live on the SSD).

**`[L3]`** · laptop · ship the two payloads — adapters + data inputs
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

**`[P2]`** · pod · bootstrap — deps, model cache, merge self-test
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

Measured 7B reference values (2026-08-02, `n_layers=28`, `n_groups=3`,
`touched_modules=112`, ~57 s including model load):

```
base NLL                 = 1.0786
uniform merge NLL        = 2.6322
upper-group-only merge   = 1.2157
lower-group-only merge   = 1.7669
restored base NLL        = 1.0786  (should match base)
```

Same shape as the 0.5B self-test (base 2.0808 / uniform 3.4785 / upper 2.2633 /
lower 2.3963): uniform merging badly damages the model, and the two depth groups
respond differently. That asymmetry is the whole premise of the method — if your
numbers are flat instead, see the gate above.

---

## 5. Pod — calibrate before committing

RunPod SSH sessions drop; always run inside tmux.

**`[P3]`** · pod · calibration run (TRIALS=5, one target)
```bash
tmux new -s polis
echo "$TMUX"                 # MUST be non-empty -- see the tmux check below
cd /workspace/kokkai_analysis
export KOKKAI_DATA_DIR=/workspace/kokkai_data

time TRIALS=5 TARGETS=1279 ./research/polis/scripts/run_7b_bo_gpu.sh
```

**Why:** per-trial cost is dominated by the re-merge (writing ΔW for 4 anchors ×
822M adapted params every trial), not the forwards, so the CPU timings predict
nothing. Measure seconds-per-trial, then multiply.

Detach with `Ctrl-b d`, reattach with `tmux attach -t polis`.

> **Verify tmux actually has the session.** If `Ctrl-b` echoes as `^B` in the
> terminal instead of being swallowed as the prefix, you are *not* attached and a
> dropped SSH session will kill the run. `echo $TMUX` is the reliable check.

### Measured calibration (L40S-class card, 2026-08-02)

```
preflight (model load + 5 evals)            57 s
target 1279, TRIALS=5 (load + 5 + final)   110 s
```

Those 110 s cover model load, ΔW construction, 5 trials, **and** the final eval
block (4 NLL configs × 30 utterances + 4 UTAS configs × 33 items). Optuna runs at
`WARNING` verbosity (`bo_merge_coeffs.py:51`), so there are no per-trial timestamps
to decompose it with — but the full run supplies the rate by subtraction.

**Measured on the real run** (same session, single-split, 40 trials/target):

```
preflight                                    59 s
target 1279   07:49:09 -> 07:52:53          224 s
target 2053   07:52:53 -> 07:56:26          213 s
target 2289   07:56:26 -> 07:59:56          210 s
total                                     11m45 s
```

216 s/target at 40 trials vs 110 s at 5 trials ⇒ **~3 s/trial**, with **~95 s
fixed per target** (load + ΔW build + final NLL/UTAS eval). The re-merge is far
cheaper than the CPU-era warnings suggest.

| Run | Trials | Wall clock |
|---|---|---|
| single-split | 3 targets × 40 | **~12 min** (measured) |
| nested 5-fold | 3 × 5 × 40 = 600 | **~40 min** (projected from the above) |
| granularity, `--groups 1 3` | 2 × 4 folds × 20 | **~10–15 min** |

The whole programme is roughly an hour of GPU. Do the granularity ablation in §6 —
at this rate there is no argument for skipping it.

### Check the objective isn't flat

The preflight proves the merge *applies*; this proves the BO *saw* it.

**`[P4]`** · pod · check the BO objective isn't flat
```bash
tail -60 specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/target_1279.log
```

What you are checking is that the fitted coefficients differ across anchors and
groups and that train/test NLL are close. Identical values everywhere means stop
and debug, same as a failed gate.

> ### ⚠️ Do not read the calibration's BO number as a result
> `make_sampler` sets `n_start = max(6, min(n_dims, max(6, trials // 3)))`
> (`bo_merge_coeffs.py:106`). At `dims=12` (4 anchors × 3 groups) with `TRIALS=5`
> that is **6 startup trials for a 5-trial budget** — the GP never fits, and all
> five trials are random draws.
>
> So the calibration will very likely show BO *losing* to best-single. It did on
> 2026-08-02 (BO 2.3638 vs best-single 2.1763, base 2.2648). That is expected and
> is **not** a reason to abort. `TRIALS=40` gives 12 startup + 28 GP-guided trials,
> which is the first configuration whose BO number means anything.

Reference calibration output (target 1279, 5 random trials — pipeline check only):

```
  base (no adapter)      2.2648
  uniform merge          2.7738
  best single anchor     2.1763   (2377_qwen7b)
  BO layer-group merge   2.3638   (train 2.3506)
```

Note the UTAS block is *live* at 7B — MAE(E) spanned 1.089–1.375 across configs,
rather than pinning near 3.0 the way it does at 0.5B. The "degenerate metric"
caveat printed by the script applies to the development scale, not to this run.

### Move the calibration log aside

`run_7b_bo_gpu.sh` opens `target_<id>.log` with `>>`, so the full run appends onto
your calibration output and the nested run appends onto *that* — three protocols
concatenated into one file, which makes the deliverable near-unreadable.

**`[P5]`** · pod · move the calibration log aside
```bash
mv specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/target_1279.log \
   specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/calib_1279_trials5.log
```

---

## 5.5 Everything after calibration, as one block

Calibration passed → run this. It is §6 and §7 concatenated with nothing to think
about in between; the individual steps are broken out below if something fails.

Paste **on the pod**, inside tmux:

**`[P6]`** · pod · everything after calibration, as one block (~65 min)
```bash
tmux new -s polis 2>/dev/null || tmux attach -t polis
cd /workspace/kokkai_analysis
export KOKKAI_DATA_DIR=/workspace/kokkai_data
LOGS=specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs

# keep the 5-trial calibration out of the real logs (skip if already renamed)
[ -f "$LOGS/target_1279.log" ] && mv "$LOGS/target_1279.log" "$LOGS/calib_1279_trials5.log"

# 1. single-split -- the only source of the UTAS half of the table (~12 min)
time ./research/polis/scripts/run_7b_bo_gpu.sh
for f in "$LOGS"/target_*.log; do mv "$f" "$LOGS/single_$(basename "$f")"; done

# 2. nested 5-fold CV -- unbiased estimate + error bars (~40 min)
time NESTED=1 ./research/polis/scripts/run_7b_bo_gpu.sh
for f in "$LOGS"/target_*.log; do mv "$f" "$LOGS/nested_$(basename "$f")"; done

# 3. granularity ablation -- lets the paper drop its 0.5B-only concession.
#    --dpo-dir is REQUIRED here: unlike run_7b_bo_gpu.sh, this script defaults to
#    $KOKKAI_DATA_DIR/polis/dpo_pairs_full, which §3 never ships to the pod.
#    Needs a checkout that includes the probe-merger fix (§6) -- older ones OOM.
time python research/polis/bo_granularity_ablation.py \
  --target 1279 --budget 30 --folds 4 --trials 20 \
  --groups 1 3 \
  --adapters research/polis/output/polis_{152,2377,3631,5520}_qwen7b \
  --base Qwen/Qwen2.5-7B-Instruct --device cuda \
  --dpo-dir "$KOKKAI_DATA_DIR/polis/dpo_pairs_targets" \
  2>&1 | tee "$LOGS/granularity_1279.log"

ls -la "$LOGS"
```

Then paste **on the laptop** to retrieve — do this *before* destroying the pod:

**`[L4]`** · laptop · retrieve logs after P6
```bash
REPO=~/workspace/projects/kokkai_analysis
IP=<pod-ip>; PORT=<pod-port>

rsync -avP -e "ssh -p $PORT" \
  root@$IP:/workspace/kokkai_analysis/specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs \
  $REPO/specs/polis-low-resource-persona/artifacts/

cd $REPO
git add specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs
git commit -m "POLIS: 7B merge-method comparison results (single-split, nested CV, granularity)"
```

After the first target's `START`/`END` stamps appear in the log you will know the
true per-trial rate — check them before walking away, since the nested estimate in
§5 is extrapolated, not measured.

---

## 6. Pod — the actual runs

You need **both**: nested CV has no `--utas-eval` path, so the single-split run is
the only source for the UTAS half of the table.

Run single-split **first** — it carries the UTAS half — and rename its logs before
starting nested, for the append reason in §5.

**`[P7]`** · pod · single-split then nested, run separately (~52 min)
```bash
cd /workspace/kokkai_analysis
export KOKKAI_DATA_DIR=/workspace/kokkai_data

# single-split (NLL + UTAS) -- matches the 0.5B protocol, ~12 min
time ./research/polis/scripts/run_7b_bo_gpu.sh

# separate the two protocols before the second run appends to the same files
LOGS=specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs
for f in "$LOGS"/target_*.log; do mv "$f" "$LOGS/single_$(basename "$f")"; done

# nested 5-fold CV (unbiased, error bars) -- ~40 min
time NESTED=1 ./research/polis/scripts/run_7b_bo_gpu.sh

for f in "$LOGS"/target_*.log; do mv "$f" "$LOGS/nested_$(basename "$f")"; done
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
| `UTAS_NUMERIC` | `0` | `1` scores UTAS by the 1..N label token instead of the option strings; see §6.1 |

### 6.1 The UTAS metric needs the numeric scorer

The 2026-08-02 run's UTAS half was **not usable**: every config scored at or below
a dummy predictor that answers the scale midpoint to all 33 items, using no model
at all.

```
target      always-3   best config    BO
Takaichi       1.091   1.089 (uni)   1.330
Akamine        1.455   1.365 (base)  1.418
Edano          1.030   1.068 (uni)   1.152
```

Cause: the default verbose-option scorer softmaxes five length-normalised
per-token log-probs that all sit in a narrow band, so the expectation collapses
toward the midpoint whatever the model believes. `score_options_numeric()` in
`polis_option_logprob.py` is the fix and was never wired through.

`bo_merge_coeffs.py` now prints the constant baselines as rows in the table.
**Read them first.** A config that does not beat the constant rows has not been
shown to carry any information about the target, however good its NLL.

Only the single-split run computes UTAS, so only it needs re-running:

**`[P8]`** · pod · re-run single-split with numeric UTAS scoring (~12 min)
```bash
LOGS=specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs
for f in "$LOGS"/single_target_*.log; do mv "$f" "${f%.log}_verbose.log"; done

time UTAS_NUMERIC=1 ./research/polis/scripts/run_7b_bo_gpu.sh
for f in "$LOGS"/target_*.log; do mv "$f" "$LOGS/single_numeric_$(basename "$f")"; done
```

The NLL numbers this produces will match the earlier single-split run — the merge
and BO are untouched, only the survey scoring changed.

Logs: `specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/target_<id>.log`

### Granularity ablation — same session, recommended

The granularity sweep in the paper (§`sec:granularity`) is 0.5B-only, which is why
it currently concedes *"we do not claim that per-depth granularity improves fidelity
at development scale."* 7B is where that claim could land, and at 2 group settings
× 4 folds × 20 trials it is a small fraction of the nested run's cost. Given the
session is already paid for, do this rather than skip it.

**`[P9]`** · pod · granularity ablation (~10 min)
```bash
cd research/polis
python bo_granularity_ablation.py \
  --target 1279 --budget 30 --folds 4 --trials 20 \
  --groups 1 3 \
  --adapters output/polis_{152,2377,3631,5520}_qwen7b \
  --base Qwen/Qwen2.5-7B-Instruct --device cuda \
  --dpo-dir "$KOKKAI_DATA_DIR/polis/dpo_pairs_targets"
```

`--dpo-dir` is **required on a pod**, unlike in `run_7b_bo_gpu.sh` which sets it
internally. This script's default is `$KOKKAI_DATA_DIR/polis/dpo_pairs_full`
(`bo_merge_coeffs.py:57`) — that directory exists on the laptop's data drive but
§3 only ships `dpo_pairs_targets`, so omitting the flag fails with
`FileNotFoundError: .../dpo_pairs_full/1279.jsonl` after the model has loaded.

`--device cuda` for the same reason as everywhere else in this runbook — §4's gate,
and `run_7b_bo_gpu.sh` pinning `DEVICE=cuda`. It is *technically* optional here:
the default `device_map="auto"` puts the whole model on `cuda:0` on any card
meeting §0, and the meta-tensor failure mode §4 warns about is not silent in this
path (`LayerGroupMerger` raises `RuntimeError` on an offloaded module,
`merge_layer_group.py:98`). Pass it anyway. One invocation shape across the whole
runbook is worth more than saving eight characters.

**VRAM.** Each `LayerGroupMerger` pins ~14.8 GB on device (13.2 GB fp32 anchor
deltas + a 1.6 GB bf16 base snapshot), so only one may be alive at a time next to
the 15.2 GB model. Until 2026-08-02 this script built a throwaway `probe` merger
just to read `n_layers` and kept the loop's previous merger alive across
granularities — two or three mergers at once, which OOMs a 48 GB card on the first
forward pass. Fixed; if you see `torch.OutOfMemoryError` here on a card that ran
§6's single-split fine, your checkout predates the fix.

`--groups 1 3` is deliberate. The default sweeps `[1, 3, n_layers]`, and at 7B that
third bookend is 4×28 = **112 coefficients** — the most expensive cell by far, to
re-derive a result 0.5B already settled decisively (96 dims scored 3.441 vs base
2.880; badly-chosen coefficients actively corrupt the model). Add `28` back only if
you specifically want the upper bookend at main scale.

---

## 7. Laptop — retrieve results

**Do this before destroying the pod.** Logs are the deliverable.

**`[L5]`** · laptop · retrieve results before destroying the pod
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
| `FileNotFoundError: .../dpo_pairs_full/<id>.jsonl` | Only `bo_granularity_ablation.py` — its `--dpo-dir` default is the full corpus, which §3 doesn't ship. Pass `--dpo-dir "$KOKKAI_DATA_DIR/polis/dpo_pairs_targets"`. |
| CUDA OOM in the granularity ablation on a card that ran §6 fine | Checkout predates the probe-merger fix (2026-08-02): two `LayerGroupMerger`s at ~14.8 GB each coexisted. `git pull`. |
| Preflight fine, but BO trials all score the same | Merge applies yet the BO isn't seeing it. Stop — treat as a failed gate. |
| Calibration shows BO worse than best-single | Expected at `TRIALS=5`: startup trials (6) exceed the budget, so the GP never fits. Not a failure; see §5. |
| BO still loses to best-single at `TRIALS=40` | A real (negative) result, not a bug. Report it; don't quietly raise `--trials` until it wins. |
| `RuntimeError: N of M target modules are meta tensors` | Model was offloaded under `device_map="auto"`. Pass `--device cuda` (or `--device cpu` if it genuinely doesn't fit). |
| `^B` echoes in the terminal | You are not attached to tmux despite thinking you are. `echo $TMUX`; reattach before any long run. |
| Session died mid-run | Not in tmux. Logs survive; re-run the affected target only via `TARGETS=<id>`. |
| One log holds several runs jumbled together | The script appends (`>>`). Rename `target_*.log` between protocols, as in §5–6. |
| Pod restarted, model re-downloading | No network volume (expected), or `HF_HOME` unset. Re-run `setup_pod.sh`. |
| `git pull` aborts: "untracked working tree files would be overwritten" (the logs) | Expected whenever you commit the logs from the laptop and then pull on the pod — git wants to write the paths the pod already holds. Confirm they match, then move them aside; see below. |
| Every UTAS config ties or loses to the constant rows | The metric is not discriminating. Re-run with `UTAS_NUMERIC=1` (§6.1); do not report the table as-is. |

### Pulling on the pod after committing logs from the laptop

The logs are written on the pod as untracked files, retrieved and committed from
the laptop (§7), so the next `git pull` on the pod hits paths it already holds and
aborts. Confirm nothing on the pod is unique, then move the directory aside — git
recreates it from the commit:

**`[P10]`** · pod · clear the untracked-logs pull conflict, then pull
```bash
cd /workspace/kokkai_analysis
for f in specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs/*.log; do
  if git cat-file -e origin/dev:"$f" 2>/dev/null; then
    git show origin/dev:"$f" | diff -q - "$f" >/dev/null \
      && echo "SAME       $f" || echo "DIFFERENT  $f"
  else
    echo "POD-ONLY   $f"
  fi
done

# all SAME -> nothing unique on the pod
mv specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs /workspace/bo7b_logs_podcopy
git pull
```

`DIFFERENT` or `POD-ONLY` means something ran after the rsync and has not been
retrieved — rsync again before touching anything.

## Notes

- Always pass adapters **explicitly**. `output/polis_*` globs the 0.5B, 7B and
  smoke directories together, and mixing scales silently produces a nonsense merge.
- `research/polis/paths.py` honours `KOKKAI_DATA_DIR` / `KOKKAI_S3_MIRROR`, which is
  how the pod finds data without the SSD symlink.
- Don't `pip install -r research/requirements.txt` on the pod: it pins
  torch 2.12+cu130 and the whole `nvidia-*` wheel set, which fights the image's
  torch. `setup_pod.sh` installs the right subset.
