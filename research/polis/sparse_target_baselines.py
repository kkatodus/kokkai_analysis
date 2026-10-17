"""Fine-tune-on-the-sparse-target baselines (POLIS spec §4.3, baselines 3 and 4).

`README.md:13` states the hypothesis as: an optimised merge of data-rich anchors beats
*"fine-tuning directly on the sparse data (SFT and DPO)"*. Neither was ever
implemented, so the central claim had never been tested against the thing it claims to
beat. `--objective sft` is baseline 3, `--objective dpo` is baseline 4.

DPO here mirrors how the *anchors* were trained (`train_one_politician_persona.py`):
same LoRA shape, same `beta`, and `rejected` from the same Gemini caricature pipeline.
So "DPO on 30 target utterances" differs from "DPO on 300 anchor utterances" in the
amount of data and nothing else — which is exactly the low-resource premise under test.
The reference model is the policy with its adapter disabled, so no second copy of a 7B
is held in memory.

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

Run from research/polis/. Pilot on the 3 original targets to price a training run and
pick hyperparameters, then run the rest fixed:

    python sparse_target_baselines.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --objective sft --targets 1279 2053 2289 --grid --out sft_pilot.json

    python sparse_target_baselines.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --objective dpo --full-dir "$KOKKAI_DATA_DIR/polis/dpo_pairs_targets_full" \\
        --targets 1279 2053 2289 --grid --out dpo_pilot.json

    python sparse_target_baselines.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \\
        --objective sft --lr 2e-4 --epochs 8 \\
        --targets 1279 2053 2289 \\
        --targets-file ../../specs/polis-low-resource-persona/targets_n30.json \\
        --out sft_n33.json
"""
from __future__ import annotations

import argparse
import json
import os
import time

import numpy as np
import torch
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM, AutoTokenizer

from bo_merge_coeffs import (NLLScorer, load_instances, fold_indices, icl_nll,
                             cap_dev, DPO_DIR, TARGETS_DIR)

# Matches the anchors' adapter_config.json exactly, so "SFT on the target" differs
# from "DPO on an anchor" only in the objective and the data, not the parameterisation.
LORA_KW = dict(r=16, lora_alpha=32, lora_dropout=0.05, bias="none",
               task_type="CAUSAL_LM",
               target_modules=["q_proj", "k_proj", "v_proj", "o_proj"])


def load_negatives(target: str, n: int, dpo_dir: str, full_dir: str) -> list:
    """`rejected` for the first `n` instances, in `load_instances` order.

    Joined by `speechID`, not by row position: `generate_polis_rejected.py` writes rows
    as its thread pool completes them, so the `_full` file's order is arbitrary and
    zipping the two files would silently pair each prompt with someone else's negative.

    Returns one entry per instance, `None` where no negative was generated. Rows are
    never dropped — the list must stay index-aligned with `load_instances`, or the fold
    split stops matching the merge run's and the per-fold pairing is lost.
    """
    by_id = {}
    with open(os.path.join(full_dir, f"{target}.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r.get("rejected") and r.get("speechID"):
                by_id[r["speechID"]] = r["rejected"]
    out = []
    with open(os.path.join(dpo_dir, f"{target}.jsonl"), encoding="utf-8") as f:
        for line in f:
            if len(out) >= n:
                break
            out.append(by_id.get(json.loads(line).get("speechID")))
    return out


def seq_logp(model, tok, prompt: str, cont: str, max_len: int = 1024):
    """Summed log P(cont | prompt). Sum, not mean — DPO's log-ratios are over sequences."""
    ids_p = tok(prompt, return_tensors="pt").input_ids
    ids_c = tok(cont, return_tensors="pt").input_ids
    ids = torch.cat([ids_p, ids_c], dim=1)[:, :max_len].to(model.device)
    start = min(ids_p.shape[1], ids.shape[1]) - 1
    if start < 0 or start + 1 >= ids.shape[1]:
        return None                       # continuation truncated away entirely
    logits = model(ids).logits[:, start:-1]
    logp = torch.log_softmax(logits.float(), dim=-1)   # sliced first; see NLLScorer
    tgt = ids[:, start + 1:]
    return logp.gather(-1, tgt.unsqueeze(-1)).squeeze(-1).sum()




def train_dpo_on(model, tok, pairs, lr: float, epochs: int, beta: float = 0.1,
                 max_len: int = 1024, seed: int = 0):
    """DPO on (prompt, chosen, rejected) triples. `pairs` entries with no negative are
    skipped here but were kept in the instance list to preserve fold alignment.

    Reference log-probs come from the same model with the adapter disabled, and are
    constant through training, so they are computed once up front rather than every
    step — that halves the forward passes.
    """
    torch.manual_seed(seed)
    model = get_peft_model(model, LoraConfig(**LORA_KW))
    usable = [(p, c, r) for p, c, r in pairs if r]

    ref = []
    model.eval()
    with torch.no_grad(), model.disable_adapter():
        for p, c, r in usable:
            lc, lr_ = seq_logp(model, tok, p, c, max_len), seq_logp(model, tok, p, r, max_len)
            ref.append(None if lc is None or lr_ is None else (lc.item(), lr_.item()))

    model.train()
    opt = torch.optim.AdamW([q for q in model.parameters() if q.requires_grad], lr=lr)
    order = np.random.RandomState(seed).permutation(len(usable))
    for _ in range(epochs):
        for j in order:
            if ref[j] is None:
                continue
            p, c, r = usable[j]
            pol_c, pol_r = seq_logp(model, tok, p, c, max_len), seq_logp(model, tok, p, r, max_len)
            if pol_c is None or pol_r is None:
                continue
            ref_c, ref_r = ref[j]
            loss = -torch.nn.functional.logsigmoid(
                beta * ((pol_c - pol_r) - (ref_c - ref_r)))
            loss.backward()
            opt.step()
            opt.zero_grad(set_to_none=True)
    model.eval()
    return model


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

    negs = None
    if args.objective == "dpo":
        negs = load_negatives(target, len(allinst), args.dpo_dir, args.full_dir)
        have = sum(1 for x in negs if x)
        if have == 0:
            raise RuntimeError(f"no negatives for {target} in {args.full_dir}; "
                               f"run scripts/gen_target_negatives.sh first")
        if have < len(allinst):
            print(f"  {len(allinst) - have}/{len(allinst)} instances have no negative "
                  f"and are skipped in training (still counted for the fold split)")

    per_fold, per_fold_cfg, per_fold_icl = [], [], []
    for f in range(folds):
        te = [allinst[i] for i in fidx[f]]
        # cap_dev, not a local slice: the merge side applies the identical truncation,
        # so at a given --dev-cap both methods train on exactly the same instances.
        dev = cap_dev([allinst[i] for j in range(folds) if j != f for i in fidx[j]],
                      args.dev_cap)
        if args.objective == "dpo":
            dev_pairs = cap_dev([(allinst[i][0], allinst[i][1], negs[i])
                                 for j in range(folds) if j != f for i in fidx[j]],
                                args.dev_cap)
        scores, scores_icl = {}, {}
        for lr, ep in grid:
            t0 = time.time()
            pm = (train_dpo_on(model, tok, dev_pairs, lr, ep, args.beta, seed=args.seed + f)
                  if args.objective == "dpo"
                  else train_lora_on(model, tok, dev, lr, ep, seed=args.seed + f))
            nll = NLLScorer(pm, tok).mean_nll(te)
            scores[(lr, ep)] = nll
            if args.icl:
                # Same prefix the merge run used: the target's dev utterances, built by
                # bo_merge_coeffs so the two scripts cannot drift apart. P15 showed the
                # merge composes with prompting; SFT+ICL vs BO+ICL is the comparison
                # that decides whether the merge is needed at all.
                scores_icl[(lr, ep)] = icl_nll(NLLScorer(pm, tok), dev, te,
                                               args.icl_shots, args.icl_max_chars)
            model = pm.unload()          # strips the LoRA layers, returns the base model
            del pm
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            check_restored(model, tok, probe, probe_nll)
            print(f"    fold {f} lr={lr:g} ep={ep} -> {nll:.4f}"
                  + (f"  (+ICL {scores_icl[(lr, ep)]:.4f})" if args.icl else "")
                  + f"  ({time.time()-t0:.0f}s)", flush=True)
        # Selected on the prefix-free score even when --icl is on: selecting each row on
        # its own metric would give the combined row a second bite at the held-out fold.
        best = min(scores, key=scores.get)
        per_fold.append(scores[best])
        if args.icl:
            per_fold_icl.append(scores_icl[best])
        per_fold_cfg.append({"lr": best[0], "epochs": best[1]})
    a = np.asarray(per_fold)
    out = {"target": target, "folds": folds, "budget": len(allinst),
           "dev_cap": args.dev_cap,
           "per_fold": [round(v, 4) for v in per_fold], "picked": per_fold_cfg,
           "mean": round(float(a.mean()), 4), "std": round(float(a.std()), 4),
           "selection": "best-of-grid on the held-out fold (optimistic for SFT)"
                        if args.grid else "fixed hyperparameters"}
    if args.icl:
        b = np.asarray(per_fold_icl)
        out["per_fold_icl"] = [round(v, 4) for v in per_fold_icl]
        out["mean_icl"] = round(float(b.mean()), 4)
        out["std_icl"] = round(float(b.std()), 4)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--targets", nargs="*", default=[])
    ap.add_argument("--targets-file", default=None,
                    help="targets_n30.json; its person_ids are appended to --targets")
    ap.add_argument("--objective", choices=["sft", "dpo"], default="sft",
                    help="sft = spec baseline 3, dpo = baseline 4 (needs --full-dir)")
    ap.add_argument("--dpo-dir", default=TARGETS_DIR,
                    help="canonical prompt/chosen files; also fixes instance ORDER, which "
                         "the fold split depends on. Defaults to dpo_pairs_targets: this "
                         "script only ever runs on held-out targets, and the full corpus "
                         "is not shipped to a pod")
    ap.add_argument("--full-dir", default=None,
                    help="dir with the `rejected` side (dpo_pairs_targets_full), joined by "
                         "speechID. Required for --objective dpo")
    ap.add_argument("--beta", type=float, default=0.1,
                    help="DPO temperature; 0.1 matches the anchors' DPOConfig")
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
    ap.add_argument("--dev-cap", type=int, default=0,
                    help="train on the first N instances of each dev fold, test fold "
                         "unchanged. The budget axis -- see bo_merge_coeffs --dev-cap, "
                         "which applies the same truncation so the two sides stay paired.")
    ap.add_argument("--icl", action="store_true",
                    help="also score each trained adapter WITH the ICL prefix in front of "
                         "every held-out prompt, i.e. SFT+ICL / DPO+ICL. P15 showed the merge "
                         "composes with prompting (BO+ICL beats ICL on 33/33); this is the "
                         "matching row for the fine-tuning baselines, and SFT+ICL vs BO+ICL "
                         "is what decides whether the merge is needed at all.")
    ap.add_argument("--icl-shots", type=int, default=0,
                    help="demonstrations to prepend; 0 = the whole dev fold")
    ap.add_argument("--icl-max-chars", type=int, default=12000)
    ap.add_argument("--device", default="auto")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    targets = list(args.targets)
    if args.targets_file:
        with open(args.targets_file, encoding="utf-8") as f:
            targets += [str(t["person_id"]) for t in json.load(f)["targets"]]
    if not targets:
        raise SystemExit("no targets: pass --targets and/or --targets-file")

    if args.objective == "dpo" and not args.full_dir:
        raise SystemExit("--objective dpo requires --full-dir (see scripts/gen_target_negatives.sh)")
    print(f"[{args.objective}-baseline] {len(targets)} targets  budget={args.budget} folds={args.folds}  "
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
        print(f"  {args.objective.upper()} held-out NLL {r['mean']:.4f} ± {r['std']:.4f}  per-fold {r['per_fold']}",
              flush=True)
        if "mean_icl" in r:
            print(f"  {args.objective.upper()}+ICL held-out NLL {r['mean_icl']:.4f} ± {r['std_icl']:.4f}  "
                  f"per-fold {r['per_fold_icl']}", flush=True)
        results.append(r)
        with open(args.out, "w", encoding="utf-8") as f:   # checkpoint every target
            json.dump({"objective": args.objective, "base_model": args.base,
                       "budget": args.budget, "folds": args.folds, "beta": args.beta,
                       "seed": args.seed, "grid": args.grid, "results": results}, f,
                      ensure_ascii=False, indent=1)
    ok = [r for r in results if "mean" in r]
    print(f"\ndone: {len(ok)}/{len(targets)} targets in {(time.time()-t0)/60:.1f} min -> {args.out}")
    if ok:
        print(f"  median {args.objective.upper()} held-out NLL {np.median([r['mean'] for r in ok]):.4f}")
    print("  join with the nested-CV logs per fold; SFT's number is optimistic if --grid was used.")


if __name__ == "__main__":
    main()
