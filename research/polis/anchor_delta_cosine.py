"""Anchor-delta cosine kill check (POLIS spec §6, Phase 2a).

The POLIS design merges anchor LoRA deltas and lets Bayesian optimisation pick
mixing coefficients. That only makes sense if the anchors point in *different*
directions in weight space. If the anchor deltas are near-collinear (a single shared
"real Diet register, not LLM role-play" direction dominates), the merge has almost no
per-anchor residual to interpolate over and the design is invalid — revisit the
negative-sampling design before building the full matrix.

This script loads each anchor's LoRA adapter, reconstructs the per-module weight
delta ΔW = (alpha / r) · B · A, flattens and concatenates across all modules into one
vector per anchor, and reports the pairwise cosine-similarity matrix. High off-diagonal
cosines (say > ~0.9) are the red flag.

Run from research/polis/ with the research venv:
    python anchor_delta_cosine.py \
        output/polis_152_kishida output/polis_3631_fukushima \
        output/polis_2377_shiokawa output/polis_5520_ueda
(no args → auto-discovers output/polis_* directories.)
"""
from __future__ import annotations

import argparse
import glob
import json
import os

import torch
from safetensors.torch import load_file


def _load_delta_vector(adapter_dir: str) -> torch.Tensor:
    """Reconstruct and flatten the full LoRA delta for one adapter.

    Returns a 1-D float32 tensor: for each target module, (alpha/r)·(B·A) flattened,
    concatenated in sorted module order so vectors align across anchors.
    """
    cfg = json.load(open(os.path.join(adapter_dir, "adapter_config.json")))
    r = cfg["r"]
    alpha = cfg["lora_alpha"]
    scaling = alpha / r

    st_path = os.path.join(adapter_dir, "adapter_model.safetensors")
    weights = load_file(st_path)

    # Pair lora_A / lora_B by their shared module prefix.
    prefixes = sorted(
        {
            k.rsplit(".lora_A", 1)[0]
            for k in weights
            if ".lora_A" in k
        }
    )
    chunks = []
    for pfx in prefixes:
        a = next(v for k, v in weights.items() if k.startswith(pfx) and ".lora_A" in k)
        b = next(v for k, v in weights.items() if k.startswith(pfx) and ".lora_B" in k)
        delta = (b.float() @ a.float()) * scaling  # [out, in]
        chunks.append(delta.reshape(-1))
    return torch.cat(chunks)


def main() -> None:
    ap = argparse.ArgumentParser(description="Pairwise cosine of anchor LoRA deltas")
    ap.add_argument("adapters", nargs="*", help="Adapter dirs (default: auto-discover output/polis_*)")
    ap.add_argument("--threshold", type=float, default=0.9, help="Flag off-diagonal cosines above this")
    args = ap.parse_args()

    adapters = args.adapters or sorted(glob.glob(os.path.join(os.path.dirname(__file__), "output", "polis_*")))
    adapters = [a for a in adapters if os.path.isfile(os.path.join(a, "adapter_model.safetensors"))]
    if len(adapters) < 2:
        ap.error(f"need >=2 adapters, found {len(adapters)}: {adapters}")

    labels = [os.path.basename(a).replace("polis_", "") for a in adapters]
    print("Loading anchor deltas:")
    vecs = []
    for lab, a in zip(labels, adapters):
        v = _load_delta_vector(a)
        vecs.append(v)
        print(f"  {lab:22} dim={v.numel():>9,d}  ||Δ||={v.norm().item():.4f}")

    n = len(vecs)
    mat = torch.eye(n)
    for i in range(n):
        for j in range(i + 1, n):
            cos = torch.nn.functional.cosine_similarity(vecs[i], vecs[j], dim=0).item()
            mat[i, j] = mat[j, i] = cos

    print("\nPairwise cosine similarity of anchor LoRA deltas:")
    print("            " + "".join(f"{l[:10]:>12}" for l in labels))
    flagged = []
    for i, l in enumerate(labels):
        row = "".join(f"{mat[i, j].item():>12.3f}" for j in range(n))
        print(f"{l[:10]:>12}{row}")
        for j in range(i + 1, n):
            if abs(mat[i, j].item()) > args.threshold:
                flagged.append((labels[i], labels[j], mat[i, j].item()))

    off = [mat[i, j].item() for i in range(n) for j in range(i + 1, n)]
    print(f"\noff-diagonal cosine: mean={sum(off)/len(off):.3f} "
          f"min={min(off):.3f} max={max(off):.3f}")
    if flagged:
        print(f"\n[WARN] near-collinear anchor pairs (>|{args.threshold}|):")
        for a, b, c in flagged:
            print(f"   {a} ~ {b}: {c:.3f}")
        print("→ merge design at risk (spec §6): revisit negative-sampling / register handling.")
    else:
        print(f"\n[OK] no anchor pair exceeds |{args.threshold}| — deltas are sufficiently distinct for merging.")


if __name__ == "__main__":
    main()
