#!/usr/bin/env python3
"""Train an SFT anchor, to test whether the anchors' objective is the confound.

`train_one_politician_persona.py` trains anchors with DPO (`DPOTrainer`, beta=0.1), and
the 2026-08-04 result splits cleanly along that line:

* objective-matched — merge-of-DPO-anchors vs DPO-on-sparse-target: the merge wins 24/33
* objective-mismatched — merge-of-DPO-anchors vs SFT-on-sparse-target: the merge loses 0/33

So "merging loses to fine-tuning" may really be "SFT is the better objective at this data
scale, and the anchors were built with the other one". This trains one anchor with SFT so
the comparison can be run before paying to retrain all four.

**Deliberately reuses `sparse_target_baselines.train_lora_on`** rather than TRL's
`SFTTrainer`: that is the exact loop that produced the winning sparse-SFT baseline, so an
SFT anchor differs from the sparse-SFT baseline in data volume alone — which is the
comparison being made. A second implementation would add a confound to a run whose whole
purpose is removing one.

    python train_anchor_sft.py --person-id 152 --limit 3000 \\
        --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --out output/polis_152_sft_qwen7b
"""
from __future__ import annotations

import argparse
import os
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from bo_merge_coeffs import NLLScorer, load_instances, DPO_DIR
from sparse_target_baselines import train_lora_on


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--person-id", required=True)
    ap.add_argument("--base", default="Qwen/Qwen2.5-7B-Instruct")
    ap.add_argument("--data-dir", default=DPO_DIR,
                    help="anchors' own pairs; the full corpus, not dpo_pairs_targets")
    ap.add_argument("--limit", type=int, default=3000,
                    help="instances to train on. The DPO anchors saw 4k-20k; 3000 is "
                         "~20 min/epoch here and enough to answer whether the objective "
                         "is what matters. Raise it only after the probe says it is.")
    ap.add_argument("--holdout", type=int, default=40,
                    help="instances kept out of training, scored before and after so a "
                         "run that learned nothing is visible without a separate eval")
    ap.add_argument("--lr", type=float, default=5e-5,
                    help="matches the sparse-SFT baseline; see the module docstring")
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    inst = load_instances(args.person_id, args.limit + args.holdout, args.data_dir)
    if len(inst) < args.holdout + 10:
        raise SystemExit(f"only {len(inst)} instances for {args.person_id}")
    hold, train = inst[:args.holdout], inst[args.holdout:]
    print(f"[anchor-sft] person={args.person_id} train={len(train)} holdout={len(hold)} "
          f"lr={args.lr:g} epochs={args.epochs} base={args.base}")

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map,
                                                 dtype=torch.bfloat16)
    model.eval()

    before = NLLScorer(model, tok).mean_nll(hold)
    print(f"  base held-out NLL {before:.4f}")

    t0 = time.time()
    pm = train_lora_on(model, tok, train, args.lr, args.epochs, seed=args.seed)
    after = NLLScorer(pm, tok).mean_nll(hold)
    print(f"  trained held-out NLL {after:.4f}  ({before - after:+.4f} vs base, "
          f"{(time.time() - t0) / 60:.1f} min)")
    if after >= before:
        print("  WARNING: no improvement on the anchor's own held-out speech. Either the "
              "learning rate is wrong for this data volume or the run is broken; do not "
              "merge this adapter.")

    os.makedirs(args.out, exist_ok=True)
    pm.save_pretrained(args.out)
    print(f"  -> {args.out}")
    print("  compare against the DPO anchor with bo_merge_coeffs --nested --adapters "
          "<one adapter>: with a single anchor the 'uniform' row IS that anchor's score.")


if __name__ == "__main__":
    main()
