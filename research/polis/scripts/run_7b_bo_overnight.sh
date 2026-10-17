#!/usr/bin/env bash
# SUPERSEDED by run_7b_bo_gpu.sh -- kept for the record only.
#
# The laptop CPU attempt (session 2026-07-06b decision: "7B on CPU"). --device cpu
# is *correct* (device_map=auto meta-offloads upper layers on an 8GB GPU, so the
# merger's in-place writes silently no-op), but pure-CPU 7B forwards over ~1.3k-token
# session contexts are ~1-3 min each: after ~12 h this was still on target 1 of 3.
# Do not run this expecting results -- use run_7b_bo_gpu.sh on a >=40GB card.
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLIS="$(dirname "$HERE")"
REPO="$(cd "$POLIS/../.." && pwd)"

PY="${PY:-python}"
LOGDIR="$REPO/specs/polis-low-resource-persona/artifacts/bo7b_logs"
mkdir -p "$LOGDIR"

ADAPTERS="$POLIS/output/polis_152_qwen7b $POLIS/output/polis_2377_qwen7b $POLIS/output/polis_3631_qwen7b $POLIS/output/polis_5520_qwen7b"
GT="$REPO/data/data/polis/utas_ground_truth/2024HoR.json"
DPODIR="$REPO/data/data/polis/dpo_pairs_targets"

for T in 1279 2053 2289; do
  LOG="$LOGDIR/target_${T}.log"
  echo "=== [$(date '+%F %T')] START target $T ===" | tee -a "$LOG"
  "$PY" "$POLIS/bo_merge_coeffs.py" \
    --base Qwen/Qwen2.5-7B-Instruct --device cpu \
    --target "$T" --dpo-dir "$DPODIR" \
    --adapters $ADAPTERS \
    --budget 12 --test 15 --trials 20 \
    --utas-eval "$GT" >>"$LOG" 2>&1
  RC=$?
  echo "=== [$(date '+%F %T')] END target $T rc=$RC ===" | tee -a "$LOG"
done
echo "=== [$(date '+%F %T')] ALL TARGETS DONE ===" | tee -a "$LOGDIR/target_1279.log"
