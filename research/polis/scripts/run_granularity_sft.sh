#!/usr/bin/env bash
# Granularity ablation on the SFT anchors: does per-depth weighting buy anything once
# the anchors' deltas stop fighting each other?
#
# The committed null (DECISIONS.md 2026-08-02, target 1279) was global 4 dims 2.1557 vs
# layer-group 12 dims 2.1563 -- a 0.0006 gap against a +-0.08 spread, which retired the
# paper's "the natural place for the register/ideology distinction to appear at main
# scale" hedge. That was measured on DPO anchors whose uniform merge scored 2.63 against
# base 1.08: deltas pulling against each other, so there may have been nothing for
# per-depth weighting to separate. On the SFT anchors the same uniform merge is 1.94, and
# anchor choice now tracks party at p=0.0012, so the hedge deserves one more test before
# it is retired in print.
#
# ~10 min per target. Defaults to the 3 originals (~30 min) rather than 1279 alone: the
# committed result is one draw, and if the gap opens at all we will want more than one.
#
# USAGE:
#   ./research/polis/scripts/run_granularity_sft.sh
#   TARGETS=1279 ./research/polis/scripts/run_granularity_sft.sh    # just the paired cell
#   SUFFIX=_qwen7b ./research/polis/scripts/run_granularity_sft.sh  # re-run the DPO arm
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"
REPO="$(cd "$CODE/../.." && pwd)"
LOGS="$REPO/specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs"
mkdir -p "$LOGS"

PY="${PY:-python}"
BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"
DEVICE="${DEVICE:-cuda}"
SUFFIX="${SUFFIX:-_sft_qwen7b}"
ANCHOR_IDS="${ANCHOR_IDS:-152 2377 3631 5520}"
TARGETS="${TARGETS:-1279 2053 2289}"
TAG="${TAG:-gran${SUFFIX%_qwen7b}}"

# The runner exports this; a fresh pod shell may not. Its absence is otherwise a
# FileNotFoundError several minutes into a 7B load.
if [ -z "${KOKKAI_DATA_DIR:-}" ] && [ -d /workspace/kokkai_data/polis ]; then
  export KOKKAI_DATA_DIR=/workspace/kokkai_data
fi
DATA_DIR="${KOKKAI_DATA_DIR:-$REPO/data/data}"
# REQUIRED: this script's own default is dpo_pairs_full, which the pod never receives.
DPODIR="$DATA_DIR/polis/dpo_pairs_targets"
[ -d "$DPODIR" ] || { echo "FATAL: no $DPODIR -- is KOKKAI_DATA_DIR set?" >&2; exit 1; }

# One short line per adapter: a space lost on paste turns two adapters into one
# nonsense path, and the merge then runs on whatever survived.
ADAPTERS=()
for a in $ANCHOR_IDS; do ADAPTERS+=("$CODE/output/polis_${a}${SUFFIX}"); done
for a in "${ADAPTERS[@]}"; do
  [ -f "$a/adapter_model.safetensors" ] || { echo "FATAL: no adapter at $a" >&2; exit 1; }
done

echo "=== $TAG: granularity ablation over $(echo "$TARGETS" | wc -w) targets ==="
echo "  anchors: ${ADAPTERS[*]##*/}"

for T in $TARGETS; do
  LOG="$LOGS/${TAG}_${T}.log"
  echo "=== [$(date '+%F %T')] START $T -> $LOG ==="
  # --groups 1 3 deliberately omits the n_layers bookend: 4x28 = 112 coefficients is the
  # most expensive cell by far, and 0.5B settled it (96 dims 3.441 vs base 2.880).
  "$PY" "$CODE/bo_granularity_ablation.py" \
    --base "$BASE" --device "$DEVICE" \
    --target "$T" --budget 30 --folds 4 --trials 20 \
    --groups 1 3 \
    --adapters "${ADAPTERS[@]}" \
    --dpo-dir "$DPODIR" >"$LOG" 2>&1
  RC=$?
  echo "=== [$(date '+%F %T')] END $T rc=$RC ==="
  [ "$RC" -eq 0 ] || echo "  ^^ target $T FAILED -- check $LOG" >&2
done

echo "=== done: $LOGS/${TAG}_*.log ==="
echo "  compare against the DPO arm in granularity_1279.log (global 2.1557 / groups 2.1563)"
