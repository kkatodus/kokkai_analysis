#!/usr/bin/env bash
# P19 -- does the merge still improve as anchors are added?
#
# The 165 fitted merges from P15 suggest n=4 is already saturated: 福島's mean coefficient
# is 0.135 and near-zero in 40% of folds, so one of four anchors is usually switched off.
# This measures the slope directly at K=2,3,4 using only anchors that already exist, so
# the "would 8 or 20 anchors help?" question gets an answer before any training run.
#
# The anchor SUBSET IS ROTATED across targets: with a fixed subset, K=2 would measure one
# particular pair rather than "two anchors", and the pairs differ a lot (塩川 wins
# best-single 38% of folds, 福島 5%).
#
# USAGE:
#   ./research/polis/scripts/run_anchor_count.sh
#   TARGETS="1279 2053" KS="2 4" ./research/polis/scripts/run_anchor_count.sh
#
# ~10 min per (target, K); the default 6 targets x 3 Ks is ~2.5-3 h.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"
REPO="$(cd "$CODE/../.." && pwd)"
DATA_DIR="${KOKKAI_DATA_DIR:-$REPO/data/data}"
LOGS="$REPO/specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs"
PICKS="$REPO/specs/polis-low-resource-persona/artifacts/bo7b_picks_anchors"
mkdir -p "$LOGS" "$PICKS"

PY="${PY:-python}"
BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"
DEVICE="${DEVICE:-cuda}"
TRIALS="${TRIALS:-40}"
TARGETS="${TARGETS:-1279 2053 2289 2189 1083 3245}"
KS="${KS:-2 3 4}"
TARGETS_DIR="$DATA_DIR/polis/dpo_pairs_targets"

O="$CODE/output"
ALL=("$O/polis_152_qwen7b" "$O/polis_2377_qwen7b" "$O/polis_3631_qwen7b" "$O/polis_5520_qwen7b")
for a in "${ALL[@]}"; do
  [ -f "$a/adapter_model.safetensors" ] || { echo "FATAL: missing adapter $a" >&2; exit 1; }
done
[ -d "$TARGETS_DIR" ] || { echo "FATAL: no $TARGETS_DIR (KOKKAI_DATA_DIR unset?)" >&2; exit 1; }

# Index-based combinations, so the rotation is explicit rather than hidden in a case.
PAIRS=("0 1" "0 2" "0 3" "1 2" "1 3" "2 3")
TRIPLES=("0 1 2" "0 1 3" "0 2 3" "1 2 3")

echo "=== P19 anchor-count slope ==="
echo "  targets : $TARGETS"
echo "  K       : $KS      trials/fold: $TRIALS"

i=0
for T in $TARGETS; do
  for K in $KS; do
    case "$K" in
      2) IDX="${PAIRS[$((i % ${#PAIRS[@]}))]}" ;;
      3) IDX="${TRIPLES[$((i % ${#TRIPLES[@]}))]}" ;;
      4) IDX="0 1 2 3" ;;
      *) echo "  skip K=$K (only 4 anchors exist)" >&2; continue ;;
    esac
    SET=(); for j in $IDX; do SET+=("${ALL[$j]}"); done
    NAMES=""; for a in "${SET[@]}"; do NAMES="$NAMES $(basename "$a" | sed 's/polis_//;s/_qwen7b//')"; done
    LOG="$LOGS/anchors${K}_target_${T}.log"
    echo ""
    echo "=== [$(date '+%F %T')] target $T  K=$K  anchors:$NAMES ==="
    echo "=== [$(date '+%F %T')] target $T K=$K anchors:$NAMES ===" >>"$LOG"
    "$PY" "$CODE/bo_merge_coeffs.py" --base "$BASE" --device "$DEVICE" \
      --target "$T" --dpo-dir "$TARGETS_DIR" --adapters "${SET[@]}" \
      --nested --budget 30 --folds 5 --trials "$TRIALS" \
      --dump-picks "$PICKS/k${K}_target_${T}.json" >>"$LOG" 2>&1
    RC=$?
    echo "=== [$(date '+%F %T')] END target $T K=$K rc=$RC ===" >>"$LOG"
    [ "$RC" -eq 0 ] || echo "  ^^ FAILED -- see $LOG" >&2
  done
  i=$((i + 1))
done

echo ""
echo "=== done. Read the slope with one glob per K: ==="
for K in $KS; do
  echo "  python $CODE/nested_log_summary.py --logs $LOGS --glob 'anchors${K}_target_*.log'"
done
echo ""
echo "  Flat from K=3 to K=4 -> more anchors is not the missing ingredient; do not"
echo "  train more. Still improving -> 8 anchors is the next build, and that needs"
echo "  bf16 deltas (fp32 is ~3.3GB/anchor) and probably --n-groups 1."
