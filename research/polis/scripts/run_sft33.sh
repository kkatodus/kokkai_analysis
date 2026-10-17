#!/usr/bin/env bash
# The paper's main table: nested 5-fold CV + ICL over all 33 targets, on the SFT anchors.
#
# The 5-target pilot had the merge beating sparse SFT 5/5 (BO+ICL vs SFT+ICL +0.0349)
# after the DPO anchors had lost 0/33 -- see DECISIONS.md 2026-08-04. This is the n=33
# confirmation.
#
# EXISTS BECAUSE the env-prefix form of this command lost its prefix on paste: the shell
# received the tail starting at TARGETS=, so the runner silently fell back to
# single-split mode with the DPO anchors and burned two hours. Everything is baked in
# here; there is nothing to paste but the script name.
#
# USAGE:
#   ./research/polis/scripts/run_sft33.sh
#   TARGETS="1279 2053" ./research/polis/scripts/run_sft33.sh   # smoke it first
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"
REPO="$(cd "$CODE/../.." && pwd)"
ART="$REPO/specs/polis-low-resource-persona/artifacts"
LOGS="$ART/bo7b_gpu_logs"

SUFFIX="${SUFFIX:-_sft_qwen7b}"
ANCHOR_IDS="${ANCHOR_IDS:-152 2377 3631 5520}"
TAG="${TAG:-sft33}"
TARGETS="${TARGETS:-1279 2053 2289 369 2447 1572 688 2704 1543 1547 640 1551 2025 230 110 1982 1083 277 2853 3245 989 3022 1782 2171 2189 14 5518 1434 2732 808 225 942 2546}"

A=""
for i in $ANCHOR_IDS; do
  d="$CODE/output/polis_${i}${SUFFIX}"
  [ -f "$d/adapter_model.safetensors" ] || { echo "FATAL: no adapter at $d" >&2; exit 1; }
  A="$A $d"
done

echo "=== $TAG: nested + ICL over $(echo "$TARGETS" | wc -w) targets ==="
echo "  anchors: $(for a in $A; do basename "$a"; done | tr '\n' ' ')"

export ADAPTERS="${A# }"
NESTED=1 ICL=1 \
  DUMP_PICKS="$ART/bo7b_picks_${TAG}" \
  TARGETS="$TARGETS" \
  "$HERE/run_7b_bo_gpu.sh"
RC=$?

# Rename immediately: the runner appends with >>, so leaving target_<id>.log in place is
# how three protocols ended up concatenated in one file on 2026-08-02.
n=0
for f in "$LOGS"/target_*.log; do
  [ -e "$f" ] || continue
  mv "$f" "$LOGS/${TAG}_$(basename "$f")"; n=$((n + 1))
done
echo "=== done rc=$RC, renamed $n logs to ${TAG}_target_*.log ==="
echo "  read with: python $CODE/nested_log_summary.py --logs $LOGS \\"
echo "    --glob '${TAG}_target_*.log' --baseline-json $ART/sft_n33.json"
