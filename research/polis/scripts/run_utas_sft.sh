#!/usr/bin/env bash
# Re-point the UTAS rank metric at the SFT anchors.
#
# WHY THIS IS OPEN AGAIN. Section 4.4 was closed on 2026-08-02: all twelve config x target
# cells ranked at or below chance against the 594-member wave, a constant beat every model
# config on every target, and the conclusion was that name-prompted persona conditioning
# does not carry politician identity at this scale. Every one of those cells was measured
# on DPO anchors -- and identity turned out to be objective-dependent: SFT anchors match
# target party 17/28 against a marginal-preserving null of 9.42 (p=0.0012) where DPO
# anchors sit at chance, Fisher p=7.2e-4 between the arms. The premise the closure rested
# on no longer holds for this anchor family.
#
# The population sweep is NOT re-run: utas_population_7b_base.json is base-model-only and
# so anchor-independent. Only the per-config vectors need regenerating.
#
# n=33 by default (~2 h), not the 3 originals. The committed §4.4 caveat is explicit that
# "three targets cannot carry a p-value -- all below chance is p ~ 0.125 on sign alone",
# and the volume-stratified 33 is the sample that fixed that for NLL.
#
# USAGE:
#   ./research/polis/scripts/run_utas_sft.sh
#   TARGETS="1279 2053 2289" ./research/polis/scripts/run_utas_sft.sh   # 12 min, pairs
#                                                                       # with the P12 table
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"
REPO="$(cd "$CODE/../.." && pwd)"
ART="$REPO/specs/polis-low-resource-persona/artifacts"
LOGS="$ART/bo7b_gpu_logs"

SUFFIX="${SUFFIX:-_sft_qwen7b}"
ANCHOR_IDS="${ANCHOR_IDS:-152 2377 3631 5520}"
TAG="${TAG:-utassft}"
TARGETS="${TARGETS:-1279 2053 2289 369 2447 1572 688 2704 1543 1547 640 1551 2025 230 110 1982 1083 277 2853 3245 989 3022 1782 2171 2189 14 5518 1434 2732 808 225 942 2546}"

if [ -z "${KOKKAI_DATA_DIR:-}" ] && [ -d /workspace/kokkai_data/polis ]; then
  export KOKKAI_DATA_DIR=/workspace/kokkai_data
fi

A=""
for i in $ANCHOR_IDS; do
  d="$CODE/output/polis_${i}${SUFFIX}"
  [ -f "$d/adapter_model.safetensors" ] || { echo "FATAL: no adapter at $d" >&2; exit 1; }
  A="$A $d"
done

echo "=== $TAG: single-split + UTAS over $(echo "$TARGETS" | wc -w) targets ==="
echo "  anchors: $(for a in $A; do basename "$a"; done | tr '\n' ' ')"

# UTAS_NUMERIC=1 is not optional. The verbose-option default softmaxes five
# length-normalised per-token log-probs sitting in a narrow band, so the expectation
# collapses toward the scale midpoint whatever the model believes -- which is how the
# original table became indistinguishable from a dummy that answers 3 to everything.
# UTAS_DUMP is what utas_rank_metric.py needs; the printed aggregate discards the
# per-item vectors, and re-deriving them means re-running the whole sweep.
export ADAPTERS="${A# }"
UTAS_NUMERIC=1 \
  UTAS_DUMP="$ART/utas_vectors${SUFFIX%_qwen7b}" \
  TARGETS="$TARGETS" \
  "$HERE/run_7b_bo_gpu.sh"
RC=$?

# Rename immediately: the runner appends with >>, which is how three protocols ended up
# concatenated into one file on 2026-08-02.
n=0
for f in "$LOGS"/target_*.log; do
  [ -e "$f" ] || continue
  mv "$f" "$LOGS/${TAG}_$(basename "$f")"; n=$((n + 1))
done
echo "=== done rc=$RC, renamed $n logs to ${TAG}_target_*.log ==="
echo "  retrieve $ART/utas_vectors${SUFFIX%_qwen7b}/ and $LOGS/${TAG}_target_*.log,"
echo "  then rank on the laptop (stdlib, no GPU) with utas_rank_metric.py --dump ..."
