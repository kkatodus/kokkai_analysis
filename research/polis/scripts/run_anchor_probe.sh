#!/usr/bin/env bash
# P18 -- is the anchors' training objective the confound?
#
# DPO ties the merge (24/33 to BO, p=0.014) while SFT beats it 33/33, and the anchors were
# trained with DPO. So "merging loses to fine-tuning" may really be "SFT is the better
# objective at a 24-instance budget and the anchors were built with the other one". This
# trains ONE anchor with SFT and scores it against its DPO twin, before paying to retrain
# four. See DECISIONS.md 2026-08-04.
#
# USAGE (nothing to export, nothing to paste):
#   ./research/polis/scripts/run_anchor_probe.sh
#   ANCHOR=2377 ./research/polis/scripts/run_anchor_probe.sh    # probe a different anchor
#   LIMIT=6000  ./research/polis/scripts/run_anchor_probe.sh    # more training data
#   SKIP_TRAIN=1 ./research/polis/scripts/run_anchor_probe.sh   # adapter already trained
#
# ~20-40 min to train at LIMIT=3000, then ~5 min per anchor per target.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODE="$(dirname "$HERE")"                       # research/polis
REPO="$(cd "$CODE/../.." && pwd)"
DATA_DIR="${KOKKAI_DATA_DIR:-$REPO/data/data}"
ART="$REPO/specs/polis-low-resource-persona/artifacts"
mkdir -p "$ART"

PY="${PY:-python}"
BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"
DEVICE="${DEVICE:-cuda}"
ANCHOR="${ANCHOR:-152}"
LIMIT="${LIMIT:-3000}"
LR="${LR:-5e-5}"
EPOCHS="${EPOCHS:-1}"
TRIALS="${TRIALS:-8}"          # only the uniform/base rows are wanted; the BO is incidental
PROBE="${PROBE:-1279 2053 2289 2189 1083}"

DPO_ADAPTER="$CODE/output/polis_${ANCHOR}_qwen7b"
SFT_ADAPTER="$CODE/output/polis_${ANCHOR}_sft_qwen7b"
TARGETS_DIR="$DATA_DIR/polis/dpo_pairs_targets"
ANCHOR_DIR="$DATA_DIR/polis/dpo_pairs_full"

die() { echo "FATAL: $*" >&2; exit 1; }

[ -f "$DPO_ADAPTER/adapter_model.safetensors" ] || die "no DPO anchor at $DPO_ADAPTER"
[ -d "$TARGETS_DIR" ] || die "no $TARGETS_DIR (KOKKAI_DATA_DIR unset?)"
if [ "${SKIP_TRAIN:-0}" != "1" ]; then
  # The anchor's OWN pairs live in the full corpus, which RUNPOD.md §3 does not ship.
  [ -f "$ANCHOR_DIR/$ANCHOR.jsonl" ] || die \
    "no $ANCHOR_DIR/$ANCHOR.jsonl -- the anchors' own pairs are in dpo_pairs_full, which
       §3 does not copy to a pod. Ship just this one file:
         rsync -avP -e \"ssh -p \$PORT\" \\
           ~/workspace/projects/kokkai_analysis/data/data/polis/dpo_pairs_full/$ANCHOR.jsonl \\
           root@\$IP:$ANCHOR_DIR/"
fi

echo "=== P18 anchor-objective probe ==="
echo "  anchor  : $ANCHOR   (DPO: $DPO_ADAPTER)"
echo "  targets : $PROBE"
echo "  train   : limit=$LIMIT lr=$LR epochs=$EPOCHS"

# ---- 1. train the SFT twin -------------------------------------------------
TRAIN_LOG="$ART/anchor_sft_${ANCHOR}.log"
if [ "${SKIP_TRAIN:-0}" = "1" ]; then
  echo ""; echo "=== [1/2] SKIP_TRAIN=1, using $SFT_ADAPTER ==="
  [ -f "$SFT_ADAPTER/adapter_model.safetensors" ] || die "no adapter at $SFT_ADAPTER"
else
  echo ""; echo "=== [1/2] $(date '+%F %T') training the SFT anchor ==="
  "$PY" "$CODE/train_anchor_sft.py" --person-id "$ANCHOR" --base "$BASE" --device "$DEVICE" \
    --data-dir "$ANCHOR_DIR" --limit "$LIMIT" --lr "$LR" --epochs "$EPOCHS" \
    --out "$SFT_ADAPTER" 2>&1 | tee "$TRAIN_LOG"
  grep -q "WARNING: no improvement" "$TRAIN_LOG" && die \
    "the SFT anchor did not beat base on its own held-out speech. Merging it would
       measure a broken training run, not the objective. Try LR=2e-5 or EPOCHS=2."
  [ -f "$SFT_ADAPTER/adapter_model.safetensors" ] || die "training produced no adapter"
fi

# ---- 2. score each anchor ALONE -------------------------------------------
# One --adapters entry means the 'uniform' row is that anchor at coefficient 1.0, which
# is the number being compared. No new evaluation code needed.
echo ""; echo "=== [2/2] $(date '+%F %T') scoring each anchor alone ==="
for A in "$DPO_ADAPTER" "$SFT_ADAPTER"; do
  TAG="$(basename "$A")"
  LOG="$ART/anchor_objective_${TAG}.log"
  : >"$LOG"
  for T in $PROBE; do
    echo "  [$(date '+%T')] $TAG target $T"
    echo "=== target $T ===" >>"$LOG"
    "$PY" "$CODE/bo_merge_coeffs.py" --base "$BASE" --device "$DEVICE" \
      --target "$T" --dpo-dir "$TARGETS_DIR" --adapters "$A" \
      --nested --budget 30 --folds 5 --trials "$TRIALS" >>"$LOG" 2>&1 \
      || echo "  ^^ $TAG target $T FAILED -- see $LOG" >&2
  done
done

# ---- summary ---------------------------------------------------------------
echo ""
echo "=== uniform row = the anchor applied alone (lower is better) ==="
"$PY" - "$ART/anchor_objective_$(basename "$DPO_ADAPTER").log" \
        "$ART/anchor_objective_$(basename "$SFT_ADAPTER").log" <<'EOF'
import re, sys
def read(p):
    out, t = {}, None
    for line in open(p, encoding="utf-8", errors="replace"):
        m = re.match(r"=== target (\d+) ===", line)
        if m:
            t = m.group(1)
        m = re.match(r"\s{2}(uniform|base)\s+([\d.]+) ±", line)
        if m and t:
            out.setdefault(t, {})[m.group(1)] = float(m.group(2))
    return out
dpo, sft = read(sys.argv[1]), read(sys.argv[2])
print(f"  {'target':>7} {'base':>8} {'DPO-anchor':>11} {'SFT-anchor':>11} {'SFT better by':>14}")
deltas = []
for t in sorted(set(dpo) & set(sft)):
    d, s = dpo[t].get("uniform"), sft[t].get("uniform")
    if d is None or s is None:
        continue
    deltas.append(d - s)
    print(f"  {t:>7} {dpo[t].get('base', float('nan')):8.4f} {d:11.4f} {s:11.4f} {d - s:+14.4f}")
if deltas:
    w = sum(1 for x in deltas if x > 0)
    print(f"\n  SFT anchor better on {w}/{len(deltas)} targets, mean {sum(deltas)/len(deltas):+.4f}")
    print("  Consistently better -> retrain all four anchors with SFT and re-run P15.")
    print("  Level -> the anchors' objective is not the explanation; the negative result stands.")
EOF
echo ""
echo "=== done. logs in $ART ==="
