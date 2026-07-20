#!/usr/bin/env bash
# Overnight 7B merge+BO+UTAS run on CPU (session 2026-07-06b decision: "7B on CPU").
# Runs the 3 genuine held-out 2024HoR targets sequentially. Correctness fix = --device cpu
# (device_map=auto meta-offloads upper layers on the 8GB GPU -> merger writes no-op).
# MUST pass explicit 7B adapters: output/polis_* now globs 0.5B + 7B + smoke dirs.
set -u
PY=/root/projects/idea/persona/.venv/bin/python
CODE=/root/projects/idea/persona/code
KOK=/root/projects/kokkai_analysis
LOGDIR="$KOK/specs/polis-low-resource-persona/artifacts/bo7b_logs"
mkdir -p "$LOGDIR"

ADAPTERS="$CODE/output/polis_152_qwen7b $CODE/output/polis_2377_qwen7b $CODE/output/polis_3631_qwen7b $CODE/output/polis_5520_qwen7b"
GT="$KOK/data/data/polis/utas_ground_truth/2024HoR.json"
DPODIR="$KOK/data/data/polis/dpo_pairs_targets"

for T in 1279 2053 2289; do
  LOG="$LOGDIR/target_${T}.log"
  echo "=== [$(date '+%F %T')] START target $T ===" | tee -a "$LOG"
  "$PY" "$CODE/bo_merge_coeffs.py" \
    --base Qwen/Qwen2.5-7B-Instruct --device cpu \
    --target "$T" --dpo-dir "$DPODIR" \
    --adapters $ADAPTERS \
    --budget 12 --test 15 --trials 20 \
    --utas-eval "$GT" >>"$LOG" 2>&1
  RC=$?
  echo "=== [$(date '+%F %T')] END target $T rc=$RC ===" | tee -a "$LOG"
done
echo "=== [$(date '+%F %T')] ALL TARGETS DONE ===" | tee -a "$LOGDIR/target_1279.log"
