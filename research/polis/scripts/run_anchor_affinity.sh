#!/usr/bin/env bash
# Which anchor does each target prefer, and does that preference track party?
#
# The four-anchor control found anchor choice explains only ~16% of what a persona
# adapter buys; the residual is the only place identity can live, and on 5 probe targets
# the preferred SFT anchor matched party 3 times where the DPO anchors inverted it.
# This runs the test at n=33. See DECISIONS.md 2026-08-04.
#
# USAGE:
#   ./research/polis/scripts/run_anchor_affinity.sh
#   SUFFIX=_qwen7b ./research/polis/scripts/run_anchor_affinity.sh   # the DPO anchors
#
# One model load for all target x anchor combinations: ~25-40 min for 33x4.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"
REPO="$(cd "$CODE/../.." && pwd)"
ART="$REPO/specs/polis-low-resource-persona/artifacts"
mkdir -p "$ART"

PY="${PY:-python}"
BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"
DEVICE="${DEVICE:-cuda}"
SUFFIX="${SUFFIX:-_sft_qwen7b}"
ANCHORS="${ANCHORS:-152 2377 3631 5520}"
OUT="${OUT:-$ART/affinity${SUFFIX%_qwen7b}.json}"

# Built as an array, one short line per element. Passing four long paths on one command
# line is how a space got lost on paste and two adapters became one nonsense path.
ADAPTERS=()
for a in $ANCHORS; do ADAPTERS+=("$CODE/output/polis_${a}${SUFFIX}"); done
for a in "${ADAPTERS[@]}"; do
  [ -f "$a/adapter_model.safetensors" ] || { echo "FATAL: no adapter at $a" >&2; exit 1; }
done

echo "=== anchor affinity ==="
echo "  anchors : ${ADAPTERS[*]##*/}"
echo "  out     : $OUT"

"$PY" "$CODE/anchor_affinity.py" \
  --base "$BASE" --device "$DEVICE" \
  --adapters "${ADAPTERS[@]}" \
  --targets 1279 2053 2289 \
  --targets-file "$REPO/specs/polis-low-resource-persona/targets_n30.json" \
  --out "$OUT" 2>&1 | tee "${OUT%.json}.log"
