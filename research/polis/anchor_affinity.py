#!/usr/bin/env python3
"""Which anchor does each target prefer, and does that preference track party?

The 2026-08-04 control found that a persona adapter transfers ~84% of its benefit
regardless of *whose* speeches it was trained on — Diet-speech register, not identity.
The remaining ~16% is the only place identity could live, and on 5 probe targets the
preferred anchor matched the target's party 3 times (JCP→JCP, CDP→DPJ, LDP→LDP) where
the DPO-trained anchors had *inverted* party. n=5, p≈0.10: suggestive, not a result.

This measures it properly. No merging and no BO: each anchor is applied alone at
coefficient 1.0 and scored on the same nested folds every other protocol uses, so the
numbers pair with the committed runs.

**One process, one model load.** Going through `bo_merge_coeffs --target X --adapters Y`
costs a ~60 s model load per (target, anchor) — 132 of them for 33×4, which is more time
in loading than in scoring. `LayerGroupMerger` already supports "one anchor at full
weight" as the coefficient matrix with a single non-zero row, which is exactly what
`best_single` does internally.

    python anchor_affinity.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --adapters output/polis_{152,2377,3631,5520}_sft_qwen7b \\
        --targets-file ../../specs/polis-low-resource-persona/targets_n30.json \\
        --targets 1279 2053 2289 --out affinity_sft.json
"""
from __future__ import annotations

import argparse
import json
import os
import time
from collections import Counter

import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from bo_merge_coeffs import NLLScorer, load_instances, fold_indices, TARGETS_DIR
from merge_layer_group import LayerGroupMerger
from paths import DATA_DIR

# 3631 福島みずほ sits in anchors.json as 立憲; she led the SDP. Party strings here are
# only used for the match test, so what matters is that they are comparable to the
# targets' strings, which come from the same wave metadata.
ANCHOR_PARTY = {"152": "自民", "2377": "共産", "3631": "社民", "5520": "民主"}
ORIGINAL_TARGETS = {"1279": ("高市早苗", "自民"), "2053": ("赤嶺政賢", "共産"),
                    "2289": ("枝野幸男", "立憲")}
# Coarse family, so "自由民主党・無所属の会" and "自民" compare equal, and the
# CDP/DPJ lineage counts as one family rather than two unrelated parties.
FAMILY = [("自民", "自民"), ("自由民主", "自民"), ("共産", "共産"), ("公明", "公明"),
          ("維新", "維新"), ("社民", "社民"), ("立憲", "民主"), ("民主", "民主"),
          ("国民民主", "民主")]


def family(party: str) -> str:
    for key, fam in FAMILY:
        if key in (party or ""):
            return fam
    return party or "?"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-7B-Instruct")
    ap.add_argument("--adapters", nargs="+", required=True)
    ap.add_argument("--targets", nargs="*", default=[])
    ap.add_argument("--targets-file", default=None)
    ap.add_argument("--dpo-dir", default=TARGETS_DIR)
    ap.add_argument("--budget", type=int, default=30)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--n-groups", type=int, default=3)
    ap.add_argument("--device", default="cuda")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    meta = {}
    targets = list(args.targets)
    if args.targets_file:
        with open(args.targets_file, encoding="utf-8") as f:
            for t in json.load(f)["targets"]:
                meta[str(t["person_id"])] = (t.get("name", ""), t.get("party", ""))
                targets.append(str(t["person_id"]))
    meta.update(ORIGINAL_TARGETS)
    if not targets:
        raise SystemExit("no targets")

    # A missing space between two --adapters values concatenates them into one path,
    # which otherwise surfaces as a safetensors FileNotFoundError on a nonsense path.
    for a in args.adapters:
        if not os.path.isfile(os.path.join(a, "adapter_model.safetensors")):
            extra = ("\n  That path contains a second path -- the shell joined two "
                     "--adapters values, so a space was lost on paste. Use "
                     "scripts/run_anchor_affinity.sh."
                     if a.count("/output/") > 1 else "")
            raise SystemExit(f"no adapter at {a}{extra}")

    names = [os.path.basename(a).replace("polis_", "").replace("_qwen7b", "")
             for a in args.adapters]
    anchor_ids = [n.split("_")[0] for n in names]
    print(f"[affinity] {len(targets)} targets x {len(names)} anchors: {names}")

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map,
                                                 dtype=torch.bfloat16)
    model.eval()
    merger = LayerGroupMerger(model, args.adapters, n_groups=args.n_groups)
    scorer = NLLScorer(model, tok)
    n_a, n_g = merger.n_anchors, merger.n_groups

    results, t0 = {}, time.time()
    for k, t in enumerate(targets, 1):
        try:
            allinst = load_instances(t, args.budget, args.dpo_dir)
        except FileNotFoundError:
            print(f"  [{k}/{len(targets)}] {t}: no pairs, skipped")
            continue
        folds = min(args.folds, len(allinst))
        fidx = fold_indices(len(allinst), folds, args.seed)
        te_folds = [[allinst[i] for i in fidx[f]] for f in range(folds)]

        merger.restore()
        base = [scorer.mean_nll(te) for te in te_folds]
        per_anchor = {}
        for ai, nm in enumerate(names):
            C = np.zeros((n_a, n_g)); C[ai, :] = 1.0
            merger.apply(C)
            per_anchor[nm] = [scorer.mean_nll(te) for te in te_folds]
        merger.restore()

        best = min(per_anchor, key=lambda n: float(np.mean(per_anchor[n])))
        spread = (max(float(np.mean(v)) for v in per_anchor.values())
                  - min(float(np.mean(v)) for v in per_anchor.values()))
        gap = float(np.mean(base)) - min(float(np.mean(v)) for v in per_anchor.values())
        results[t] = {"name": meta.get(t, ("", ""))[0], "party": meta.get(t, ("", ""))[1],
                      "base": base, "anchors": per_anchor, "best": best,
                      "spread": spread, "gap": gap}
        print(f"  [{k}/{len(targets)}] {t} {meta.get(t, ('', ''))[0]:<10} "
              f"base {np.mean(base):.4f}  best {best} "
              f"({min(float(np.mean(v)) for v in per_anchor.values()):.4f})  "
              f"spread {spread:.4f}  [{(time.time()-t0)/60:.1f} min]", flush=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({"base_model": args.base, "anchors": names,
                       "anchor_party": {n: ANCHOR_PARTY.get(n.split("_")[0], "?")
                                        for n in names},
                       "budget": args.budget, "folds": args.folds,
                       "results": results}, f, ensure_ascii=False, indent=1)

    # ---- does the preference track party? ---------------------------------
    fam_anchor = {n: family(ANCHOR_PARTY.get(i, "?")) for n, i in zip(names, anchor_ids)}
    scored = [r for r in results.values() if r["party"]]
    hits = [r for r in scored if family(r["party"]) == fam_anchor[r["best"]]]
    # The null is not 1/n_anchors: only targets whose family HAS an anchor can match.
    eligible = [r for r in scored if family(r["party"]) in set(fam_anchor.values())]
    print(f"\n=== anchor preference vs target party ===")
    print(f"  targets with a party recorded : {len(scored)}")
    print(f"  ...whose family has an anchor : {len(eligible)}  "
          f"(only these can match; chance = 1/{len(names)} = {1/len(names):.2f})")
    print(f"  preferred anchor matches party: {len(hits)}/{len(eligible)}")
    print(f"  spread across anchors, mean   : {np.mean([r['spread'] for r in scored]):.4f}")
    print(f"  gap from base, mean           : {np.mean([r['gap'] for r in scored]):.4f}")
    if scored:
        share = np.mean([r["spread"] for r in scored]) / np.mean([r["gap"] for r in scored])
        print(f"  anchor choice explains        : {100*share:.0f}% of the adapter's benefit")
    print(f"  best-anchor counts            : {Counter(r['best'] for r in scored).most_common()}")
    print(f"\ndone in {(time.time()-t0)/60:.1f} min -> {args.out}")
    print("  A match rate near chance means the residual is noise and the transferred "
          "quantity is register alone.")


if __name__ == "__main__":
    main()
