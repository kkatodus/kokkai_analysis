"""SFT-on-the-sparse-target baseline (POLIS spec §4.3 baseline 3).

`README.md:13` states the hypothesis as: an optimised merge of data-rich anchors beats
*"fine-tuning directly on the sparse data (SFT and DPO)"*. Baselines 3 and 4 were
never implemented, so the central claim has never been tested against the thing it
claims to beat. This is baseline 3.

**Separate script, not a config inside `bo_merge_coeffs.py`, deliberately.**
`LayerGroupMerger` holds `dict(model.named_parameters())` and writes ΔW in place;
wrapping the same model with PEFT renames every module and would leave those
references pointing at the wrong tensors. Training here happens on a clean model with
no merger attached, and the results join `nested_cv`'s offline by fold index.

**Fold splits come from `bo_merge_coeffs.fold_indices`**, the same function
`nested_cv` calls — not a copy of it — so per-fold numbers are paired with the merge
results rather than merely comparable in aggregate, and cannot drift apart later.

**The baseline is given the benefit of the doubt.** With `--grid`, several
(lr, epochs) settings are trained per fold and the *best held-out* one is reported.
That is test-set selection, and it is optimistic for SFT — deliberately, since a
baseline this method is claimed to beat should not lose on a bad hyperparameter draw.
POLIS gets no such treatment. Say so wherever the number is used.

Run from research/polis/ (pilot first, then fix the setting):
    python sft_baseline.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --targets 1279 2053 2289 --grid --out sft_pilot.json
    python sft_baseline.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --targets-file ../../specs/polis-low-resource-persona/targets_n30.json \\
        --lr 2e-4 --epochs 8 --out sft_n33.json
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

from bo_merge_coeffs import NLLScorer, load_instances, fold_indices, DPO_DIR

# Matches the anchors' adapter_config.json exactly, so "SFT on the target" differs
# from "DPO on an anchor" only in the objective and the data, not the parameterisation.
LORA_KW = dict(r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
               task_type="CAUSAL_LM",
               target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])




def train_lora_on(model, tok, instances, lr: float, epochs: int,
                  max_len: int = 1024, seed: int = 0):
    """Attach a fresh LoRA to `model`, train it, return the wrapped PeftModel.

    The base model is loaded once for the whole run and reused: a 7B reload per fold
    would be ~165 loads and dominate the wall clock. The caller restores it with
    `.unload()`, and `check_restored()` verifies that actually happened.

    Loss is next-token on the `chosen` continuation only — the prompt is context, and
    scoring it would reward memorising debate transcripts rather than the politician.
    """
    torch.manual_seed(seed)
    model = get_peft_model(model, LoraConfig(**LORA_KW))
    model.train()
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=lr)

    batches = []
    for prompt, chosen in instances:
        ids_p = tok(prompt, return_tensors="pt").input_ids
        ids_c = tok(chosen, return_tensors="pt").input_ids
        ids = torch.cat([ids_p, ids_c], dim=1)[:, :max_len]
        n_ctx = min(ids_p.shape[1], ids.shape[1])
        labels = ids.clone()
        labels[:, :n_ctx] = -100          # prompt is context, not a target
        if (labels != -100).sum() == 0:
            continue                       # continuation truncated away entirely
        batches.append((ids, labels))

    order = np.random.RandomState(seed).permutation(len(batches))
    for _ in range(epochs):
        for j in order:
            ids, labels = batches[j]
            out = model(input_ids=ids.to(model.device), labels=labels.to(model.device))
            out.loss.backward()
            opt.step()
            opt.zero_grad(set_to_none=True)
    model.eval()
    return model


def check_restored(model, tok, probe, expected: float, tol: float = 1e-4) -> None:
    """PeftModel.unload() must leave the base model bit-identical.

    Same guard as the merge self-test: if the adapter does not come off cleanly, every
    later fold trains on top of the previous one and the whole run is quietly wrong.
    """
    got = NLLScorer(model, tok).mean_nll(probe)
    if abs(got - expected) > tol:
        raise RuntimeError(
            f"base model not restored after unload(): probe NLL {got:.6f} vs {expected:.6f}. "
            f"Later folds would train on a contaminated model. Re-run with --reload-per-fold.")


def run_target(args, tok, model, probe, probe_nll, target: str) -> dict:
    allinst = load_instances(target, args.budget, args.dpo_dir)
    folds = min(args.folds, len(allinst))
    fidx = fold_indices(len(allinst), folds, args.seed)
    grid = ([(lr, ep) for lr in args.grid_lr for ep in args.grid_epochs]
            if args.grid else [(args.lr, args.epochs)])

    per_fold, per_fold_cfg = [], []
    for f in range(folds):
        te = [allinst[i] for i in fidx[f]]
        dev = [allinst[i] for j in range(folds) if j != f for i in fidx[j]]
        scores = {}
        for lr, ep in grid:
            t0 = time.time()
            pm = train_lora_on(model, tok, dev, lr, ep, seed=args.seed + f)
            nll = NLLScorer(pm, tok).mean_nll(te)
            scores[(lr, ep)] = nll
            model = pm.unload()          # strips the LoRA layers, returns the base model
            del pm
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            check_restored(model, tok, probe, probe_nll)
            print(f"    fold {f} lr={lr:g} ep={ep} -> {nll:.4f}  ({time.time()-t0:.0f}s)", flush=True)
        best = min(scores, key=scores.get)
        per_fold.append(scores[best])
        per_fold_cfg.append({"lr": best[0], "epochs": best[1]})
    a = np.asarray(per_fold)
    return {"target": target, "folds": folds, "budget": len(allinst),
            "per_fold": [round(v, 4) for v in per_fold], "picked": per_fold_cfg,
            "mean": round(float(a.mean()), 4), "std": round(float(a.std()), 4),
            "selection": "best-of-grid on the held-out fold (optimistic for SFT)"
                         if args.grid else "fixed hyperparameters"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--targets", nargs="*", default=[])
    ap.add_argument("--targets-file", default=None,
                    help="targets_n30.json; its person_ids are appended to --targets")
    ap.add_argument("--dpo-dir", default=DPO_DIR)
    ap.add_argument("--budget", type=int, default=30)
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--grid", action="store_true",
                    help="sweep --grid-lr x --grid-epochs per fold and keep the best held-out "
                         "result. Optimistic for the baseline by construction; use it to pick a "
                         "setting on a few targets, then run the rest fixed.")
    ap.add_argument("--grid-lr", type=float, nargs="*", default=[5e-5, 2e-4])
    ap.add_argument("--grid-epochs", type=int, nargs="*", default=[4, 10])
    ap.add_argument("--device", default="auto")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    targets = list(args.targets)
    if args.targets_file:
        with open(args.targets_file, encoding="utf-8") as f:
            targets += [str(t["person_id"]) for t in json.load(f)["targets"]]
    if not targets:
        raise SystemExit("no targets: pass --targets and/or --targets-file")

    print(f"[sft-baseline] {len(targets)} targets  budget={args.budget} folds={args.folds}  "
          f"{'grid' if args.grid else f'lr={args.lr:g} epochs={args.epochs}'}  base={args.base}")
    print("  fold splits come from nested_cv's own fold_indices(), so values pair per fold.")

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map,
                                                 dtype=torch.bfloat16)
    model.eval()

    # Fixed probe for the unload check: a few instances from the first target, scored
    # once on the pristine base model.
    probe = load_instances(targets[0], 3, args.dpo_dir)
    probe_nll = NLLScorer(model, tok).mean_nll(probe)
    print(f"  base probe NLL {probe_nll:.6f} (re-checked after every unload)")

    results, t0 = [], time.time()
    for k, t in enumerate(targets, 1):
        print(f"\n[{k}/{len(targets)}] target {t}", flush=True)
        try:
            r = run_target(args, tok, model, probe, probe_nll, t)
        except Exception as e:                      # one bad target must not lose the run
            print(f"  FAILED: {type(e).__name__}: {e}", flush=True)
            results.append({"target": t, "error": f"{type(e).__name__}: {e}"})
            continue
        print(f"  SFT held-out NLL {r['mean']:.4f} ± {r['std']:.4f}  per-fold {r['per_fold']}",
              flush=True)
        results.append(r)
        with open(args.out, "w", encoding="utf-8") as f:   # checkpoint every target
            json.dump({"base_model": args.base, "budget": args.budget, "folds": args.folds,
                       "seed": args.seed, "grid": args.grid, "results": results}, f,
                      ensure_ascii=False, indent=1)
    ok = [r for r in results if "mean" in r]
    print(f"\ndone: {len(ok)}/{len(targets)} targets in {(time.time()-t0)/60:.1f} min -> {args.out}")
    if ok:
        print(f"  median SFT held-out NLL {np.median([r['mean'] for r in ok]):.4f}")
    print("  join with the nested-CV logs per fold; SFT's number is optimistic if --grid was used.")


if __name__ == "__main__":
    main()
