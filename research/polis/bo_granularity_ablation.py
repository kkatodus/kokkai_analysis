"""Granularity ablation bookends for the layer-group merge BO (POLIS spec §2.4, §4.3).

Spec §2.4: the layer-group coefficient search (3–4 depth groups → ~24–32 dims for 8
anchors) is the operating point; the ablation *bookends* it with
  * **global** per-anchor coefficients  (n_groups = 1 → n_anchors dims)
  * **layer-group** (the default operating point, n_groups = 3)
  * **full layer-wise** (n_groups = n_layers → n_anchors × n_layers dims)
to trace the granularity-vs-optimizability curve. The sampler auto-switches per
dimensionality (Phase-0 policy): GP-BO for ≤32 dims, TPE for the high-dim
full-layer-wise bookend where GP scales poorly.

Each cell is a full **nested k-fold CV** (unbiased held-out NLL, spec §2.4) reusing
`bo_merge_coeffs.nested_cv`, so the curve compares like-for-like against base /
uniform / best-single at every granularity.

At 0.5B (4 anchors, 24 layers): global = 4 dims, layer-group(3) = 12, full = 96 —
enough to exercise both the GP and TPE regimes. Main scale (8 anchors, ~28 layers)
is the spec's 8 / 24–32 / ~192 curve.

Run from research/polis/ with the research venv:
    python bo_granularity_ablation.py \
        --target 152 --budget 40 --folds 4 --trials 20

At main scale pin the device explicitly, as in bo_merge_coeffs.py. On a box that
only has the target subset of DPO pairs copied over (a rented GPU), `--dpo-dir`
must be passed too — the default is `<data>/polis/dpo_pairs_full`:
    python bo_granularity_ablation.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \
        --target 1279 --budget 30 --folds 4 --trials 20 --groups 1 3 \
        --adapters output/polis_{152,2377,3631,5520}_qwen7b \
        --dpo-dir "$KOKKAI_DATA_DIR/polis/dpo_pairs_targets"
"""
from __future__ import annotations

import argparse
import os

import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from merge_layer_group import LayerGroupMerger
from bo_merge_coeffs import (
    NLLScorer, load_instances, select_adapters, make_sampler, nested_cv, DPO_DIR,
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--target", required=True)
    ap.add_argument("--dpo-dir", default=DPO_DIR)
    ap.add_argument("--exclude-target", action="store_true")
    ap.add_argument("--adapters", nargs="*")
    ap.add_argument("--groups", type=int, nargs="*", default=None,
                    help="n_groups values to sweep; default = [1, 3, n_layers]")
    ap.add_argument("--density", type=float, default=0.1)
    ap.add_argument("--budget", type=int, default=40)
    ap.add_argument("--folds", type=int, default=4)
    ap.add_argument("--trials", type=int, default=20)
    ap.add_argument("--cmax", type=float, default=1.5)
    ap.add_argument("--sampler", choices=["auto", "gp", "tpe"], default="auto")
    ap.add_argument("--device", default="auto",
                    help="'auto' = device_map=auto; anything else pins the whole model to that "
                         "device ('cpu', 'cuda'). Mirrors bo_merge_coeffs.py: the merge writes ΔW "
                         "in place, and under 'auto' a model too big for the GPU has its overflow "
                         "layers placed as meta tensors. LayerGroupMerger raises on those rather "
                         "than merging silently-wrong, but pin explicitly at main scale — 'cuda' "
                         "on a card that fits the whole model (7B bf16 needs ~31GB incl. the fp32 "
                         "anchor deltas), 'cpu' otherwise.")
    args = ap.parse_args()

    here = os.path.dirname(__file__)
    adapters = select_adapters(here, args.adapters, args.target, args.exclude_target)
    names = [os.path.basename(a).replace("polis_", "") for a in adapters]
    n_a = len(names)

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map, dtype=torch.bfloat16)
    model.eval()
    scorer = NLLScorer(model, tok)
    allinst = load_instances(args.target, args.budget, args.dpo_dir)
    folds = min(args.folds, len(allinst))

    # Read n_layers straight off an adapter. Do NOT build a probe merger for this:
    # each merger pins ~15GB on device at 7B (fp32 anchor deltas + base snapshot),
    # and one left alive alongside the loop's merger OOMs a 48GB card.
    n_layers = LayerGroupMerger._count_layers(adapters[0])
    groups = args.groups or sorted({1, 3, n_layers})

    print(f"target={args.target} anchors={names} n_layers={n_layers} "
          f"budget={len(allinst)} folds={folds} trials/fold={args.trials}")
    print(f"granularity sweep n_groups={groups} "
          f"(dims={[n_a * g for g in groups]})\n")

    curve = []
    for ng in groups:
        dims = n_a * ng
        kind, _ = make_sampler(args.sampler, dims, args.trials)
        # Rebuild the merger fresh at this granularity — model must be at base
        # weights so the new merger snapshots the true base (nested_cv restores).
        merger = LayerGroupMerger(model, adapters, n_groups=ng, density=args.density)
        rows, _ = nested_cv(merger, scorer, names, allinst, folds,
                            args.trials, args.sampler, args.cmax)
        merger.restore()
        # Free before the next granularity: `merger = LayerGroupMerger(...)` builds the
        # replacement *before* rebinding the name, so without this two ~15GB mergers
        # coexist and the second granularity OOMs.
        del merger
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        label = {1: "global", 3: "layer-group"}.get(ng, f"{ng}-group")
        if ng == n_layers:
            label = "full-layer-wise"
        r = {m: np.asarray(rows[m]) for m in rows}
        curve.append((ng, dims, kind, label, r))
        print(f"[{label:16} n_groups={ng:2d} dims={dims:3d} sampler={kind}]  "
              f"BO={r['BO'].mean():.4f}±{r['BO'].std():.4f}  "
              f"base={r['base'].mean():.4f}  uniform={r['uniform'].mean():.4f}  "
              f"best-single={r['best-single'].mean():.4f}")

    # ---- granularity-vs-fidelity curve --------------------------------------
    print("\n============ granularity vs held-out NLL (nested-CV, lower=better) ============")
    print(f"  {'granularity':16} {'dims':>5} {'sampler':>7} {'BO':>16} {'BOvsBase':>10} {'BOvsBest1':>10}")
    for ng, dims, kind, label, r in curve:
        dbase = (r["base"] - r["BO"]).mean()
        dbest = (r["best-single"] - r["BO"]).mean()
        print(f"  {label:16} {dims:5d} {kind:>7} "
              f"{r['BO'].mean():8.4f}±{r['BO'].std():.3f} {dbase:+10.4f} {dbest:+10.4f}")
    print("\n  NB: the curve shows whether finer per-depth granularity buys fidelity vs. its "
          "harder optimisation (GP→TPE at the high-dim end). At 0.5B expect modest, possibly "
          "non-monotonic gains — adapters encode register not ideology; the shape is the "
          "deliverable, decisive magnitudes are a 7–8B task.")


if __name__ == "__main__":
    main()
