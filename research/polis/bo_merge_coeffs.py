"""Bayesian optimisation of layer-group merge coefficients (POLIS spec §2.4, Phase 3).

Ties together the Phase-3 pieces: the custom layer-group DARE-TIES merge
(`LayerGroupMerger`) is wrapped as an Optuna objective, and a Bayesian-optimisation
sampler searches the [n_anchors × n_groups] mixing-coefficient matrix to minimise the
target's session-grounded NLL under the merged model.

Each BO evaluation = re-merge (no training) + forward passes over the target's
budget instances → cheap. The tuned coefficients are compared against three spec
baselines:
  * base model (no adapter)                     [spec baseline 1, weights-only]
  * uniform DARE-TIES merge of all anchors      [spec baseline 5]
  * best single anchor adapter                  [spec baseline 6]

Two evaluation protocols:

* **single split** (default): first `--budget` instances are the BO objective, next
  `--test` are the held-out generalisation check. Fast pilot / smoke-test framing;
  also the path that runs the §4.4 UTAS headline metric (`--utas-eval`).
* **nested k-fold CV** (`--nested`, spec §2.4/§7): the canonical objective. Outer
  k-fold (k = min(5, budget)) gives an *unbiased* generalisation estimate — each
  outer fold is held out while the BO tunes coefficients on the other folds, then
  scored on the untouched fold; rotate and aggregate mean±std. Every baseline is
  rotated the same way, so the comparison is apples-to-apples. This replaces the
  single train/test split's optimistic point estimate.

Sampler selection (`--sampler auto`, Phase-0 finding): `GPSampler` (GP-BO) for
low/medium dimensionality (≤32 dims), `TPESampler` for the high-dim full-layer-wise
ablation bookend where GP scales poorly.

Run from research/polis/ with the research venv:
    python bo_merge_coeffs.py --target 152 --budget 30 --trials 40   # single-split pilot
    python bo_merge_coeffs.py --target 152 --nested --budget 40 --trials 24  # nested CV
"""
from __future__ import annotations

import argparse
import glob
import json
import os

import numpy as np
import torch
import optuna
from optuna.samplers import GPSampler, TPESampler
from transformers import AutoModelForCausalLM, AutoTokenizer

from merge_layer_group import LayerGroupMerger
from paths import DATA_DIR

optuna.logging.set_verbosity(optuna.logging.WARNING)

# DPO pairs live on the data drive (`kdata mount`); set KOKKAI_DATA_DIR to point
# elsewhere, e.g. a rented GPU box that only has the target subset copied over.
DPO_DIR = os.path.join(DATA_DIR, "polis", "dpo_pairs_full")


def load_instances(person_id: str, n: int, dpo_dir: str = DPO_DIR) -> list[tuple[str, str]]:
    path = os.path.join(dpo_dir, f"{person_id}.jsonl")
    out = []
    with open(path) as f:
        for line in f:
            r = json.loads(line)
            out.append((r["prompt"], r["chosen"]))
            if len(out) >= n:
                break
    return out


class NLLScorer:
    def __init__(self, model, tokenizer):
        self.model, self.tok = model, tokenizer

    def mean_nll(self, instances: list[tuple[str, str]]) -> float:
        tot, k = 0.0, 0
        for prompt, cont in instances:
            ids_p = self.tok(prompt, return_tensors="pt").input_ids.to(self.model.device)
            ids_c = self.tok(cont, return_tensors="pt").input_ids.to(self.model.device)
            ids = torch.cat([ids_p, ids_c], dim=1)
            with torch.no_grad():
                logits = self.model(ids).logits[:, :-1]
                logp = torch.log_softmax(logits.float(), dim=-1)
                tok_logp = logp.gather(-1, ids[:, 1:].unsqueeze(-1)).squeeze(-1)[0]
            n_ctx = ids_p.shape[1] - 1
            tot += -tok_logp[n_ctx:].mean().item()
            k += 1
        return tot / max(k, 1)


# --------------------------------------------------------------------------- #
# Reusable pieces (also imported by bo_granularity_ablation.py)
# --------------------------------------------------------------------------- #
def select_adapters(here: str, adapters_arg, target: str, exclude_target: bool) -> list[str]:
    adapters = adapters_arg or sorted(glob.glob(os.path.join(here, "output", "polis_*")))
    adapters = [a for a in adapters if os.path.isfile(os.path.join(a, "adapter_model.safetensors"))]
    if exclude_target:
        adapters = [a for a in adapters if not os.path.basename(a).startswith(f"polis_{target}_")]
    return adapters


def make_sampler(name: str, n_dims: int, trials: int, seed: int = 0):
    """Phase-0 backend policy: GP-BO for low/medium dims, TPE for the high-dim
    full-layer-wise bookend. Returns (kind, sampler)."""
    use_gp = name == "gp" or (name == "auto" and n_dims <= 32)
    if use_gp:
        n_start = max(6, min(n_dims, max(6, trials // 3)))
        return "gp", GPSampler(seed=seed, n_startup_trials=n_start)
    return "tpe", TPESampler(seed=seed, multivariate=True, group=True,
                             n_startup_trials=max(8, n_dims // 8))


def bo_bestC(merger, scorer, dev, n_a, n_g, trials, sampler_name, cmax, seed=0):
    """Run the BO over the [n_a x n_g] coefficient matrix; objective = mean NLL on
    `dev`. Returns (bestC, best_value, sampler_kind)."""
    def objective(trial):
        C = np.array([[trial.suggest_float(f"a{ai}_g{gi}", 0.0, cmax)
                       for gi in range(n_g)] for ai in range(n_a)])
        merger.apply(C)
        return scorer.mean_nll(dev)

    kind, sampler = make_sampler(sampler_name, n_a * n_g, trials, seed)
    study = optuna.create_study(direction="minimize", sampler=sampler)
    study.optimize(objective, n_trials=trials, show_progress_bar=False)
    bestC = np.array([[study.best_params[f"a{ai}_g{gi}"] for gi in range(n_g)]
                      for ai in range(n_a)])
    return bestC, study.best_value, kind


def best_single(merger, scorer, names, fit_inst, eval_inst, n_g):
    """Pick the single anchor with lowest NLL on `fit_inst`, score it on `eval_inst`.
    Returns (anchor_name, eval_nll)."""
    n_a = len(names)
    scores = {}
    for ai, nm in enumerate(names):
        C = np.zeros((n_a, n_g)); C[ai, :] = 1.0
        merger.apply(C)
        scores[nm] = scorer.mean_nll(fit_inst)
    best = min(scores, key=scores.get)
    ai = names.index(best)
    C = np.zeros((n_a, n_g)); C[ai, :] = 1.0
    merger.apply(C)
    return best, scorer.mean_nll(eval_inst)


def nested_cv(merger, scorer, names, allinst, folds, trials, sampler_name, cmax, seed=0):
    """Nested k-fold CV (spec §2.4). Each outer fold is held out while the BO tunes
    on the rest, then scored on the untouched fold; baselines rotate identically.
    Returns a dict method -> list of per-fold held-out NLLs (unbiased estimate)."""
    n_a, n_g = len(names), merger.n_groups
    idx = np.arange(len(allinst))
    np.random.RandomState(seed).shuffle(idx)
    fold_idx = np.array_split(idx, folds)

    rows: dict[str, list[float]] = {"base": [], "uniform": [], "best-single": [], "BO": []}
    picks = {"best-single": [], "BO": []}
    for f in range(folds):
        te = [allinst[i] for i in fold_idx[f]]
        dev = [allinst[i] for j in range(folds) if j != f for i in fold_idx[j]]

        merger.restore()
        rows["base"].append(scorer.mean_nll(te))
        merger.apply(np.ones((n_a, n_g)))
        rows["uniform"].append(scorer.mean_nll(te))

        bs_name, bs_te = best_single(merger, scorer, names, dev, te, n_g)
        rows["best-single"].append(bs_te); picks["best-single"].append(bs_name)

        bestC, _, _ = bo_bestC(merger, scorer, dev, n_a, n_g, trials, sampler_name, cmax, seed=seed + f)
        merger.apply(bestC)
        rows["BO"].append(scorer.mean_nll(te))
        picks["BO"].append(bestC)

    merger.restore()
    return rows, picks


def _fmt_stats(vals: list[float]) -> str:
    a = np.asarray(vals)
    return f"{a.mean():.4f} ± {a.std():.4f}"


def _utas_constant_baselines(gt: dict, person_id: str) -> list[tuple[str, dict]]:
    """Score the dummy predictors that answer one fixed value to every UTAS item.

    These are the floor the §4.4 metric has to clear to mean anything: they use no
    model, no adapter and no merge, so any config that fails to beat them has not
    been shown to carry information about the target. Two rows are reported — the
    scale midpoint (what a degenerate scorer collapses to; see --utas-numeric) and
    the best constant available in hindsight, which is the harder floor.

    Item selection mirrors evaluate_anchor(): unanswered items and items with no
    Japanese wording are skipped, so the rows are computed over the same set.
    """
    ans = gt["answers"][str(person_id)]
    items = {it["code"]: it for it in gt["items"]}
    truths = [t for code, t in ans["coded"].items()
              if t is not None and items.get(code, {}).get("question_ja")]
    if not truths:
        return []
    n_opts = max(len(it["options_ja"]) for it in gt["items"] if it.get("options_ja"))
    mid = (n_opts + 1) // 2

    def stats(c: int) -> dict:
        errs = [abs(t - c) for t in truths]
        return {"mae": round(sum(errs) / len(errs), 3),
                "within1": round(sum(e <= 1 for e in errs) / len(errs), 3),
                "exact": round(sum(e == 0 for e in errs) / len(errs), 3)}

    best_c = min(range(1, n_opts + 1), key=lambda c: stats(c)["mae"])
    rows = [(f"constant({mid}) [midpoint]", stats(mid))]
    if best_c != mid:
        rows.append((f"constant({best_c}) [best in hindsight]", stats(best_c)))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--target", required=True, help="person_id whose utterances are the objective")
    ap.add_argument("--dpo-dir", default=DPO_DIR,
                    help="dir holding {target}.jsonl (prompt/chosen). Use dpo_pairs_targets "
                         "for genuine held-out targets outside the anchor set")
    ap.add_argument("--exclude-target", action="store_true",
                    help="withhold the target's own adapter from the merge (leave-one-out)")
    ap.add_argument("--adapters", nargs="*")
    ap.add_argument("--n-groups", type=int, default=3)
    ap.add_argument("--density", type=float, default=0.1)
    ap.add_argument("--budget", type=int, default=30, help="train instances (BO objective)")
    ap.add_argument("--test", type=int, default=30, help="held-out instances (single-split mode)")
    ap.add_argument("--trials", type=int, default=40)
    ap.add_argument("--cmax", type=float, default=1.5, help="per-coefficient upper bound")
    ap.add_argument("--sampler", choices=["auto", "gp", "tpe"], default="auto",
                    help="BO backend; auto = GP for <=32 dims, TPE above (Phase-0 policy)")
    ap.add_argument("--nested", action="store_true",
                    help="nested k-fold CV unbiased estimate (spec §2.4) instead of single split")
    ap.add_argument("--folds", type=int, default=0,
                    help="outer folds for --nested; 0 => min(5, budget) per spec §7")
    ap.add_argument("--utas-eval", metavar="GROUND_TRUTH_JSON", default=None,
                    help="also score base/uniform/best-single/BO merges against the target's real "
                         "UTAS answers (spec §4.4 headline metric). Pass a wave file from "
                         "build_utas_ground_truth.py (must be --all-matched to include the target)")
    ap.add_argument("--utas-numeric", action="store_true",
                    help="score the UTAS items by the numeric label the model would emit (1..N, "
                         "one token each) instead of the full option strings. The verbose-option "
                         "path softmaxes five length-normalised per-token log-probs that all sit "
                         "in a narrow band, so E collapses toward the scale midpoint and the "
                         "metric stops discriminating — compare the constant-baseline row below. "
                         "See score_options_numeric() in polis_option_logprob.py (Phase-0 fix).")
    ap.add_argument("--device", default="auto",
                    help="'auto' = device_map=auto; anything else pins the whole model to that "
                         "device ('cpu', 'cuda'). The merge writes ΔW in place, and under 'auto' "
                         "a model too big for the GPU has its overflow layers placed as meta "
                         "tensors, where those writes silently no-op (upper-group merge == base). "
                         "LayerGroupMerger now raises instead of merging silently-wrong, but "
                         "prefer pinning explicitly: 'cuda' on a GPU that fits the whole model "
                         "(7B bf16 needs ~31GB incl. the fp32 anchor deltas), 'cpu' otherwise. "
                         "CPU forwards are ~1-3 min at 7B: fine for a few UTAS evals, infeasible "
                         "for a full BO.")
    args = ap.parse_args()

    here = os.path.dirname(__file__)
    adapters = select_adapters(here, args.adapters, args.target, args.exclude_target)
    names = [os.path.basename(a).replace("polis_", "") for a in adapters]

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map, dtype=torch.bfloat16)
    model.eval()
    merger = LayerGroupMerger(model, adapters, n_groups=args.n_groups, density=args.density)
    scorer = NLLScorer(model, tok)
    n_a, n_g = merger.n_anchors, merger.n_groups

    if args.nested:
        run_nested(args, model, tok, merger, scorer, names, n_a, n_g)
    else:
        run_single_split(args, model, tok, merger, scorer, names, n_a, n_g)
    merger.restore()


# --------------------------------------------------------------------------- #
def run_nested(args, model, tok, merger, scorer, names, n_a, n_g) -> None:
    folds = args.folds or min(5, args.budget)
    allinst = load_instances(args.target, args.budget, args.dpo_dir)
    folds = min(folds, len(allinst))
    kind, _ = make_sampler(args.sampler, n_a * n_g, args.trials)
    print(f"[nested-CV] target={args.target} anchors={names} n_groups={n_g} "
          f"dims={n_a * n_g} sampler={kind} budget={len(allinst)} folds={folds} "
          f"trials/fold={args.trials} exclude_target={args.exclude_target}")

    rows, picks = nested_cv(merger, scorer, names, allinst, folds,
                            args.trials, args.sampler, args.cmax)

    print("\n======== nested-CV held-out NLL (unbiased, lower=better) ========")
    for m in ["base", "uniform", "best-single", "BO"]:
        print(f"  {m:14} {_fmt_stats(rows[m])}   per-fold {[round(v, 3) for v in rows[m]]}")
    bo, base = np.asarray(rows["BO"]), np.asarray(rows["base"])
    bs = np.asarray(rows["best-single"])
    print(f"\n  BO vs base (paired):        {(base - bo).mean():+.4f} ± {(base - bo).std():.4f}")
    print(f"  BO vs best-single (paired): {(bs - bo).mean():+.4f} ± {(bs - bo).std():.4f}")
    print(f"  best-single picks per fold: {picks['best-single']}")
    print("  NB: paired deltas across folds are the honest signal; at 0.5B adapters encode "
          "register not ideology, so absolute NLL gains are small (§4.4 note).")


# --------------------------------------------------------------------------- #
def run_single_split(args, model, tok, merger, scorer, names, n_a, n_g) -> None:
    allinst = load_instances(args.target, args.budget + args.test, args.dpo_dir)
    train, test = allinst[:args.budget], allinst[args.budget:args.budget + args.test]
    kind, _ = make_sampler(args.sampler, n_a * n_g, args.trials)
    print(f"target={args.target}  anchors={names}  n_groups={n_g}  dims={n_a * n_g}  "
          f"sampler={kind}  train={len(train)} test={len(test)}  exclude_target={args.exclude_target}")

    # ---- baselines -----------------------------------------------------------
    merger.restore()
    base_te = scorer.mean_nll(test)
    merger.apply(np.ones((n_a, n_g)))
    uni_te = scorer.mean_nll(test)
    single = {}
    for ai, nm in enumerate(names):
        C = np.zeros((n_a, n_g)); C[ai, :] = 1.0
        merger.apply(C)
        single[nm] = scorer.mean_nll(test)
    best_single_name = min(single, key=single.get)

    # ---- BO over layer-group coefficients ------------------------------------
    bestC, best_value, _ = bo_bestC(merger, scorer, train, n_a, n_g,
                                    args.trials, args.sampler, args.cmax)
    merger.apply(bestC)
    bo_te = scorer.mean_nll(test)

    # ---- report --------------------------------------------------------------
    print("\n================ held-out test NLL (lower=better) ================")
    print(f"  base (no adapter)      {base_te:.4f}")
    print(f"  uniform merge          {uni_te:.4f}")
    print(f"  best single anchor     {single[best_single_name]:.4f}   ({best_single_name})")
    print(f"  BO layer-group merge   {bo_te:.4f}   (train {best_value:.4f})")
    print(f"\n  BO vs uniform:  {uni_te - bo_te:+.4f}   BO vs best-single: {single[best_single_name] - bo_te:+.4f}")
    print("\nbest coefficients [anchor x group]:")
    print("            " + "".join(f"{'g'+str(g):>8}" for g in range(n_g)))
    for ai, nm in enumerate(names):
        print(f"  {nm[:18]:18}" + "".join(f"{bestC[ai, g]:8.3f}" for g in range(n_g)))

    # ---- §4.4 UTAS headline metric (real answers, not the NLL proxy) ----------
    if args.utas_eval:
        from polis_option_logprob import evaluate_anchor  # sibling module
        with open(args.utas_eval, encoding="utf-8") as f:
            gt = json.load(f)
        if str(args.target) not in gt.get("answers", {}):
            print(f"\n[utas-eval] target {args.target} absent from {args.utas_eval} "
                  f"(rebuild ground truth with --all-matched) — skipping.")
        else:
            bs = np.zeros((n_a, n_g)); bs[names.index(best_single_name), :] = 1.0
            configs = [("base", None), ("uniform", np.ones((n_a, n_g))),
                       (f"best-single({best_single_name})", bs), ("BO", bestC)]
            n_ans = gt["answers"][str(args.target)]["n_answered"]
            scoring = "numeric-label" if args.utas_numeric else "verbose-option"
            print(f"\n===== §4.4 UTAS headline metric — target {args.target} "
                  f"({gt['wave']}, {n_ans} answered items, scoring={scoring}) =====")
            print(f"  {'config':32} {'MAE(E)':>8} {'MAE(arg)':>9} {'within1':>8} {'exact':>7}")
            for label, stats in _utas_constant_baselines(gt, str(args.target)):
                print(f"  {label:32} {stats['mae']:>8} {stats['mae']:>9} "
                      f"{stats['within1']:>8} {stats['exact']:>7}")
            for label, C in configs:
                merger.restore() if C is None else merger.apply(C)
                agg = evaluate_anchor(model, tok, gt, str(args.target),
                                      numeric=args.utas_numeric)["aggregate"]
                print(f"  {label:32} {agg['mae_expectation']:>8} {agg['mae_argmax']:>9} "
                      f"{agg['within1_acc']:>8} {agg['exact_acc']:>7}")
            print("  NB: the constant rows answer the same value to every item — no model, no "
                  "adapter, no merge. A config that does not beat them has not been shown to "
                  "carry any information about this target, however good its NLL.")


if __name__ == "__main__":
    main()
