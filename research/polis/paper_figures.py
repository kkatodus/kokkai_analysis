#!/usr/bin/env python3
"""Render the figures `main.tex` includes, from `paper_numbers.py`'s JSON.

Split from the analysis deliberately: `paper_numbers.py` is stdlib-only so it runs
on a pod or a bare laptop interpreter, while this needs matplotlib. Run that first.

    python paper_numbers.py
    research/.venv/bin/python paper_figures.py

Every figure is vector PDF at the paper's text width (6.5 in) so nothing is
rescaled by LaTeX. Colours come from a validated categorical palette; the first
three slots are the only ones used in any all-pairs-visible form (scatter, dot
plot), which is what that palette validates for.
"""
from __future__ import annotations

import argparse
import json
import os
import statistics as st

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ART = os.path.join(REPO, "specs", "polis-low-resource-persona", "artifacts")
OUT = os.path.join(REPO, "paper",
                   "parameter-optimization-for-low-resource-ideological-simulation",
                   "figures")

# Validated categorical palette, light mode. Slots are assigned in fixed order and
# never cycled; a series is a slot, not a rank, so filtering never repaints.
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
RED = "#e34948"                      # diverging pole / "worse", paired with BLUE
INK, INK2, MUTED = "#0b0b0b", "#52514e", "#8a8984"
GRID = "#dedcd6"
TEXTW = 6.5


def style() -> None:
    plt.rcParams.update({
        # IPAexGothic carries both Latin and CJK glyphs, so politician names render
        # without a per-text font override and without tofu boxes.
        "font.family": "sans-serif",
        "font.sans-serif": ["IPAexGothic", "DejaVu Sans"],
        "font.size": 8,
        "axes.titlesize": 8.5,
        "axes.labelsize": 8,
        "axes.edgecolor": MUTED,
        "axes.linewidth": 0.6,
        "axes.labelcolor": INK,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "xtick.color": INK2, "ytick.color": INK2,
        "xtick.labelsize": 7.5, "ytick.labelsize": 7.5,
        "xtick.major.width": 0.6, "ytick.major.width": 0.6,
        "legend.frameon": False,
        "legend.fontsize": 7.5,
        "grid.color": GRID, "grid.linewidth": 0.6,
        "figure.dpi": 200,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.02,
        "pdf.fonttype": 42,
    })


def save(fig, name: str) -> None:
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    fig.savefig(path)
    plt.close(fig)
    print(f"  wrote {os.path.relpath(path, REPO)}")


def hgrid(ax) -> None:
    ax.grid(axis="y", zorder=0)
    ax.set_axisbelow(True)


def vgrid(ax) -> None:
    ax.grid(axis="x", zorder=0)
    ax.set_axisbelow(True)


# --------------------------------------------------------------- figure 1


def fig_register(d: dict) -> None:
    """How much of one adapter's benefit depends on *which* politician trained it.

    Stacked rather than grouped: the claim is a decomposition of one quantity (the
    NLL gap a single anchor opens against the base model) into an anchor-independent
    part and an anchor-dependent part, and a stack is the form that reads as parts
    of a whole.
    """
    reg = d["register"]["sft"]["per_target"]
    order = sorted(reg, key=lambda p: -reg[p]["gap"])
    gaps = [reg[p]["gap"] for p in order]
    spreads = [reg[p]["spread"] for p in order]
    base_part = [g - s for g, s in zip(gaps, spreads)]

    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 2.7),
                                  gridspec_kw={"width_ratios": [2.6, 1]})
    x = range(len(order))
    # 2px surface gap between the stacked segments, per the mark spec.
    ax.bar(x, base_part, width=0.72, color=BLUE, linewidth=0.8, edgecolor="white",
           label="anchor-independent (register)", zorder=3)
    ax.bar(x, spreads, width=0.72, bottom=base_part, color=ORANGE, linewidth=0.8,
           edgecolor="white", label="anchor-dependent (identity)", zorder=3)
    hgrid(ax)
    ax.set_xticks([])
    ax.set_ylim(0, max(gaps) * 1.15)
    ax.set_xlim(-0.8, len(order) - 0.2)
    ax.set_xlabel(f"{len(order)} held-out targets, sorted by total gain")
    ax.set_ylabel("NLL gain over base (nats)")
    ax.set_title("A  One anchor, applied untuned at coefficient 1.0", loc="left")
    ax.legend(loc="upper right", handlelength=1.1)
    for pid, label in (("110", "田野瀬"), ("3022", "津島"), ("1543", "手塚")):
        if pid in order:
            i = order.index(pid)
            ax.annotate(label, (i, gaps[i]), xytext=(0, 3), textcoords="offset points",
                        ha="center", fontsize=6.5, color=INK2)

    arms = [("SFT anchors", d["register"]["sft"]), ("DPO anchors", d["register"]["dpo"])]
    ys = [0.6, 0.0]
    for y, (lab, r) in zip(ys, arms):
        indep = r["mean_gap"] - r["mean_spread"]
        ax2.barh(y, indep, height=0.36, color=BLUE, linewidth=0.8, edgecolor="white",
                 zorder=3)
        ax2.barh(y, r["mean_spread"], left=indep, height=0.36, color=ORANGE,
                 linewidth=0.8, edgecolor="white", zorder=3)
        ax2.annotate(f"{100 * r['share_of_means']:.0f}% identity",
                     (r["mean_gap"], y), xytext=(4, 0), textcoords="offset points",
                     va="center", fontsize=7, color=INK2)
    vgrid(ax2)
    ax2.set_yticks(ys)
    ax2.set_yticklabels([lab for lab, _ in arms])
    ax2.set_ylim(-0.4, 1.0)
    ax2.set_xlim(0, 0.30)
    ax2.set_xlabel("mean gain over base (nats)")
    ax2.set_title("B  Pooled, by anchor objective", loc="left")
    fig.tight_layout(w_pad=1.6)
    save(fig, "fig_register.pdf")


# --------------------------------------------------------------- figure 2


def fig_affinity(d: dict) -> None:
    """Does the preferred anchor track the target's party, and does the objective matter?

    Panel B plots the marginal-preserving permutation nulls themselves rather than a
    p-value, because the interesting quantity is that the two arms land on opposite
    sides of their nulls. Each arm gets its own curve: the permutation holds *that*
    arm's marginals fixed, so they are two different distributions.
    """
    fams = ["共産", "民主", "自民"]
    fam_en = {"共産": "JCP\n(3 targets)", "民主": "CDP/DPJ\n(13)", "自民": "LDP\n(12)"}
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 2.5),
                                  gridspec_kw={"width_ratios": [1, 1.25]})

    w = 0.36
    for i, (arm, colour) in enumerate((("sft", BLUE), ("dpo", ORANGE))):
        r = d["affinity"][arm]
        vals, labels = [], []
        for f in fams:
            rec = r["by_family"].get(f, {"n": 0, "matched": 0})
            vals.append(rec["matched"] / rec["n"] if rec["n"] else 0.0)
            labels.append(f"{rec['matched']}/{rec['n']}")
        xs = [j + (i - 0.5) * (w + 0.02) for j in range(len(fams))]
        ax.bar(xs, vals, width=w, color=colour, linewidth=0.8, edgecolor="white",
               zorder=3, label=f"{arm.upper()} anchors")
        for xx, v, lab in zip(xs, vals, labels):
            ax.annotate(lab, (xx, v), xytext=(0, 2.5), textcoords="offset points",
                        ha="center", fontsize=6.5, color=INK2)
    # The null goes in the legend rather than as an in-plot label: at 0.34 it runs
    # straight through the LDP bars, so no anchored text position is collision-free.
    chance = d["affinity"]["sft"]["null_mean"] / d["affinity"]["sft"]["n"]
    ax.axhline(chance, color=MUTED, linestyle=(0, (3, 2)), linewidth=0.8, zorder=2,
               label=f"permutation null ({chance:.2f})")
    hgrid(ax)
    ax.set_xticks(range(len(fams)))
    ax.set_xticklabels([fam_en[f] for f in fams])
    ax.set_ylim(0, 1.30)
    ax.set_ylabel("targets whose best anchor\nis from their own party")
    ax.set_title("A  By party family", loc="left")
    ax.legend(loc="upper right", handlelength=1.4)

    # Each arm gets its own null: the permutation holds that arm's marginals fixed,
    # so the two curves are different distributions and cannot share one grey band.
    for arm, colour in (("sft", BLUE), ("dpo", ORANGE)):
        r = d["affinity"][arm]
        hist = {int(k): v for k, v in r["null_hist"].items()}
        ks = sorted(hist)
        ax2.plot(ks, [hist[k] for k in ks], color=colour, linewidth=1.0, alpha=0.55,
                 zorder=3)
        ax2.fill_between(ks, [hist[k] for k in ks], color=colour, alpha=0.10, zorder=2)
        ax2.axvline(r["matches"], color=colour, linewidth=1.6, zorder=4,
                    label=f"{arm.upper()} observed {r['matches']}/{r['n']}, "
                          f"p={r['p']:.3f}")
    hgrid(ax2)
    ax2.set_ylim(0, None)
    ax2.set_xlabel("matches under a marginal-preserving permutation")
    ax2.set_ylabel("probability")
    ax2.set_title("B  Observed against each arm's own null", loc="left")
    ax2.legend(loc="upper right", handlelength=1.0)
    fig.tight_layout(w_pad=1.6)
    save(fig, "fig_affinity.pdf")


# --------------------------------------------------------------- figure 3


def fig_forest(d: dict) -> None:
    """Paired per-target deltas with 95% CIs — the main table as effect sizes.

    Sign convention: positive always means the first-named configuration wins, so a
    bar crossing zero is a null however the pair is ordered.
    """
    keys = ["BO vs base", "BO vs uniform", "BO vs best-single", "BO vs ICL",
            "BO vs SFT", "BO vs DPO", "BO+ICL vs ICL", "BO+ICL vs best-single+ICL",
            "BO+ICL vs SFT+ICL", "SFT vs best-single"]
    c = d["comparisons"]["sft"]
    keys = [k for k in keys if k in c]
    fig, ax = plt.subplots(figsize=(TEXTW, 3.1))
    ys = list(range(len(keys)))[::-1]
    for y, k in zip(ys, keys):
        r = c[k]
        sig = r["p"] < 0.05 and r["mean"] > 0
        col = BLUE if sig else MUTED
        ax.errorbar(r["mean"], y, xerr=r["ci95"], fmt="o", color=col, markersize=4.5,
                    elinewidth=1.4, capsize=2.5, capthick=1.0, zorder=4,
                    markeredgecolor="white", markeredgewidth=0.8)
        ax.annotate(f"{r['mean']:+.4f}   {r['wins']}/{r['n']}   p={r['p']:.1e}",
                    (0.995, y), xycoords=("axes fraction", "data"), ha="right",
                    va="center", fontsize=7, color=INK2)
    ax.axvline(0, color=INK2, linewidth=0.8, zorder=3)
    vgrid(ax)
    ax.set_yticks(ys)
    ax.set_yticklabels(keys)
    ax.set_ylim(-0.7, len(keys) - 0.3)
    ax.set_xlim(-0.02, 0.70)   # right third is the annotation column
    ax.set_xlabel("paired improvement in held-out NLL, nats "
                  "(mean over 33 targets, 95% CI)")
    fig.tight_layout()
    save(fig, "fig_forest.pdf")


# --------------------------------------------------------------- figure 4


def fig_prominence(d: dict) -> None:
    """Does the margin decay as the target gets data-poorer? The low-resource thesis.

    Three series, so the palette's first three slots — the set validated with every
    pair simultaneously visible, which a scatter is.
    """
    meta = d["meta"]
    series = [("BO vs best-single", BLUE, "o"), ("BO vs ICL", ORANGE, "s"),
              ("BO+ICL vs ICL", AQUA, "^")]
    c = d["comparisons"]["sft"]
    fig, ax = plt.subplots(figsize=(TEXTW, 3.0))
    for label, colour, marker in series:
        pts = sorted((meta[p]["speeches"], v) for p, v in c[label]["per_target"].items())
        ax.plot([x for x, _ in pts], [y for _, y in pts], marker, color=colour,
                markersize=4, alpha=0.55, markeredgecolor="white",
                markeredgewidth=0.5, linestyle="none", zorder=3)
        # Band medians as the trend, not a regression line: the sample was drawn in
        # log-spaced bands, so the bands are the design and a fit would imply more.
        bands: dict[str, list] = {}
        for p, v in c[label]["per_target"].items():
            bands.setdefault(meta[p]["band"], []).append((meta[p]["speeches"], v))
        bs = sorted((st.median(s for s, _ in vs), st.median(v for _, v in vs))
                    for vs in bands.values())
        ax.plot([x for x, _ in bs], [y for _, y in bs], color=colour, linewidth=1.4,
                marker=marker, markersize=5, markeredgecolor="white",
                markeredgewidth=0.8, label=label, zorder=4)
    ax.axhline(0, color=INK2, linewidth=0.8, zorder=2)
    ax.set_xscale("log")
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}"))
    hgrid(ax)
    ax.set_ylim(-0.24, 0.28)
    ax.set_xlabel("target's speech records (log scale) — the resource axis")
    ax.set_ylabel("paired improvement in held-out NLL (nats)")
    # Legend below the axes: every quadrant inside holds points at some band.
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.20), ncol=3,
              handlelength=1.6, columnspacing=2.0)
    ax.annotate("1543 手塚 — a boilerplate speaker,\nwhere 24 in-prompt examples\n"
                "approach a lookup table",
                xy=(166, c["BO vs ICL"]["per_target"]["1543"]), xytext=(330, -0.215),
                fontsize=6.5, color=INK2, va="bottom",
                arrowprops=dict(arrowstyle="-", color=MUTED, linewidth=0.7))
    fig.tight_layout()
    save(fig, "fig_prominence.pdf")


# --------------------------------------------------------------- figure 5


def fig_utas(d: dict) -> None:
    """The negative result: the merge does not move stated survey positions."""
    u = d["utas"]["sft"]
    labels = ["base", "uniform", "best-single", "BO"]
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 2.7),
                                  gridspec_kw={"width_ratios": [1.35, 1]})

    import random
    rng = random.Random(0)
    for i, lab in enumerate(labels + ["best constant"]):
        if lab == "best constant":
            vals = [r["best_constant"]["pct"] for r in u["per_target"].values()]
            colour = MUTED
        else:
            vals = [r["configs"][lab] for r in u["per_target"].values()]
            colour = BLUE if lab == "BO" else MUTED
        xs = [i + rng.uniform(-0.14, 0.14) for _ in vals]
        ax.plot(xs, vals, "o", color=colour, markersize=3.2, alpha=0.45,
                markeredgecolor="none", linestyle="none", zorder=3)
        m = st.median(vals)
        ax.plot([i - 0.28, i + 0.28], [m, m], color=INK if lab == "BO" else INK2,
                linewidth=1.8, zorder=4)
        ax.annotate(f"{m:.1f}%", (i, m), xytext=(0, 5), textcoords="offset points",
                    ha="center", fontsize=7, color=INK)
    floor = u["constant_floor"]
    ax.axhline(floor, color=RED, linestyle=(0, (3, 2)), linewidth=0.9, zorder=2)
    ax.annotate(f"measured floor {floor:.1f}%", (-0.45, floor), xytext=(0, -9),
                textcoords="offset points", ha="left", fontsize=6.5, color=RED)
    hgrid(ax)
    ax.set_xticks(range(5))
    ax.set_xticklabels(labels + ["best\nconstant"])
    ax.set_ylim(0, 105)
    ax.set_ylabel("rank percentile of the true politician\n"
                  f"among {u['n_candidates']} real candidates")
    ax.set_title("A  Per-target rank, 33 targets", loc="left")

    bx = [r["configs"]["base"] for r in u["per_target"].values()]
    by = [r["configs"]["BO"] for r in u["per_target"].values()]
    ax2.plot([0, 100], [0, 100], color=MUTED, linewidth=0.8, zorder=2)
    ax2.plot(bx, by, "o", color=BLUE, markersize=4, alpha=0.7,
             markeredgecolor="white", markeredgewidth=0.6, linestyle="none", zorder=4)
    ax2.axhline(floor, color=RED, linestyle=(0, (3, 2)), linewidth=0.8, zorder=2)
    ax2.axvline(floor, color=RED, linestyle=(0, (3, 2)), linewidth=0.8, zorder=2)
    bv = u["bo_vs_base"]
    ax2.annotate(f"BO better on {bv['wins']}/{bv['n']}\n{bv['mean']:+.1f} points, "
                 f"p={bv['p']:.2f}", (0.04, 0.96), xycoords="axes fraction",
                 va="top", fontsize=7, color=INK2)
    ax2.set_xlim(0, 100)
    ax2.set_ylim(0, 100)
    ax2.set_aspect("equal")
    ax2.grid(zorder=0)
    ax2.set_axisbelow(True)
    ax2.set_xlabel("base rank percentile")
    ax2.set_ylabel("BO rank percentile")
    ax2.set_title("B  Does the merge lift it?", loc="left")
    fig.tight_layout(w_pad=1.8)
    save(fig, "fig_utas.pdf")


# --------------------------------------------------------------- figure 6


def fig_granularity(d: dict) -> None:
    """Coefficient granularity: expressiveness against optimizability."""
    g = d["granularity"]
    meta = d["meta"]
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 2.5),
                                  gridspec_kw={"width_ratios": [1.15, 1]})

    # Dots, not bars with error bars. The sweep prints only the fold mean and an
    # *unpaired* fold spread (±0.07–0.19), which dwarfs the 0.008–0.026 difference
    # under study and would read as "no effect" when the real limitation is that the
    # sweep emits no per-fold values to pair. The spread is drawn thin behind the
    # markers and the caption says it is unpaired.
    pids = list(g["sft_7b"])
    for i, (gran, colour) in enumerate((("global", BLUE), ("layer-group", ORANGE))):
        vals, errs = [], []
        for pid in pids:
            rec = next(r for r in g["sft_7b"][pid] if r["granularity"] == gran)
            vals.append(rec["bo"])
            errs.append(rec["sd"])
        xs = [j + (i - 0.5) * 0.22 for j in range(len(pids))]
        dims = next(r["dims"] for r in g["sft_7b"][pids[0]] if r["granularity"] == gran)
        ax.errorbar(xs, vals, yerr=errs, fmt="o", color=colour, markersize=5.5,
                    markeredgecolor="white", markeredgewidth=0.8, elinewidth=0.8,
                    ecolor=colour, alpha=1.0, capsize=0, zorder=4,
                    label=f"{gran} ({dims} dims)")
    for j, pid in enumerate(pids):
        b1 = next(r["best_single"] for r in g["sft_7b"][pid])
        ax.plot([j - 0.36, j + 0.36], [b1, b1], color=INK, linewidth=1.0,
                linestyle=(0, (2, 1.5)), zorder=3)
    ax.annotate("best-single", (len(pids) - 1 + 0.36, b1), xytext=(-1, 3),
                textcoords="offset points", fontsize=6.5, color=INK, ha="right")
    hgrid(ax)
    ax.set_xticks(range(len(pids)))
    ax.set_xticklabels([f"{meta[p]['name']}" for p in pids])
    ax.set_xlim(-0.5, len(pids) - 0.5)
    ax.set_ylim(1.98, 2.60)   # the widest fold spread reaches 2.51; do not clip it
    ax.set_ylabel("held-out NLL (lower is better)")
    ax.set_title("A  7B, SFT anchors, 20 trials/fold", loc="left")
    ax.legend(loc="upper left", handlelength=1.1)

    for trials, colour, marker in ((20, BLUE, "o"), (60, ORANGE, "s")):
        src = g["dev_05b"]["1279" if trials == 20 else "1279_60"]
        pts = sorted((r["dims"], r["bo"]) for r in src)
        ax2.plot([x for x, _ in pts], [y for _, y in pts], marker=marker, color=colour,
                 linewidth=1.4, markersize=5, markeredgecolor="white",
                 markeredgewidth=0.8, label=f"{trials} trials/fold", zorder=4)
    base = g["dev_05b"]["1279"][0]["base"]
    ax2.axhline(base, color=RED, linestyle=(0, (3, 2)), linewidth=0.9, zorder=2)
    ax2.annotate("base (no merge)", (100, base), xytext=(0, 3),
                 textcoords="offset points", ha="right", fontsize=6.5, color=RED)
    ax2.set_xscale("log")
    ax2.set_xticks([4, 12, 96])
    ax2.set_xticklabels(["4\nglobal", "12\nlayer-group", "96\nfull layer-wise"])
    ax2.xaxis.set_minor_formatter(lambda *_: "")
    hgrid(ax2)
    ax2.set_xlabel("coefficient dimensions")
    ax2.set_ylabel("held-out NLL")
    ax2.set_title("B  0.5B, the full curve", loc="left")
    ax2.legend(loc="upper left", handlelength=1.6)
    fig.tight_layout(w_pad=1.8)
    save(fig, "fig_granularity.pdf")


# --------------------------------------------------------------- figure 7


def fig_coeffs(d: dict) -> None:
    """What the BO does with each anchor: how much, and at which depth."""
    coef = d["coeffs"]
    anchors = list(coef["sft"])
    names = [f"{coef['sft'][a]['name']}\n({coef['sft'][a]['party']})" for a in anchors]
    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 2.4),
                                  gridspec_kw={"width_ratios": [1.35, 1]})

    w = 0.36
    for i, (arm, colour) in enumerate((("sft", BLUE), ("dpo", ORANGE))):
        vals = [coef[arm][a]["mean"] for a in anchors]
        xs = [j + (i - 0.5) * (w + 0.02) for j in range(len(anchors))]
        ax.bar(xs, vals, width=w, color=colour, linewidth=0.8, edgecolor="white",
               zorder=3, label=f"{arm.upper()} anchors")
        for xx, v in zip(xs, vals):
            ax.annotate(f"{v:.3f}", (xx, v), xytext=(0, 2.5),
                        textcoords="offset points", ha="center", fontsize=6.5,
                        color=INK2)
    hgrid(ax)
    ax.set_xticks(range(len(anchors)))
    ax.set_xticklabels(names)
    ax.set_ylim(0, 0.46)
    ax.set_ylabel("mean fitted coefficient")
    ax.set_title("A  Pooled over folds and depth groups", loc="left")
    ax.legend(loc="upper right", handlelength=1.1)

    # A magnitude, so one hue light→dark rather than a categorical set; every cell
    # carries its value because the light tints sit below the text-free contrast floor.
    mat = [coef["sft"][a]["by_group"] for a in anchors]
    vmax = max(max(r) for r in mat)
    ax2.imshow(mat, cmap="Blues", vmin=0, vmax=vmax * 1.05, aspect="auto")
    for i, row in enumerate(mat):
        for g, v in enumerate(row):
            ax2.text(g, i, f"{v:.2f}", ha="center", va="center", fontsize=7,
                     color="white" if v > 0.62 * vmax else INK)
    ax2.set_xticks(range(3))
    ax2.set_xticklabels(["layers\n0–9", "10–19", "20–27"])
    ax2.set_yticks(range(len(anchors)))
    ax2.set_yticklabels([coef["sft"][a]["name"] for a in anchors])
    ax2.set_title("B  SFT anchors, by depth group", loc="left")
    for sp in ax2.spines.values():
        sp.set_visible(False)
    ax2.tick_params(length=0)
    fig.tight_layout(w_pad=1.6)
    save(fig, "fig_coeffs.pdf")


def fig_scale(d: dict) -> None:
    """Why every margin in the paper is small: what the methods actually compete over.

    A one-dimensional axis, not a latent-space cartoon — the quantity is a likelihood
    improvement, and a 2-D metaphor would invite the reader to infer directions the
    data does not contain. The left axis is the whole gain one untuned anchor buys;
    the right axis magnifies the part that depends on *which* anchor, which is the
    only region any method comparison in this paper happens inside.
    """
    reg = d["register"]["sft"]
    gap, spread = reg["mean_gap"], reg["mean_spread"]
    shared = gap - spread
    base = d["nll"]["sft"]["base"]["mean"]
    margin = d["comparisons"]["sft"]["BO vs best-single"]["mean"]

    fig, (ax, ax2) = plt.subplots(1, 2, figsize=(TEXTW, 1.95),
                                  gridspec_kw={"width_ratios": [1.5, 1]})

    ax.barh(0, shared, height=0.42, color=BLUE, linewidth=0.8, edgecolor="white",
            zorder=3, label="anchor-independent (Diet register)")
    ax.barh(0, spread, left=shared, height=0.42, color=ORANGE, linewidth=0.8,
            edgecolor="white", zorder=3, label="anchor-dependent (identity)")
    ax.annotate(f"{shared:.4f}\n{100 * shared / gap:.0f}%", (shared / 2, 0),
                ha="center", va="center", fontsize=7, color="white", zorder=4)
    ax.annotate(f"{spread:.4f}  ({100 * spread / gap:.0f}%)", (gap, 0.30),
                ha="right", va="bottom", fontsize=7, color=ORANGE, zorder=4)
    ax.set_yticks([])
    ax.set_xlim(0, gap * 1.02)
    ax.set_ylim(-0.55, 0.75)
    ax.set_xlabel("NLL gain of one untuned anchor over base (nats)")
    ax.annotate(f"base\n{base:.4f}", (0, -0.30), ha="left", va="top", fontsize=6.8,
                color=INK2)
    ax.annotate(f"best anchor\n{base - gap:.4f}", (gap, -0.30), ha="right", va="top",
                fontsize=6.8, color=INK2)
    ax.set_title("A  What one anchor adapter buys", loc="left")
    ax.legend(loc="upper left", handlelength=1.1, fontsize=6.8)
    vgrid(ax)

    # The zoom deliberately runs past the anchors' range: the tuned merge lands
    # *beyond* the best single anchor, so a window stopping there would leave nowhere
    # to draw the method's margin honestly.
    ax2.barh(0, spread, height=0.42, color=ORANGE, alpha=0.30, linewidth=0.8,
             edgecolor="white", zorder=3)
    ax2.barh(0, margin, left=spread, height=0.42, color=BLUE, linewidth=0.8,
             edgecolor="white", zorder=3)
    ax2.annotate("spread across\nthe 4 anchors", (spread / 2, 0), ha="center",
                 va="center", fontsize=6.8, color=INK2, zorder=4)
    ax2.annotate(f"POLIS\n+{margin:.4f}", (spread + margin / 2, 0), ha="center",
                 va="center", fontsize=6.8, color="white", zorder=4)
    ax2.axvline(spread, color=INK2, linewidth=0.8, zorder=4)
    ax2.annotate("best of the 4", (spread, 0.30), ha="center", va="bottom",
                 fontsize=6.8, color=INK2)
    ax2.set_yticks([])
    ax2.set_xlim(0, (spread + margin) * 1.04)
    ax2.set_ylim(-0.55, 0.75)
    ax2.set_xlabel("nats — note the axis is %.0f× panel A"
                   % (gap / (spread + margin)))
    ax2.set_title("B  Inside the identity window", loc="left")
    vgrid(ax2)
    fig.tight_layout(w_pad=1.8)
    save(fig, "fig_scale.pdf")


def fig_objective_geometry(d: dict) -> None:
    """Claim 3's mechanism: why a margin objective need not move toward the target.

    Schematic, and labelled as one, but each panel prints the measurement it is
    explaining so the sketch cannot drift from the data. SFT's gradient points at the
    politician's own distribution; DPO's is satisfied anywhere the real utterance
    outscores the caricature, and that half-space includes directions carrying no
    identity at all.
    """
    aff = d["affinity"]
    fig, axes = plt.subplots(1, 2, figsize=(TEXTW, 2.5))
    for k, (ax, arm) in enumerate(zip(axes, ("sft", "dpo"))):
        colour = BLUE if k == 0 else RED
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 7)
        ax.set_xticks([])
        ax.set_yticks([])
        for sp in ax.spines.values():
            sp.set_color(GRID)
        ax.set_aspect("auto")

        if k == 1:
            # The half-space where DPO's objective is already satisfied.
            ax.fill([0.3, 9.7, 9.7, 0.3], [1.1, 5.2, 0.3, 0.3], color=RED, alpha=0.10,
                    zorder=1)
            ax.plot([0.3, 9.7], [1.1, 5.2], color=RED, linewidth=1.0,
                    linestyle=(0, (3, 2)), zorder=2)
            ax.annotate("margin already satisfied\nanywhere below this line",
                        (9.6, 0.35), ha="right", va="bottom", fontsize=6.8, color=RED)

        ax.plot(1.5, 1.4, "o", color=MUTED, markersize=7, zorder=4)
        ax.annotate(r"$\pi_{\mathrm{ref}}$", (1.5, 1.4), xytext=(0, -12),
                    textcoords="offset points", ha="center", fontsize=8, color=INK2)
        ax.plot(8.3, 5.6, "o", color=AQUA, markersize=9, zorder=4)
        ax.annotate("the politician's own\ndistribution", (8.3, 5.6), xytext=(0, 11),
                    textcoords="offset points", ha="center", fontsize=7, color=INK)

        if k == 0:
            ax.annotate("", xy=(7.9, 5.3), xytext=(1.8, 1.7),
                        arrowprops=dict(arrowstyle="-|>", color=BLUE, linewidth=2.0,
                                        shrinkA=0, shrinkB=0), zorder=3)
            ax.annotate("the gradient keeps pointing\nat the target, so every step\n"
                        "carries identity", (4.4, 2.4), fontsize=7, color=INK2,
                        ha="left", va="center")
        else:
            ax.plot(2.6, 5.6, "o", color=RED, markersize=8, alpha=0.85, zorder=4)
            ax.annotate("caricature $y_l$\n(synthesised)", (2.6, 5.6), xytext=(0, 11),
                        textcoords="offset points", ha="center", fontsize=7, color=RED)
            ax.annotate("", xy=(4.6, 2.9), xytext=(1.8, 1.7),
                        arrowprops=dict(arrowstyle="-|>", color=RED, linewidth=2.0,
                                        shrinkA=0, shrinkB=0), zorder=3)
            ax.annotate("any direction beating the\ncaricature will do — including\n"
                        "ones with no identity in them", (4.9, 2.7), fontsize=7,
                        color=INK2, ha="left", va="center")

        r = aff[arm]
        obj = "SFT" if k == 0 else "DPO"
        ax.set_title(f"{'AB'[k]}  {obj} anchors — "
                     + ("raise log $\\pi$(real utterance)" if k == 0
                        else "raise it only relative to $y_l$"), loc="left")
        tail = f"$p$ = {r['p']:.4f}" if k == 0 else "at chance"
        ax.set_xlabel(f"matches party {r['matches']}/{r['n']}  "
                      f"(null {r['null_mean']:.2f}, {tail})", color=colour, fontsize=7.5)
    fig.suptitle("Fisher exact between the arms: $p = 7.2\\times10^{-4}$ — "
                 "the objective, and nothing else, differs.",
                 y=0.02, fontsize=7.5, color=INK)
    fig.tight_layout(rect=(0, 0.05, 1, 1), w_pad=1.6)
    save(fig, "fig_objective_geometry.pdf")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default=os.path.join(ART, "paper_numbers.json"))
    ap.add_argument("--only", default=None, help="render one figure, e.g. register")
    args = ap.parse_args()
    with open(args.json, encoding="utf-8") as fh:
        d = json.load(fh)
    style()
    figs = {"register": fig_register, "affinity": fig_affinity, "forest": fig_forest,
            "prominence": fig_prominence, "utas": fig_utas,
            "granularity": fig_granularity, "coeffs": fig_coeffs,
            "scale": fig_scale, "objective_geometry": fig_objective_geometry}
    for name, fn in figs.items():
        if args.only and name != args.only:
            continue
        if name == "utas" and "utas" not in d:
            print("  skipping utas: no rank data in the JSON")
            continue
        fn(d)


if __name__ == "__main__":
    main()
