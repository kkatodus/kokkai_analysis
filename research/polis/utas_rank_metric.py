"""Offline analysis of UTAS answer vectors: is the persona inert, and does it rank?

Consumes the dumps written by `utas_population_eval.py` (many name-personas, one
model) and by `bo_merge_coeffs.py --utas-dump` (one target, four merge configs), and
reports the two things MAE against a single politician cannot show.

**1. Name-swap divergence.** Mean pairwise L1 distance between *simulated* answer
vectors, against the same statistic over the *real* politicians. The ratio is the
diagnostic: near 0 means changing the name barely moves the answers, so the persona
is inert and no merge could ever register in the §4.4 metric — a flat table then says
nothing about the method. Near 1 means the model separates politicians about as much
as they actually differ.

**2. Rank of the true politician.** For each simulated persona, distance to every real
answer vector in the wave; report where its own politician lands. Chance is the 50th
percentile, exactly — unlike "beats a constant", this null needs no assumption, and it
is unaffected by everyone clustering near the scale midpoint because only the ordering
is scored. A method can rank well with poor absolute MAE, which is the regime the 7B
run appears to be in.

The constant-predictor MAE floor is reported alongside, since that is what sank the
absolute metric.

Runs on CPU; no model, no torch.
    python utas_rank_metric.py --gt .../2024HoR.json --dump utas_population_7b_base.json
"""
from __future__ import annotations

import argparse
import json
import statistics
from itertools import combinations


def _mean(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else float("nan")


def _l1(a, b):
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def _real_vectors(gt: dict, codes: list[str]) -> dict[str, list[float]]:
    out = {}
    for pid, a in gt["answers"].items():
        v = [a["coded"].get(c) for c in codes]
        if all(x is not None for x in v):
            out[pid] = [float(x) for x in v]
    return out


def _pairwise_spread(vectors: list[list[float]], cap: int = 300, seed: int = 0) -> float:
    """Mean pairwise L1. Sub-sampled above `cap` vectors — the full set is O(n^2)."""
    import random
    vs = list(vectors)
    if len(vs) > cap:
        random.Random(seed).shuffle(vs)
        vs = vs[:cap]
    pairs = list(combinations(range(len(vs)), 2))
    return _mean(_l1(vs[i], vs[j]) for i, j in pairs)


def analyse_population(gt: dict, dump: dict) -> None:
    codes = dump["item_codes"]
    real = _real_vectors(gt, codes)
    sims = {pid: p["expectation"] for pid, p in dump["personas"].items()}
    sim_arg = {pid: [float(x) for x in p["argmax"]] for pid, p in dump["personas"].items()}

    print(f"\n===== name-swap divergence ({dump['scoring']}, {len(sims)} personas) =====")
    real_spread = _pairwise_spread(list(real.values()))
    for label, vecs in (("expectation", sims), ("argmax", sim_arg)):
        sim_spread = _pairwise_spread(list(vecs.values()))
        ratio = sim_spread / real_spread if real_spread else float("nan")
        ident = sum(1 for a, b in combinations(list(vecs.values())[:200], 2) if a == b)
        n_pairs = len(list(combinations(range(min(200, len(vecs))), 2)))
        print(f"  simulated spread ({label:11}) {sim_spread:6.3f}   "
              f"ratio to real {ratio:5.3f}   identical pairs {ident}/{n_pairs}")
    print(f"  real politicians' spread     {real_spread:6.3f}")
    print("  ratio ~0 => the answers barely depend on the name: the persona is inert and a")
    print("  flat §4.4 table is a property of the protocol, not of the merge.")

    # A name-independent vector induces ONE fixed distance ordering over the
    # candidates, so as the persona ranges over the whole candidate set its rank takes
    # every value 1..n exactly once — median percentile exactly 50%. That is what the
    # constant rows show on a full sweep. They are still worth printing: under
    # `--personas N` with N << n the floor is a noisy sample of that ordering and can
    # land far from 50% (68% was observed at N=60), so the honest comparison is always
    # against the constants as measured in the same run, never against a nominal 50%.
    n_opts = max(int(max(v)) for v in real.values())
    bases = [("expectation", sims), ("argmax", sim_arg)]
    for c in range(1, n_opts + 1):
        bases.append((f"constant({c})", {pid: [float(c)] * len(codes) for pid in sims}))

    print(f"\n===== rank of the true politician (n={len(real)} candidates) =====")
    print(f"  {'basis':14} {'median rank':>12} {'median pct':>11} {'top-1':>7} {'top-5%':>7}")
    for label, vecs in bases:
        ranks, pcts, top1, top5 = [], [], 0, 0
        for pid, sv in vecs.items():
            if pid not in real:
                continue
            d = sorted(real, key=lambda q: _l1(sv, real[q]))
            r = d.index(pid) + 1
            ranks.append(r)
            pcts.append(100.0 * (1 - (r - 1) / len(d)))
            top1 += r == 1
            top5 += r <= max(1, len(d) // 20)
        if not ranks:
            continue
        n = len(ranks)
        print(f"  {label:14} {statistics.median(ranks):12.1f} "
              f"{statistics.median(pcts):10.1f}% {top1 / n:7.3f} {top5 / n:7.3f}")
    print("  Read against the constant rows as measured here, not against a nominal 50%:")
    print("  on a partial sweep the floor is a noisy sample and can sit well above it.")
    print("  The claim is 'ranks above every constant', nothing weaker.")


def analyse_configs(gt: dict, dump: dict) -> None:
    """Per-merge-config dump from bo_merge_coeffs.py --utas-dump (one target)."""
    target = str(dump["target"])
    any_cfg = next(iter(dump["configs"].values()))
    codes = [r["code"] for r in any_cfg]
    real = _real_vectors(gt, codes)
    truth = [float(r["truth"]) for r in any_cfg]
    n_opts = 5

    print(f"\n===== target {target} — configs vs constants and vs the wave "
          f"(n={len(real)} candidates) =====")
    print(f"  {'config':32} {'MAE(E)':>7} {'rank':>6} {'pct':>7}")
    for c in range(1, n_opts + 1):
        mae = _mean(abs(t - c) for t in truth)
        d = sorted(real, key=lambda q: _l1([float(c)] * len(codes), real[q]))
        r = d.index(target) + 1 if target in real else float("nan")
        pct = 100.0 * (1 - (r - 1) / len(d)) if target in real else float("nan")
        print(f"  {'constant(' + str(c) + ')':32} {mae:7.3f} {r:6.0f} {pct:6.1f}%")
    for label, rows in dump["configs"].items():
        sv = [float(r["expectation"]) for r in rows]
        mae = _mean(abs(r["truth"] - r["expectation"]) for r in rows)
        d = sorted(real, key=lambda q: _l1(sv, real[q]))
        r = d.index(target) + 1 if target in real else float("nan")
        pct = 100.0 * (1 - (r - 1) / len(d)) if target in real else float("nan")
        print(f"  {label:32} {mae:7.3f} {r:6.0f} {pct:6.1f}%")
    print("  A config can rank the target well with poor MAE; that is still evidence the")
    print("  merge carries information about who this politician is.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gt", required=True)
    ap.add_argument("--dump", nargs="+", required=True,
                    help="JSON from utas_population_eval.py and/or --utas-dump")
    args = ap.parse_args()

    with open(args.gt, encoding="utf-8") as f:
        gt = json.load(f)
    for path in args.dump:
        with open(path, encoding="utf-8") as f:
            dump = json.load(f)
        print(f"\n######## {path}  (model={dump.get('base_model')}, "
              f"scoring={dump.get('scoring')})")
        if "personas" in dump:
            analyse_population(gt, dump)
        elif "configs" in dump:
            analyse_configs(gt, dump)
        else:
            print("  unrecognised dump shape — expected 'personas' or 'configs'")


if __name__ == "__main__":
    main()
