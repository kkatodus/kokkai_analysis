#!/usr/bin/env python3
"""Recompute every number `main.tex` reports, from the committed artifacts.

The paper is written against this script's output, not against the run logs: the
runner rounds per-fold values to 3 dp when it prints them, while
`bo7b_picks_*/target_*.json` holds them at full precision (DECISIONS.md, "Quote
figures from `bo7b_picks_*/*.json`, not the logs"). Everything here is therefore
derived from the JSON dumps, with the two granularity logs the only exception —
that sweep has no dump.

Both anchor families are loaded side by side, because three of the paper's claims
are *differences between the arms* (`polis_<id>_sft_qwen7b` = SFT anchors, the
headline; `polis_<id>_qwen7b` = DPO anchors, the confound). Sparse fine-tuning
baselines join per fold: `sparse_target_baselines.py` and `bo_merge_coeffs.py`
call `fold_indices` with the same seed, so a row from `sft_n33.json` pairs with a
row from a picks file on the same target.

Stdlib only and CPU-only, like `nested_log_summary.py` and `utas_rank_metric.py`,
so it runs on a bare interpreter with no numpy.

    python paper_numbers.py                       # report + write the JSON
    python paper_numbers.py --json /tmp/nums.json
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import statistics as st
from itertools import combinations
from math import comb, lgamma, exp

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SPEC = os.path.join(REPO, "specs", "polis-low-resource-persona")
ART = os.path.join(SPEC, "artifacts")
GT_DIR = os.path.join(REPO, "data", "data", "polis", "utas_ground_truth")

# Speech-record counts for the three original targets. `targets_n30.json` carries
# them for the 30 expansion targets; these three predate that file and are the
# line counts of their `all_speeches.jsonl`, the same quantity.
ORIGINALS = {"1279": ("高市早苗", 7666, "自民"),
             "2053": ("赤嶺政賢", 8324, "共産"),
             "2289": ("枝野幸男", 9139, "立憲")}

# Anchor identity. The four are fixed for every run in the study.
ANCHORS = [("152", "岸田文雄", "Kishida", "自民", "LDP"),
           ("2377", "塩川鉄也", "Shiokawa", "共産", "JCP"),
           ("3631", "福島みずほ", "Fukushima", "社民", "SDP"),
           ("5520", "上田清司", "Ueda", "民主", "DPJ")]

# Party-family folding, copied verbatim from `anchor_affinity.py` so this script
# and the committed run agree. **Order matters**: a target's recorded party is a
# parliamentary group name, and "自由民主党・無所属の会" contains "民主" as a
# substring, so the LDP keys must be tested before the DPJ/CDP ones or every LDP
# target folds into the wrong family. Only the four families holding an anchor can
# match at all.
FAMILY = [("自民", "自民"), ("自由民主", "自民"), ("共産", "共産"), ("公明", "公明"),
          ("維新", "維新"), ("社民", "社民"), ("立憲", "民主"), ("民主", "民主"),
          ("国民民主", "民主")]


def family(party: str) -> str:
    for key, fam in FAMILY:
        if key in (party or ""):
            return fam
    return party or "?"

BAND_ORDER = ["original", "3000-+", "1000-3000", "500-1000", "250-500", "120-250", "60-120"]
CONFIG_ORDER = ["base", "uniform", "ICL", "best-single", "DPO", "SFT",
                "BO", "best-single+ICL", "DPO+ICL", "SFT+ICL", "BO+ICL"]


# ---------------------------------------------------------------- statistics


def paired(worse: list[float], better: list[float]) -> list[float]:
    """Per-fold improvement of `better` over `worse`; positive means better wins."""
    return [w - b for w, b in zip(worse, better)]


def sign_p(wins: int, n: int) -> float:
    """Two-sided exact binomial test at p=0.5.

    Each *target* is one observation. Folds are slices of one politician's speech
    and are not independent, so the fold-level count is reported as a descriptive
    consistency figure only, never as the n of a test.
    """
    k = min(wins, n - wins)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)


def t_ci95(xs: list[float]) -> tuple[float, float]:
    """Mean and half-width of a 95% CI, normal approximation at n=33."""
    m = st.mean(xs)
    if len(xs) < 2:
        return m, 0.0
    return m, 1.96 * st.stdev(xs) / len(xs) ** 0.5


def fisher_exact_2x2(a: int, b: int, c: int, d: int) -> float:
    """Two-sided Fisher exact on [[a,b],[c,d]], by summing tables at most as likely."""
    def logp(x: int) -> float:
        y, z, w = a + b - x, a + c - x, d - a + x
        if min(y, z, w) < 0:
            return float("-inf")
        n = a + b + c + d
        return (lgamma(a + b + 1) + lgamma(c + d + 1) + lgamma(a + c + 1)
                + lgamma(b + d + 1) - lgamma(n + 1)
                - lgamma(x + 1) - lgamma(y + 1) - lgamma(z + 1) - lgamma(w + 1))
    obs = logp(a)
    lo, hi = max(0, a - d), min(a + b, a + c)
    return min(1.0, sum(exp(logp(x)) for x in range(lo, hi + 1) if logp(x) <= obs + 1e-9))


def permutation_null(best: list[str], families: list[str], anchor_family: dict,
                     iters: int = 200_000, seed: int = 20260804) -> tuple[float, float, dict]:
    """Expected matches and one-tailed p under a marginal-preserving permutation.

    Both marginals are held fixed — which anchors win how often, and which parties
    the targets are — because a big-tent family holding a popular anchor would match
    by construction under a naive 1/4 chance model.
    """
    import random
    rng = random.Random(seed)
    obs = sum(1 for b, f in zip(best, families) if anchor_family.get(b) == f)
    pool = list(best)
    hits, tot = 0, 0
    hist: dict[int, int] = {}
    for _ in range(iters):
        rng.shuffle(pool)
        m = sum(1 for b, f in zip(pool, families) if anchor_family.get(b) == f)
        tot += m
        hits += m >= obs
        hist[m] = hist.get(m, 0) + 1
    return tot / iters, hits / iters, {k: v / iters for k, v in sorted(hist.items())}


# ---------------------------------------------------------------- loading


def speech_count(pid: str) -> int | None:
    """Speech records for one politician, or None if the corpus is not mounted.

    Datasets live on an external volume, so every caller has to tolerate its
    absence: the prominence gradient is simply omitted rather than crashing a run
    on a pod.
    """
    path = os.path.join(REPO, "data", "data", "repr_speeches_id_organized", str(pid),
                        "all_speeches.jsonl")
    if not os.path.exists(path):
        return None
    with open(path, "rb") as fh:
        return sum(1 for _ in fh)


def load_meta() -> dict:
    """person_id -> {name, speeches, band, party, family}."""
    meta = {}
    with open(os.path.join(SPEC, "targets_n30.json"), encoding="utf-8") as fh:
        for t in json.load(fh)["targets"]:
            meta[str(t["person_id"])] = {"name": t["name"], "speeches": t["speeches"],
                                         "band": t["band"], "party": t["party"]}
    for pid, (name, n, party) in ORIGINALS.items():
        meta[pid] = {"name": name, "speeches": n, "band": "original", "party": party}
    for m in meta.values():
        m["family"] = family(m["party"])
    return meta


def load_arm(picks_dir: str, sparse: list[str]) -> dict:
    """{pid: {config: [per-fold NLL]}} from a picks dir plus sparse-baseline JSONs."""
    rows: dict[str, dict[str, list[float]]] = {}
    for path in sorted(glob.glob(os.path.join(ART, picks_dir, "target_*.json"))):
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        rows[str(d["target"])] = dict(d["rows"])
        rows[str(d["target"])]["_picks"] = d["best_single_picks"]
        rows[str(d["target"])]["_coeffs"] = d["bo_coeffs"]
    for name in sparse:
        with open(os.path.join(ART, name), encoding="utf-8") as fh:
            d = json.load(fh)
        tag = d["objective"].upper()
        for r in d["results"]:
            pid = str(r["target"])
            if pid not in rows or len(r["per_fold"]) != len(rows[pid]["BO"]):
                continue
            rows[pid][tag] = r["per_fold"]
            if "per_fold_icl" in r:
                rows[pid][f"{tag}+ICL"] = r["per_fold_icl"]
    return rows


def parse_granularity(path: str) -> list[dict]:
    """The `[global … BO=… base=… uniform=… best-single=…]` lines of one sweep log."""
    pat = re.compile(r"^\[(\S+)\s+n_groups=\s*(\d+) dims=\s*(\d+) sampler=(\w+)\]\s+"
                     r"BO=([\d.]+)±([\d.]+)\s+base=([\d.]+)\s+uniform=([\d.]+)\s+"
                     r"best-single=([\d.]+)")
    out = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            m = pat.match(line.strip())
            if m:
                out.append({"granularity": m.group(1), "n_groups": int(m.group(2)),
                            "dims": int(m.group(3)), "sampler": m.group(4),
                            "bo": float(m.group(5)), "sd": float(m.group(6)),
                            "base": float(m.group(7)), "uniform": float(m.group(8)),
                            "best_single": float(m.group(9))})
    return out


# ---------------------------------------------------------------- analyses


COMPARISONS = [
    ("BO vs base", "base", "BO"),
    ("BO vs uniform", "uniform", "BO"),
    ("BO vs best-single", "best-single", "BO"),
    ("BO vs ICL", "ICL", "BO"),
    ("BO vs SFT", "SFT", "BO"),
    ("BO vs DPO", "DPO", "BO"),
    ("BO+ICL vs ICL", "ICL", "BO+ICL"),
    ("BO+ICL vs BO", "BO", "BO+ICL"),
    ("BO+ICL vs best-single+ICL", "best-single+ICL", "BO+ICL"),
    ("BO+ICL vs SFT+ICL", "SFT+ICL", "BO+ICL"),
    ("best-single+ICL vs ICL", "ICL", "best-single+ICL"),
    ("SFT vs best-single", "best-single", "SFT"),
    ("SFT+ICL vs BO", "BO", "SFT+ICL"),
]


def nll_table(rows: dict) -> dict:
    """Mean held-out NLL per config, pooled over targets."""
    out = {}
    for c in CONFIG_ORDER:
        vals = [st.mean(r[c]) for r in rows.values() if c in r]
        if len(vals) == len(rows):
            out[c] = {"mean": st.mean(vals), "sd": st.pstdev(vals), "n": len(vals)}
    return out


def comparison_table(rows: dict) -> dict:
    out = {}
    n_folds = sum(len(r["BO"]) for r in rows.values())
    for label, worse, better in COMPARISONS:
        if not all(worse in r and better in r for r in rows.values()):
            continue
        per_target = {pid: st.mean(paired(r[worse], r[better])) for pid, r in rows.items()}
        ds = list(per_target.values())
        wins = sum(1 for d in ds if d > 0)
        fold_wins = sum(1 for r in rows.values()
                        for d in paired(r[worse], r[better]) if d > 0)
        mean, hw = t_ci95(ds)
        out[label] = {"mean": mean, "ci95": hw, "median": st.median(ds),
                      "sd": st.pstdev(ds), "wins": wins, "n": len(ds),
                      "p": sign_p(wins, len(ds)),
                      "fold_wins": fold_wins, "folds": n_folds,
                      "per_target": per_target}
    return out


def band_table(rows: dict, meta: dict) -> dict:
    keys = [("BO vs best-single", "best-single", "BO"), ("BO vs ICL", "ICL", "BO"),
            ("BO+ICL vs ICL", "ICL", "BO+ICL"), ("BO vs SFT", "SFT", "BO")]
    bands: dict[str, list[str]] = {}
    for pid in rows:
        bands.setdefault(meta[pid]["band"], []).append(pid)
    out = {}
    for band in BAND_ORDER:
        pids = bands.get(band, [])
        if not pids:
            continue
        rec = {"n": len(pids),
               "median_speeches": st.median(meta[p]["speeches"] for p in pids)}
        for label, worse, better in keys:
            rec[label] = st.mean(st.mean(paired(rows[p][worse], rows[p][better]))
                                 for p in pids)
        out[band] = rec
    return out


def register_decomposition(affinity: dict) -> dict:
    """Anchor-independent (register) vs anchor-dependent share of one adapter's gain.

    `gap` is base minus the *best* anchor's NLL; `spread` is the range across the
    four anchors. spread/gap is the fraction of the benefit that depends on *which*
    politician the adapter was trained on; 1 - that is register.
    """
    per = {}
    for pid, r in affinity["results"].items():
        base = st.mean(r["base"])
        means = {a: st.mean(v) for a, v in r["anchors"].items()}
        best = min(means.values())
        gap, spread = base - best, max(means.values()) - min(means.values())
        per[pid] = {"name": r["name"], "party": r["party"], "base": base,
                    "anchor_nll": means, "best": r["best"], "gap": gap,
                    "spread": spread, "share": spread / gap if gap else float("nan")}
    shares = [v["share"] for v in per.values()]
    return {"per_target": per,
            "mean_gap": st.mean(v["gap"] for v in per.values()),
            "mean_spread": st.mean(v["spread"] for v in per.values()),
            "share_of_means": (st.mean(v["spread"] for v in per.values())
                               / st.mean(v["gap"] for v in per.values())),
            "median_share": st.median(shares), "mean_share": st.mean(shares)}


def affinity_test(affinity: dict, arm: str) -> dict:
    """Does the preferred anchor track the target's party family?"""
    anchor_family = {a: family(fam) for a, fam in affinity["anchor_party"].items()}
    best, fams, detail = [], [], []
    for pid, r in affinity["results"].items():
        fam = family(r["party"])
        if fam not in set(anchor_family.values()):
            continue
        best.append(r["best"])
        fams.append(fam)
        detail.append({"pid": pid, "name": r["name"], "family": fam, "best": r["best"],
                       "match": anchor_family[r["best"]] == fam})
    matches = sum(d["match"] for d in detail)
    null_mean, p, null_hist = permutation_null(best, fams, anchor_family)
    by_family: dict[str, dict] = {}
    for d in detail:
        f = by_family.setdefault(d["family"], {"n": 0, "matched": 0, "picks": {}})
        f["n"] += 1
        f["matched"] += d["match"]
        f["picks"][d["best"]] = f["picks"].get(d["best"], 0) + 1
    return {"arm": arm, "n": len(detail), "matches": matches, "null_mean": null_mean,
            "p": p, "null_hist": null_hist, "by_family": by_family, "detail": detail,
            "counts": {a: best.count(a) for a in sorted(set(best))}}


def best_single_pick_match(rows: dict, meta: dict) -> dict:
    """The same question under a second, independent selection rule.

    `best-single` inside nested CV is chosen on prefix-free dev NLL, not on the
    coefficient-1.0 sweep `anchor_affinity.py` uses, so it is a separate
    measurement. A target counts as matched if its modal pick over the 5 folds is
    an anchor from its own family.
    """
    anchor_family = {aid: family(jp) for aid, _, _, jp, _ in ANCHORS}
    detail = []
    for pid, r in rows.items():
        fam = meta[pid]["family"]
        if fam not in set(anchor_family.values()):
            continue
        picks = [re.match(r"(\d+)", p).group(1) for p in r["_picks"]]
        modal = st.mode(picks)
        detail.append({"pid": pid, "name": meta[pid]["name"], "family": fam,
                       "modal": modal, "match": anchor_family[modal] == fam,
                       "fold_matches": sum(anchor_family[p] == fam for p in picks)})
    by_family: dict[str, dict] = {}
    for d in detail:
        f = by_family.setdefault(d["family"], {"n": 0, "matched": 0})
        f["n"] += 1
        f["matched"] += d["match"]
    return {"n": len(detail), "matches": sum(d["match"] for d in detail),
            "by_family": by_family, "detail": detail}


def coefficient_summary(rows: dict) -> dict:
    """Mean fitted BO coefficient per anchor, over folds x depth groups."""
    out = {}
    for i, (aid, jp, en, party, en_party) in enumerate(ANCHORS):
        vals, zeros = [], 0
        for r in rows.values():
            for fold in r["_coeffs"]:
                for g in fold[i]:
                    vals.append(g)
                    zeros += g < 0.05
        out[aid] = {"name": jp, "en": en, "party": en_party, "mean": st.mean(vals),
                    "sd": st.pstdev(vals), "near_zero": zeros / len(vals),
                    "by_group": [st.mean(fold[i][g] for r in rows.values()
                                         for fold in r["_coeffs"])
                                 for g in range(len(next(iter(rows.values()))["_coeffs"][0][i]))]}
    return out


def constant_rank_floor(gt: dict, codes: list[str]) -> float:
    """The measured rank-percentile floor of a name-independent predictor.

    A constant vector induces *one* fixed distance ordering over the candidates, so
    as the persona ranges over the whole wave its rank takes every value exactly
    once and the median percentile is 50% by construction. That is the number to
    compare against — not a nominal 50% assumed, and not the per-target median of a
    handful of constants, which is a noisy sample of the same ordering.
    """
    real = {}
    for pid, a in gt["answers"].items():
        v = [a["coded"].get(c) for c in codes]
        if all(x is not None for x in v):
            real[pid] = [float(x) for x in v]
    floors = []
    for c in range(1, 6):
        sv = [float(c)] * len(codes)
        order = sorted(real, key=lambda q: sum(abs(x - y) for x, y in zip(sv, real[q])))
        floors.append(st.median(100.0 * (1 - i / len(order)) for i in range(len(order))))
    return st.median(floors)


def utas_ranks(vectors_dir: str, gt: dict) -> dict:
    """Rank percentile of each target among the 594-member wave, per config.

    Only the ordering is scored, so this survives everyone clustering near the
    scale midpoint — the regime that sank absolute MAE. The null is the *measured*
    constant rows, not a nominal 50%.
    """
    real = {}
    per_target = {}
    for path in sorted(glob.glob(os.path.join(ART, vectors_dir, "*_numeric.json"))):
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        target = str(d["target"])
        any_cfg = next(iter(d["configs"].values()))
        codes = [r["code"] for r in any_cfg]
        if not real:
            for pid, a in gt["answers"].items():
                v = [a["coded"].get(c) for c in codes]
                if all(x is not None for x in v):
                    real[pid] = [float(x) for x in v]
        if target not in real:
            continue
        truth = [float(r["truth"]) for r in any_cfg]

        def rank_pct(sv: list[float]) -> float:
            order = sorted(real, key=lambda q: sum(abs(x - y) for x, y in
                                                   zip(sv, real[q])) / len(sv))
            return 100.0 * (1 - order.index(target) / len(order))

        rec = {"configs": {}, "mae": {}}
        for label, r in d["configs"].items():
            key = "best-single" if label.startswith("best-single") else label
            sv = [float(x["expectation"]) for x in r]
            rec["configs"][key] = rank_pct(sv)
            rec["mae"][key] = st.mean(abs(x["truth"] - x["expectation"]) for x in r)
        consts = {c: rank_pct([float(c)] * len(codes)) for c in range(1, 6)}
        best_c = max(consts, key=lambda c: consts[c])
        rec["constants"] = consts
        rec["best_constant"] = {"value": best_c, "pct": consts[best_c],
                               "mae": min(st.mean(abs(t - c) for t in truth)
                                          for c in range(1, 6))}
        per_target[target] = rec

    labels = sorted({k for r in per_target.values() for k in r["configs"]})
    summary = {}
    floor = constant_rank_floor(gt, codes)
    for lab in labels:
        pcts = [r["configs"][lab] for r in per_target.values() if lab in r["configs"]]
        summary[lab] = {"median": st.median(pcts), "mean": st.mean(pcts),
                        "above_floor": sum(1 for p in pcts if p > floor),
                        "n": len(pcts),
                        "mae": st.mean(r["mae"][lab] for r in per_target.values())}
    bo_vs_base = [r["configs"]["BO"] - r["configs"]["base"] for r in per_target.values()]
    bo_vs_const = [r["configs"]["BO"] - r["best_constant"]["pct"]
                   for r in per_target.values()]
    return {"per_target": per_target, "summary": summary, "constant_floor": floor,
            "bo_vs_best_constant": {
                "mean": st.mean(bo_vs_const),
                "wins": sum(1 for d in bo_vs_const if d > 0),
                "n": len(bo_vs_const)},
            "n_candidates": len(real),
            "best_constant": {
                "median": st.median(r["best_constant"]["pct"] for r in per_target.values()),
                "mean": st.mean(r["best_constant"]["pct"] for r in per_target.values()),
                "mae": st.mean(r["best_constant"]["mae"] for r in per_target.values())},
            "bo_vs_base": {"mean": st.mean(bo_vs_base),
                           "wins": sum(1 for d in bo_vs_base if d > 0),
                           "n": len(bo_vs_base),
                           "p": sign_p(sum(1 for d in bo_vs_base if d > 0),
                                       len(bo_vs_base))}}


def population_sweep(gt: dict) -> dict:
    """Name-swap divergence over the 594-persona base-model sweep."""
    with open(os.path.join(ART, "utas_population_7b_base.json"), encoding="utf-8") as fh:
        d = json.load(fh)
    codes = d["item_codes"]
    real = {}
    for pid, a in gt["answers"].items():
        v = [a["coded"].get(c) for c in codes]
        if all(x is not None for x in v):
            real[pid] = [float(x) for x in v]
    sims = {pid: p["expectation"] for pid, p in d["personas"].items()}

    def spread(vs: list[list[float]], cap: int = 300, seed: int = 0) -> float:
        import random
        vs = list(vs)
        if len(vs) > cap:
            random.Random(seed).shuffle(vs)
            vs = vs[:cap]
        pairs = list(combinations(range(len(vs)), 2))
        return st.mean(sum(abs(a - b) for a, b in zip(vs[i], vs[j])) / len(vs[i])
                       for i, j in pairs)

    real_sd = [st.pstdev([v[i] for v in real.values()]) for i in range(len(codes))]
    sim_sd = [st.pstdev([v[i] for v in sims.values()]) for i in range(len(codes))]
    rs, ss = spread(list(real.values())), spread(list(sims.values()))

    # Rank of each persona's own politician, and the same broken out by how much
    # speech the model could plausibly have seen. The gradient is what separates
    # "elicitation is broken" from "the model does not know this backbencher".
    pcts, top1 = {}, 0
    for pid, sv in sims.items():
        if pid not in real:
            continue
        order = sorted(real, key=lambda q: sum(abs(x - y) for x, y in zip(sv, real[q])))
        pcts[pid] = 100.0 * (1 - order.index(pid) / len(order))
        top1 += order[0] == pid
    counted = {p: n for p, n in ((p, speech_count(p)) for p in pcts) if n}
    quintiles = []
    if len(counted) > 100:
        ranked = sorted(counted, key=lambda p: -counted[p])
        step = len(ranked) // 5
        for q in range(5):
            grp = ranked[q * step:(q + 1) * step if q < 4 else len(ranked)]
            quintiles.append({"quintile": q + 1, "n": len(grp),
                              "median_speeches": st.median(counted[p] for p in grp),
                              "median_pct": st.median(pcts[p] for p in grp)})
    return {"n_personas": len(sims), "n_candidates": len(real),
            "real_spread": rs, "sim_spread": ss, "ratio": ss / rs,
            "real_mean": st.mean(x for v in real.values() for x in v),
            "sim_mean": st.mean(x for v in sims.values() for x in v),
            "median_real_item_sd": st.median(real_sd),
            "median_sim_item_sd": st.median(sim_sd),
            "inert_items": sum(1 for s in sim_sd if s < 0.05), "n_items": len(codes),
            "median_pct": st.median(pcts.values()), "top1": top1 / len(pcts),
            "n_with_speeches": len(counted), "quintiles": quintiles}


# ---------------------------------------------------------------- report


def fmt(x: float, nd: int = 4) -> str:
    return f"{x:+.{nd}f}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default=os.path.join(ART, "paper_numbers.json"))
    ap.add_argument("--skip-utas", action="store_true",
                    help="skip the rank metric (needs the UTAS ground truth on disk)")
    args = ap.parse_args()

    meta = load_meta()
    sft = load_arm("bo7b_picks_sft33", ["sft_n33.json", "dpo_n33.json"])
    dpo = load_arm("bo7b_picks", ["sft_n33.json", "dpo_n33.json"])
    print(f"loaded {len(sft)} targets (SFT anchors) and {len(dpo)} (DPO anchors)")

    out: dict = {"n_targets": len(sft), "meta": meta}
    out["nll"] = {"sft": nll_table(sft), "dpo": nll_table(dpo)}
    out["comparisons"] = {"sft": comparison_table(sft), "dpo": comparison_table(dpo)}
    out["bands"] = band_table(sft, meta)
    out["coeffs"] = {"sft": coefficient_summary(sft), "dpo": coefficient_summary(dpo)}
    out["pick_match"] = {"sft": best_single_pick_match(sft, meta),
                         "dpo": best_single_pick_match(dpo, meta)}

    with open(os.path.join(ART, "affinity_sft.json"), encoding="utf-8") as fh:
        aff_sft = json.load(fh)
    with open(os.path.join(ART, "affinity.json"), encoding="utf-8") as fh:
        aff_dpo = json.load(fh)
    out["register"] = {"sft": register_decomposition(aff_sft),
                       "dpo": register_decomposition(aff_dpo)}
    out["affinity"] = {"sft": affinity_test(aff_sft, "sft"),
                       "dpo": affinity_test(aff_dpo, "dpo")}
    a, b = out["affinity"]["sft"]["matches"], out["affinity"]["sft"]["n"]
    c, d = out["affinity"]["dpo"]["matches"], out["affinity"]["dpo"]["n"]
    out["affinity"]["fisher_p"] = fisher_exact_2x2(a, b - a, c, d - c)

    out["granularity"] = {
        "sft_7b": {pid: parse_granularity(os.path.join(ART, "bo7b_gpu_logs",
                                                       f"gran_sft_{pid}.log"))
                   for pid in ("1279", "2053", "2289")},
        "dpo_7b": {"1279": parse_granularity(os.path.join(ART, "bo7b_gpu_logs",
                                                          "granularity_1279.log"))},
        "dev_05b": {"1279": parse_granularity(os.path.join(ART, "nested_cv_05b",
                                                           "granularity_1279.log")),
                    "1279_60": parse_granularity(os.path.join(ART, "nested_cv_05b",
                                                              "granularity_1279_matched60.log"))},
    }

    if not args.skip_utas:
        with open(os.path.join(GT_DIR, "2024HoR.json"), encoding="utf-8") as fh:
            gt = json.load(fh)
        out["utas"] = {"sft": utas_ranks("utas_vectors_sft", gt),
                       "population": population_sweep(gt)}

    # ------------------------------------------------------------- print
    print("\n=== mean held-out NLL over the 33 targets (nested 5-fold CV) ===")
    print(f"  {'config':20} {'SFT anchors':>12} {'DPO anchors':>12} {'delta':>9}")
    for c in CONFIG_ORDER:
        s, dd = out["nll"]["sft"].get(c), out["nll"]["dpo"].get(c)
        if not s:
            continue
        dl = f"{dd['mean'] - s['mean']:+9.4f}" if dd else " " * 9
        print(f"  {c:20} {s['mean']:12.4f} {dd['mean'] if dd else float('nan'):12.4f} {dl}")

    print("\n=== paired comparisons, SFT anchors (each target = 1 observation) ===")
    print(f"  {'comparison':28} {'mean':>9} {'median':>9} {'wins':>7} {'sign p':>9} {'folds':>9}")
    for label, rec in out["comparisons"]["sft"].items():
        print(f"  {label:28} {fmt(rec['mean']):>9} {fmt(rec['median']):>9} "
              f"{rec['wins']:>3}/{rec['n']:<3} {rec['p']:9.1e} "
              f"{rec['fold_wins']:>4}/{rec['folds']}")

    print("\n=== by prominence band ===")
    print(f"  {'band':12} {'n':>3} {'med.sp':>8} {'BOvsB1':>9} {'BOvsICL':>9} "
          f"{'B+IvsICL':>9} {'BOvsSFT':>9}")
    for band, rec in out["bands"].items():
        print(f"  {band:12} {rec['n']:>3} {rec['median_speeches']:>8.0f} "
              f"{fmt(rec['BO vs best-single']):>9} {fmt(rec['BO vs ICL']):>9} "
              f"{fmt(rec['BO+ICL vs ICL']):>9} {fmt(rec['BO vs SFT']):>9}")

    print("\n=== register decomposition (each anchor applied alone at coeff 1.0) ===")
    for arm in ("sft", "dpo"):
        r = out["register"][arm]
        print(f"  {arm.upper():4} mean gap from base {r['mean_gap']:.4f}  "
              f"mean spread {r['mean_spread']:.4f}  "
              f"anchor-dependent share: {100 * r['share_of_means']:.0f}% of means, "
              f"median {100 * r['median_share']:.0f}%")

    print("\n=== anchor preference vs party ===")
    for arm in ("sft", "dpo"):
        r = out["affinity"][arm]
        print(f"  {arm.upper():4} {r['matches']}/{r['n']} matched, permutation null "
              f"{r['null_mean']:.2f}, p={r['p']:.4f}")
        for fam, f in sorted(r["by_family"].items()):
            print(f"       {fam:6} {f['matched']}/{f['n']}  {f['picks']}")
    print(f"  SFT vs DPO, Fisher exact p={out['affinity']['fisher_p']:.2e}")

    print("\n=== best-single picks inside nested CV (second selection rule) ===")
    for arm in ("sft", "dpo"):
        r = out["pick_match"][arm]
        fam = "  ".join(f"{k} {v['matched']}/{v['n']}" for k, v in sorted(r["by_family"].items()))
        print(f"  {arm.upper():4} {r['matches']}/{r['n']} matched    {fam}")

    print("\n=== mean fitted BO coefficient per anchor ===")
    print(f"  {'anchor':16} {'SFT':>7} {'DPO':>7}   near-zero share SFT / DPO")
    for aid, jp, en, party, _ in ANCHORS:
        s, d = out["coeffs"]["sft"][aid], out["coeffs"]["dpo"][aid]
        print(f"  {aid + ' ' + jp:16} {s['mean']:7.3f} {d['mean']:7.3f}   "
              f"{s['near_zero']:.2f} / {d['near_zero']:.2f}")

    print("\n=== granularity at equal trial budget (7B, SFT anchors, 20 trials/fold) ===")
    for pid, recs in out["granularity"]["sft_7b"].items():
        g = {r["granularity"]: r for r in recs}
        print(f"  {pid} {meta[pid]['name']:8} global {g['global']['bo']:.4f}  "
              f"layer-group {g['layer-group']['bo']:.4f}  "
              f"global better by {g['layer-group']['bo'] - g['global']['bo']:+.4f}")

    if not args.skip_utas:
        u = out["utas"]["sft"]
        print(f"\n=== UTAS rank percentile among {u['n_candidates']} real candidates ===")
        print(f"  measured constant floor {u['constant_floor']:.1f}%")
        print(f"  {'config':14} {'median':>8} {'mean':>8} {'above floor':>12} {'MAE(E)':>8}")
        for lab in ["base", "uniform", "best-single", "BO"]:
            s = u["summary"][lab]
            print(f"  {lab:14} {s['median']:7.1f}% {s['mean']:7.1f}% "
                  f"{s['above_floor']:>7}/{s['n']:<4} {s['mae']:8.3f}")
        bc = u["best_constant"]
        print(f"  {'best constant':14} {bc['median']:7.1f}% {bc['mean']:7.1f}% "
              f"{'—':>12} {bc['mae']:8.3f}")
        bv, bc2 = u["bo_vs_base"], u["bo_vs_best_constant"]
        print(f"  BO vs base: {bv['mean']:+.1f} points, {bv['wins']}/{bv['n']}, "
              f"p={bv['p']:.2f}   BO vs best constant: {bc2['mean']:+.1f} points, "
              f"{bc2['wins']}/{bc2['n']}")
        p = out["utas"]["population"]
        print(f"  name-swap divergence {p['ratio']:.3f} "
              f"({p['sim_spread']:.3f} vs {p['real_spread']:.3f}); "
              f"simulated mean {p['sim_mean']:.3f} vs real {p['real_mean']:.3f}; "
              f"{p['inert_items']}/{p['n_items']} items with sd<0.05")
        print(f"  population sweep: median rank {p['median_pct']:.1f}%, "
              f"top-1 {p['top1']:.3f} ({p['n_personas']} personas)")
        for q in p["quintiles"]:
            print(f"    quintile {q['quintile']} (n={q['n']:>3}) median speeches "
                  f"{q['median_speeches']:>6.0f}  median rank {q['median_pct']:.1f}%")

    with open(args.json, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
