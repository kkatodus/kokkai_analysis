#!/usr/bin/env bash
# Prepare a rented GPU box (RunPod et al.) to run the 7B merge-method comparison.
#
# Idempotent: safe to re-run after a pod restart. Ends by running the merge
# self-test, which is the only thing that proves the run is worth paying for.
#
# ---------------------------------------------------------------------------
# BEFORE running this, push the two payloads that are NOT in git.
# From the laptop (with the data drive mounted -- `kdata mount`):
#
#   POD="root@<ip> -p <port>"          # from the RunPod "Connect" panel
#   REPO=~/workspace/projects/kokkai_analysis
#
#   # 1. adapters (~522 MB, gitignored)
#   rsync -avP -e "ssh -p <port>" \
#     $REPO/research/polis/output/polis_{152,2377,3631,5520}_qwen7b \
#     root@<ip>:/workspace/kokkai_analysis/research/polis/output/
#
#   # 2. the two data inputs (small)
#   rsync -avP -e "ssh -p <port>" \
#     $REPO/data/data/polis/dpo_pairs_targets \
#     $REPO/data/data/polis/utas_ground_truth \
#     root@<ip>:/workspace/kokkai_data/polis/
#
# ---------------------------------------------------------------------------
# USAGE on the pod:
#   git clone https://github.com/kkatodus/kokkai_analysis.git /workspace/kokkai_analysis
#   cd /workspace/kokkai_analysis && git checkout dev
#   ./research/polis/scripts/setup_pod.sh
#
# Then the actual run (inside tmux -- RunPod SSH sessions drop):
#   tmux new -s polis
#   export KOKKAI_DATA_DIR=/workspace/kokkai_data
#   TRIALS=5 TARGETS=1279 ./research/polis/scripts/run_7b_bo_gpu.sh   # calibrate first
#   ./research/polis/scripts/run_7b_bo_gpu.sh                          # full single-split
#   NESTED=1 ./research/polis/scripts/run_7b_bo_gpu.sh                 # error bars
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLIS="$(dirname "$HERE")"
REPO="$(cd "$POLIS/../.." && pwd)"

DATA_DIR="${KOKKAI_DATA_DIR:-/workspace/kokkai_data}"
VOLUME="${VOLUME:-/workspace}"          # RunPod network volume -- survives pod restarts
BASE="${BASE:-Qwen/Qwen2.5-7B-Instruct}"

fail=0
note() { printf '  %-14s %s\n' "$1" "$2"; }
bad()  { printf '  %-14s %s\n' "FAIL" "$1" >&2; fail=1; }

echo "=== [1/5] GPU ==="
if ! command -v nvidia-smi >/dev/null 2>&1; then
  bad "no nvidia-smi -- this is not a GPU box"
else
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | while read -r line; do
    note "gpu" "$line"
  done
  VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -1)
  # 15.2GB bf16 model + 13.2GB fp32 anchor deltas + transients ~= 31GB.
  if [ "${VRAM_MB:-0}" -lt 40000 ]; then
    bad "only ${VRAM_MB} MiB VRAM; the merge needs ~31 GB resident (40 GB floor, 48 GB comfortable)"
  else
    note "vram" "${VRAM_MB} MiB -- enough"
  fi
fi

echo "=== [2/5] Python deps ==="
# Deliberately NOT `pip install -r research/requirements.txt`: that freeze pins
# torch 2.12+cu130 and the whole nvidia-* wheel set, which fights whatever the
# pod image already ships. Torch comes from the image; everything else is
# pinned to what produced the published numbers.
python -c "import torch; print(f'  torch          {torch.__version__} cuda={torch.cuda.is_available()}')" \
  || bad "no torch in the image -- pick a PyTorch-flavoured RunPod template"
pip install -q \
  transformers==5.9.0 peft==0.19.1 trl==1.4.0 datasets==4.8.5 \
  bitsandbytes==0.49.2 accelerate==1.13.0 safetensors==0.7.0 \
  optuna==4.9.0 scipy==1.18.0 \
  && note "pip" "ok" || bad "pip install failed"

echo "=== [3/5] Inputs ==="
for a in 152 2377 3631 5520; do
  f="$POLIS/output/polis_${a}_qwen7b/adapter_model.safetensors"
  [ -f "$f" ] && note "adapter $a" "ok" || bad "missing $f -- rsync the adapters (see header)"
done
[ -f "$DATA_DIR/polis/utas_ground_truth/2024HoR.json" ] \
  && note "utas gt" "ok" || bad "missing $DATA_DIR/polis/utas_ground_truth/2024HoR.json"
[ -d "$DATA_DIR/polis/dpo_pairs_targets" ] \
  && note "dpo pairs" "$(ls "$DATA_DIR/polis/dpo_pairs_targets" 2>/dev/null | wc -l) files" \
  || bad "missing $DATA_DIR/polis/dpo_pairs_targets"

echo "=== [4/5] Model cache ==="
# Park the 15 GB download on the network volume so a pod restart does not re-pull it.
if [ -d "$VOLUME" ]; then
  export HF_HOME="$VOLUME/hf"
  mkdir -p "$HF_HOME"
  note "HF_HOME" "$HF_HOME"
  grep -q "HF_HOME=$HF_HOME" ~/.bashrc 2>/dev/null || echo "export HF_HOME=$HF_HOME" >> ~/.bashrc
  grep -q "KOKKAI_DATA_DIR=$DATA_DIR" ~/.bashrc 2>/dev/null || echo "export KOKKAI_DATA_DIR=$DATA_DIR" >> ~/.bashrc
else
  note "HF_HOME" "no $VOLUME -- using default cache (re-downloads on restart)"
fi
python - "$BASE" <<'PY' || fail=1
import sys
from huggingface_hub import snapshot_download
p = snapshot_download(sys.argv[1], allow_patterns=["*.json","*.safetensors","*.txt","*.model"])
print(f"  model          cached at {p}")
PY

if [ "$fail" -ne 0 ]; then
  echo
  echo "SETUP INCOMPLETE -- fix the FAIL lines above before spending GPU hours." >&2
  exit 1
fi

echo "=== [5/5] Merge self-test (the one check that matters) ==="
# Under device_map="auto" the overflow layers become meta tensors and the merger's
# in-place dW writes silently no-op: every coefficient then reads as base and the
# BO optimises a flat objective for hours. Four DISTINCT NLLs prove it bites.
export KOKKAI_DATA_DIR="$DATA_DIR"
python "$POLIS/merge_layer_group.py" --base "$BASE" --device cuda --n-groups 3 \
  --adapters "$POLIS"/output/polis_{152,2377,3631,5520}_qwen7b
echo
echo "READY. Check the four NLLs above are DISTINCT -- [OK] alone is not enough."
echo "Next:  tmux new -s polis"
echo "       TRIALS=5 TARGETS=1279 $HERE/run_7b_bo_gpu.sh    # time one target first"
