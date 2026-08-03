#!/usr/bin/env python3
"""Pool a directory of nested-CV logs into the table the paper needs.

`run_7b_bo_gpu.sh` writes one log per target and **appends** (`>>`), so a file can
hold a calibration run, an OOM-aborted attempt and the real result stacked in that
order. This reads the *last complete* result block in each file, which is the one that
matters, and says so per file with `--verbose`.

Handles both log shapes: the five-row (base/ICL/uniform/best-single/BO) format from
`P13` and the seven-row format that adds `best-single+ICL` / `BO+ICL` (`P15`). Combined
rows are reported only where present, so the same command reads either.

Stdlib only, like `utas_rank_metric.py` — this runs on the laptop, where the system
interpreter has no numpy, and on a bare pod python with nothing installed.

Paired deltas are recomputed from the logged per-fold values, which the runner prints
rounded to 3 dp, so they can disagree with the log's own `BO vs …` line in the 4th
decimal. Quote this script for pooled figures and the log for a single target.

    python nested_log_summary.py --logs ../../specs/polis-low-resource-persona/artifacts/bo7b_gpu_logs
    python nested_log_summary.py --logs <dir> --glob 'combined_target_*.log' --repetition
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import re
import statistics as st
from math import comb, log

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.join(HERE, "..", "..", "specs", "polis-low-resource-persona")

# "  best-single+ICL  2.1701 ± 0.0908   per-fold [2.085, ...]" -- the column width
# changed when the combined rows landed, so match on whitespace, not position.
ROW_RE = re.compile(r"^\s{2}(base|ICL|uniform|best-single|BO|best-single\+ICL|BO\+ICL)\s+"
                    r"([\d.]+) ± ([\d.]+)\s+per-fold \[([^\]]*)\]")
BANNER = "======== nested-CV held-out NLL"
ORDER = ["base", "ICL", "uniform", "best-single", "BO", "best-single+ICL", "BO+ICL"]
# "best-single" and "best-single+ICL" both truncate to "best-si" in a 7-char column.
SHORT = {"base": "base", "ICL": "ICL", "uniform": "unif", "best-single": "best1",
         "BO": "BO", "best-single+ICL": "b1+ICL", "BO+ICL": "BO+ICL"}


def parse_log(path: str) -> dict | None:
    """Last complete result block in one log, or None if it holds no finished run."""
    with open(path, encoding="utf-8", errors="replace") as fh:
        txt = fh.read()
    chosen = None
    for block in txt.split(BANNER)[1:]:
        rows = {}
        for line in block.splitlines():
            m = ROW_RE.match(line)
            if m:
                rows[m.group(1)] = [float(x) for x in m.group(4).split(",")]
        if {"base", "BO"} <= set(rows):          # a block without BO never finished
            chosen = rows
    return chosen


def paired(a: list[float], b: list[float]) -> tuple[float, float]:
    """mean and population sd of (a - b), the per-fold paired delta."""
    d = [x - y for x, y in zip(a, b)]
    return st.mean(d), (st.pstdev(d) if len(d) > 1 else 0.0)


def sign_p(wins: int, n: int) -> float:
    """Two-sided exact binomial test at p=0.5. Each target is one observation:
    per-fold values are slices of one person and are not independent."""
    k = min(wins, n - wins)
    return min(1.0, 2 * sum(comb(n, i) for i in range(k + 1)) / 2 ** n)


def pearson(xs: list[float], ys: list[float]) -> float:
    mx, my = st.mean(xs), st.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = (sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys)) ** 0.5
    return num / den if den else float("nan")


def self_similarity(pid: str, dpo_dir: str, budget: int) -> float | None:
    """Median nearest-neighbour similarity among a target's own utterances.

    The n=33 run found ICL's advantage tracks this (+0.79) far more than it tracks
    speech volume (+0.32): a politician who says nearly the same thing every time makes
    the demonstration block approach a lookup table, which no merge can compete with.
    """
    from difflib import SequenceMatcher
    path = os.path.join(dpo_dir, f"{pid}.jsonl")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as fh:
        ch = [json.loads(l)["chosen"] for l in fh][:budget]
    if len(ch) < 2:
        return None
    return st.median(max(SequenceMatcher(None, ch[i], ch[j]).ratio()
                         for j in range(len(ch)) if j != i) for i in range(len(ch)))


def load_meta() -> dict:
    """person_id -> name/speeches/band, for the prominence breakdown."""
    meta = {}
    spec = os.path.join(SPEC, "targets_n30.json")
    if os.path.exists(spec):
        with open(spec, encoding="utf-8") as fh:
            for t in json.load(fh)["targets"]:
                meta[str(t["person_id"])] = t
    for pid, nm in [("1279", "高市早苗"), ("2053", "赤嶺政賢"), ("2289", "枝野幸男")]:
        meta.setdefault(pid, {"person_id": int(pid), "name": nm,
                              "speeches": None, "band": "original"})
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--logs", required=True, help="directory of nested-CV logs")
    ap.add_argument("--glob", default="*target_*.log",
                    help="which logs to read (default: every per-target log)")
    ap.add_argument("--repetition", action="store_true",
                    help="also compute each target's utterance self-similarity and "
                         "correlate it with ICL's advantage; needs --dpo-dir")
    ap.add_argument("--dpo-dir", default=os.path.join(HERE, "..", "..", "data", "data",
                                                      "polis", "dpo_pairs_targets"))
    ap.add_argument("--budget", type=int, default=30)
    ap.add_argument("--baseline-json", action="append", default=[], metavar="FILE",
                    help="a sparse_target_baselines.py output (sft_n33.json, dpo_n33.json). "
                         "Its per-fold values pair with the logs' -- both call "
                         "fold_indices with the same seed -- so the rows join directly. "
                         "Repeatable.")
    ap.add_argument("--json", default=None, help="write the parsed values here")
    ap.add_argument("--verbose", action="store_true",
                    help="report how many result blocks each log held")
    args = ap.parse_args()

    meta = load_meta()
    targets = {}
    for path in sorted(glob.glob(os.path.join(args.logs, args.glob))):
        m = re.search(r"target_(\d+)\.log$", os.path.basename(path))
        if not m:
            continue
        rows = parse_log(path)
        if rows is None:
            print(f"  !! no finished block: {os.path.basename(path)}")
            continue
        pid = m.group(1)
        if pid in targets:
            # The artifacts dir holds several protocols side by side (single_, nested_,
            # dump_, n33_, combined_). Mixing them would pool numbers from different
            # runs under one heading, so refuse rather than pick by filename order.
            raise SystemExit(
                f"target {pid} matched twice: {targets[pid]['log']} and "
                f"{os.path.basename(path)}.\nNarrow --glob to one protocol, e.g. "
                f"--glob 'combined_target_*.log'")
        targets[pid] = {"rows": rows, "log": os.path.basename(path),
                        **meta.get(pid, {"name": pid, "speeches": None, "band": "?"})}
        if args.verbose:
            n = open(path, encoding="utf-8", errors="replace").read().count(BANNER)
            print(f"  {os.path.basename(path):34} {n} block(s), used the last")

    if not targets:
        raise SystemExit(f"no parsable logs matching {args.glob} in {args.logs}")

    # Fine-tuning baselines live in their own JSON because they run in a separate
    # process (PEFT renames the modules LayerGroupMerger holds references to). They
    # pair per fold rather than merely in aggregate: both sides call fold_indices with
    # the same seed, which is why it is shared code and not copied.
    extra_rows = []
    for path in args.baseline_json:
        with open(path, encoding="utf-8") as fh:
            d = json.load(fh)
        obj = d.get("objective", "SFT").upper()
        if d.get("dev_cap"):
            obj = f"{obj}@{d['dev_cap']}"
        n_joined = 0
        for r in d.get("results", []):
            pid = str(r.get("target"))
            if "per_fold" not in r or pid not in targets:
                continue
            if len(r["per_fold"]) != len(targets[pid]["rows"]["BO"]):
                print(f"  !! {obj} target {pid}: {len(r['per_fold'])} folds vs the log's "
                      f"{len(targets[pid]['rows']['BO'])}; skipped")
                continue
            targets[pid]["rows"][obj] = r["per_fold"]
            if "per_fold_icl" in r:
                targets[pid]["rows"][f"{obj}+ICL"] = r["per_fold_icl"]
            n_joined += 1
        extra_rows += [obj] + ([f"{obj}+ICL"] if any(f"{obj}+ICL" in t["rows"]
                                                     for t in targets.values()) else [])
        sel = d.get("grid") and "grid-selected (optimistic)" or "fixed hyperparameters"
        print(f"  joined {n_joined} targets from {os.path.basename(path)}  [{obj}, {sel}]")
    extra_rows = [r for r in extra_rows if all(r in t["rows"] for t in targets.values())]

    has_icl = all("ICL" in t["rows"] for t in targets.values())
    has_comb = all("BO+ICL" in t["rows"] for t in targets.values())
    print(f"\nparsed {len(targets)} targets  "
          f"(ICL rows: {'yes' if has_icl else 'no'}, combined rows: {'yes' if has_comb else 'no'})\n")

    # ---- per-target -------------------------------------------------------
    cols = [c for c in ORDER if all(c in t["rows"] for t in targets.values())] + extra_rows
    hdr = (f"{'id':>5} {'name':<10} {'sp':>5} {'band':>9} | "
           + " ".join(f"{SHORT.get(c, c)[:7]:>7}" for c in cols) + " | " + f"{'BOvsB1':>8}"
           + (f" {'BOvsICL':>8}" if has_icl else "")
           + (f" {'B+IvsICL':>8}" if has_comb else ""))
    print(hdr)
    print("-" * len(hdr))
    for pid in sorted(targets, key=lambda p: -(targets[p]["speeches"] or 10 ** 9)):
        t = targets[pid]
        r = t["rows"]
        line = (f"{pid:>5} {t['name']:<10} {str(t['speeches'] or '-'):>5} {t['band']:>9} | "
                + " ".join(f"{st.mean(r[c]):7.4f}" for c in cols) + " | "
                + f"{paired(r['best-single'], r['BO'])[0]:+8.4f}")
        if has_icl:
            line += f" {paired(r['ICL'], r['BO'])[0]:+8.4f}"
        if has_comb:
            line += f" {paired(r['ICL'], r['BO+ICL'])[0]:+8.4f}"
        print(line)

    # ---- pooled -----------------------------------------------------------
    comparisons = [("BO vs base", "base", "BO"), ("BO vs best-single", "best-single", "BO")]
    if has_icl:
        comparisons.append(("BO vs ICL", "ICL", "BO"))
    if has_comb:
        comparisons += [("BO+ICL vs ICL", "ICL", "BO+ICL"),
                        ("BO+ICL vs BO", "BO", "BO+ICL"),
                        ("best-single+ICL vs ICL", "ICL", "best-single+ICL")]
    # A fine-tuning row beating BO is the spec's baseline 3/4 beating the method, so
    # these are stated in the same direction as everything else: + means the SECOND
    # name wins, i.e. + means the baseline beat POLIS.
    for r in extra_rows:
        comparisons.append((f"{r} vs BO", "BO", r))
        if has_comb and not r.endswith("+ICL"):
            comparisons.append((f"{r} vs base", "base", r))
        if r.endswith("+ICL") and has_comb:
            comparisons.append((f"{r} vs BO+ICL", "BO+ICL", r))

    print("\n=== pooled (each target = 1 observation) ===")
    n = len(targets)
    out = {}
    for label, worse, better in comparisons:
        ds = [paired(t["rows"][worse], t["rows"][better])[0] for t in targets.values()]
        wins = sum(1 for d in ds if d > 0)
        out[label] = {"deltas": ds, "wins": wins, "n": n, "mean": st.mean(ds),
                      "median": st.median(ds), "p": sign_p(wins, n)}
        print(f"  {label:24} mean {st.mean(ds):+.4f}  median {st.median(ds):+.4f}  "
              f"sd {st.pstdev(ds):.4f}  better in {wins:2}/{n}  sign p={sign_p(wins, n):.2e}")

    folds = sum(len(t["rows"]["BO"]) for t in targets.values())
    for label, worse, better in comparisons:
        w = sum(1 for t in targets.values()
                for a, b in zip(t["rows"][worse], t["rows"][better]) if a > b)
        print(f"  {label:24} fold-level {w}/{folds}")

    # ---- by prominence band -----------------------------------------------
    bands: dict[str, list[str]] = {}
    for pid, t in targets.items():
        bands.setdefault(t["band"], []).append(pid)
    if len(bands) > 1:
        print("\n=== by prominence band ===")
        for b in sorted(bands, key=lambda b: -(targets[bands[b][0]]["speeches"] or 10 ** 9)):
            ps = bands[b]
            cells = []
            for label, worse, better in comparisons:
                ds = [paired(targets[p]["rows"][worse], targets[p]["rows"][better])[0] for p in ps]
                cells.append(f"{label} {st.mean(ds):+.4f}")
            print(f"  {b:>9} n={len(ps):2}  " + "   ".join(cells))

    # ---- repetition diagnostic --------------------------------------------
    if args.repetition and has_icl:
        print("\n=== repetition vs ICL's advantage ===")
        sims, gains, dicl, logsp = [], [], [], []
        for pid, t in sorted(targets.items()):
            s = self_similarity(pid, args.dpo_dir, args.budget)
            if s is None:
                continue
            r = t["rows"]
            t["self_similarity"] = s
            sims.append(s)
            gains.append(paired(r["base"], r["ICL"])[0])
            dicl.append(paired(r["ICL"], r["BO"])[0])
            logsp.append(log(t["speeches"]) if t["speeches"] else None)
        print(f"  corr(self-similarity, ICL gain over base) = {pearson(sims, gains):+.3f}")
        print(f"  corr(self-similarity, BO vs ICL)          = {pearson(sims, dicl):+.3f}")
        pairs = [(x, y) for x, y in zip(logsp, dicl) if x is not None]
        if pairs:
            print(f"  corr(log speeches, BO vs ICL)             = "
                  f"{pearson([x for x, _ in pairs], [y for _, y in pairs]):+.3f}")
        print("  most repetitive targets:")
        for pid in sorted((p for p in targets if "self_similarity" in targets[p]),
                          key=lambda p: -targets[p]["self_similarity"])[:5]:
            t = targets[pid]
            print(f"    {pid:>5} {t['name']:<10} self-sim {t['self_similarity']:.3f}  "
                  f"BO vs ICL {paired(t['rows']['ICL'], t['rows']['BO'])[0]:+.4f}")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump({"targets": {p: {k: v for k, v in t.items()} for p, t in targets.items()},
                       "pooled": out}, fh, ensure_ascii=False, indent=1)
        print(f"\nwrote {args.json}")


if __name__ == "__main__":
    main()
