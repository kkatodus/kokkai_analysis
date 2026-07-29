#!/usr/bin/env bash
# Main-scale (7B) merge-method comparison on a single big-VRAM GPU.
#
# This is the paper's pending table: base / uniform / best-single / POLIS on
# held-out NLL *and* the UTAS headline metric, across the 3 genuine held-out
# 2024HoR targets. Supersedes run_7b_bo_overnight.sh, which was the --device cpu
# laptop attempt (correct but ~days; see HANDOVER.md 2026-07-07).
#
# HARDWARE: needs ~31GB VRAM free -- 15.2GB model (bf16) + 13.2GB fp32 anchor
# deltas (4 anchors x 822M adapted params) + snapshots/transients. A 40GB card is
# the floor; 48GB (L40S / A6000 / RTX 6000 Ada) is the comfortable target.
#
# USAGE (paths are derived from this script's location; nothing to export):
#   ./run_7b_bo_gpu.sh              # single-split, matches the 0.5B protocol
#   NESTED=1 ./run_7b_bo_gpu.sh     # nested 5-fold CV (unbiased; ~5x the cost)
#
# On a box without the data drive, copy the two data inputs over and point at them:
#   export KOKKAI_DATA_DIR=/workspace/kokkai_data   # honoured by research/polis/paths.py
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"                       # research/polis
KOKKAI_REPO="$(cd "$CODE/../.." && pwd)"
DATA_DIR="${KOKKAI_DATA_DIR:-$KOKKAI_REPO/data/data}"

PY="${PY:-python}"
LOGDIR="$KOKKAI_REPO/specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs"
mkdir -p "$LOGDIR"

BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"
DEVICE="${DEVICE:-cuda}"
BUDGET="${BUDGET:-30}"
TEST="${TEST:-30}"
TRIALS="${TRIALS:-40}"
FOLDS="${FOLDS:-5}"
TARGETS="${TARGETS:-1279 2053 2289}"

# MUST be explicit: output/polis_* globs 0.5B + 7B + smoke dirs together, and
# mixing scales silently produces a nonsense merge.
ADAPTERS="$CODE/output/polis_152_qwen7b $CODE/output/polis_2377_qwen7b \
$CODE/output/polis_3631_qwen7b $CODE/output/polis_5520_qwen7b"
GT="$DATA_DIR/polis/utas_ground_truth/2024HoR.json"
DPODIR="$DATA_DIR/polis/dpo_pairs_targets"

# PY may be an interpreter name on $PATH (e.g. "python3"), not a path -- check both ways.
command -v "$PY" >/dev/null 2>&1 || [ -x "$PY" ] || { echo "FATAL: no interpreter '$PY'" >&2; exit 1; }
for f in "$CODE/bo_merge_coeffs.py" "$GT" "$DPODIR"; do
  [ -e "$f" ] || { echo "FATAL: missing $f" >&2; exit 1; }
done
for a in $ADAPTERS; do
  [ -f "$a/adapter_model.safetensors" ] || { echo "FATAL: missing adapter $a" >&2; exit 1; }
done

# ---------------------------------------------------------------------------
# PREFLIGHT: prove the merge actually bites before spending GPU hours on it.
# The failure this guards against is silent: with offloaded/meta weights the
# in-place ΔW writes no-op, every coefficient reads as base, and the BO happily
# optimises a flat objective for hours. The self-test must print FOUR DISTINCT
# NLLs (base / uniform / upper-only / lower-only) and an exact restore.
# ---------------------------------------------------------------------------
echo "=== [$(date '+%F %T')] PREFLIGHT: layer-group merge self-test at 7B ==="
"$PY" "$CODE/merge_layer_group.py" --base "$BASE" --device "$DEVICE" \
  --adapters $ADAPTERS --n-groups 3 2>&1 | tee "$LOGDIR/preflight.log"
if ! grep -q "^\[OK\]" "$LOGDIR/preflight.log"; then
  echo "FATAL: merge self-test failed -- do NOT trust any BO run. See $LOGDIR/preflight.log" >&2
  exit 1
fi
echo "=== PREFLIGHT PASSED: check the 4 NLLs above are distinct, not just [OK] ==="

# ---------------------------------------------------------------------------
for T in $TARGETS; do
  LOG="$LOGDIR/target_${T}.log"
  echo "=== [$(date '+%F %T')] START target $T ===" | tee -a "$LOG"
  if [ "${NESTED:-0}" = "1" ]; then
    # Nested CV gives the unbiased estimate but has no --utas-eval path.
    MODE=(--nested --budget "$BUDGET" --folds "$FOLDS" --trials "$TRIALS")
  else
    MODE=(--budget "$BUDGET" --test "$TEST" --trials "$TRIALS" --utas-eval "$GT")
  fi
  "$PY" "$CODE/bo_merge_coeffs.py" \
    --base "$BASE" --device "$DEVICE" \
    --target "$T" --dpo-dir "$DPODIR" \
    --adapters $ADAPTERS \
    "${MODE[@]}" >>"$LOG" 2>&1
  RC=$?   # capture BEFORE any other command (a $(date) in the echo would clobber it)
  echo "=== [$(date '+%F %T')] END target $T rc=$RC ===" | tee -a "$LOG"
  [ "$RC" -eq 0 ] || echo "  ^^ target $T FAILED -- check $LOG" >&2
done
echo "=== [$(date '+%F %T')] ALL TARGETS DONE -- logs in $LOGDIR ==="
