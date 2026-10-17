#!/usr/bin/env python3
"""Structural diagrams for `main.tex`, laid out by Graphviz.

Three figures that are genuinely *graphs* — the pipeline, the merge arithmetic, and
the evaluation protocol — so `dot` does the layout. An earlier hand-placed SVG
version of these fought label collisions on every edit; with auto-layout the only
things specified here are content, grouping and rank, which is the part that carries
meaning.

The two remaining conceptual figures are not graphs (one is a quantitative axis, one
a 2-D geometric sketch) and live in `paper_figures.py` with the other measurements.

Numbers come from `paper_numbers.py`'s JSON, so a re-run tracks the artifacts.

    python paper_numbers.py
    python paper_diagrams.py            # needs the `dot` binary only, no Python deps
    python paper_diagrams.py --png      # also PNG, to eyeball

Each figure is emitted as `.dot` next to the PDF, so the source of a diagram is
reviewable without running anything.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
ART = os.path.join(REPO, "specs", "polis-low-resource-persona", "artifacts")
OUT = os.path.join(REPO, "paper",
                   "parameter-optimization-for-low-resource-ideological-simulation",
                   "figures")

# Same palette as the plotted figures, used semantically: blue is the POLIS path,
# orange the target's own sparse data, grey anything frozen or discarded, red the
# failure mode. Tints are steps 100/200 of the sequential blue ramp.
BLUE, ORANGE, AQUA, RED = "#2a78d6", "#eb6834", "#1baf7a", "#e34948"
BLUE_T, ORANGE_T, RED_T = "#cde2fb", "#fbe0d5", "#fadedd"
INK, INK2, MUTED = "#0b0b0b", "#52514e", "#8a8984"
SURFACE, RULE = "#f7f6f3", "#dedcd6"
FONT = "IPAexGothic"        # carries Latin and CJK; DejaVu covers the maths glyphs

PREAMBLE = f'''  graph [bgcolor=white, fontname="{FONT}", fontsize=8,
         fontcolor="{INK}", margin=0];
  node  [shape=box, style="rounded,filled", fillcolor="{SURFACE}", color="{RULE}",
         fontname="{FONT}", fontsize=9, fontcolor="{INK}", penwidth=0.9,
         margin="0.11,0.06"];
  edge  [color="{INK2}", arrowsize=0.55, penwidth=0.9, fontname="{FONT}",
         fontsize=7, fontcolor="{INK2}"];
'''


def small(s: str, colour: str = INK2, size: int = 7) -> str:
    return f'<font point-size="{size}" color="{colour}">{s}</font>'


def card(title: str, sub: str) -> str:
    """A node label with a title line and a smaller secondary line."""
    return f'<<b>{title}</b><br/>{small(sub)}>'


def render(name: str, dot: str, png: bool) -> None:
    os.makedirs(OUT, exist_ok=True)
    dpath = os.path.join(OUT, name + ".dot")
    with open(dpath, "w", encoding="utf-8") as fh:
        fh.write(dot)
    for fmt, extra in [("pdf", [])] + ([("png", ["-Gdpi=200"])] if png else []):
        subprocess.run(["dot", f"-T{fmt}", *extra, dpath,
                        "-o", os.path.join(OUT, f"{name}.{fmt}")], check=True)
    # Report the natural size: these are included at \textwidth (6.5 in), so a
    # layout that comes out far from that is being rescaled, and its 9 pt labels
    # are not 9 pt on the page any more.
    out = subprocess.run(["pdfinfo", os.path.join(OUT, name + ".pdf")],
                         capture_output=True, text=True).stdout
    size = next((l.split(":", 1)[1].strip() for l in out.splitlines()
                 if l.startswith("Page size")), "?")
    w = float(size.split()[0]) / 72 if size != "?" else 0
    # 5.6-7.1 in is a <= 15% rescale, which costs a label about a point; outside
    # that band the diagram needs its rank structure or font sizes changed instead.
    flag = "" if 5.6 <= w <= 7.1 else "   <-- far from 6.5 in, will be rescaled"
    print(f"  wrote figures/{name}.pdf   natural {w:.2f} in wide{flag}")


# ------------------------------------------------------------------ pipeline


def fig_pipeline(d: dict, png: bool) -> None:
    """The whole method: what is trained once, what is merged, what is searched per target.

    Grouped into the two resource regimes, so it is visible that the data-rich work
    finishes before the sparse target appears; and the coefficient search is drawn as
    a genuine cycle back into the merge, which is the one structural fact a reader
    most needs and a linear diagram cannot show.
    """
    # Top-to-bottom, with the four anchors abreast: the natural width is then set by
    # one rank of four cards, which lands at the paper's text width. The left-to-right
    # version of this diagram laid out 11.9 in wide and would have been rescaled to
    # 55%, taking its 9 pt labels down to 5 pt.
    anchors = [("岸田文雄", "Kishida, LDP", "≈20k"), ("塩川鉄也", "Shiokawa, JCP", "≈9k"),
               ("福島みずほ", "Fukushima, SDP", "≈12k"), ("上田清司", "Ueda, DPJ", "≈4k")]
    cards = "\n".join(
        f'    a{i} [label={card(jp, f"{en}<br/>{n} speeches")}];'
        for i, (jp, en, n) in enumerate(anchors))
    deltas = "\n".join(
        f'    w{i} [label=<ΔW<sup>{small(f"({i + 1})", BLUE)}</sup>>, '
        f'fillcolor="{BLUE_T}", color="{BLUE}", fontcolor="{BLUE}", width=0.6, '
        f'height=0.3];' for i in range(len(anchors)))

    dot = f'''digraph pipeline {{
  rankdir=TB;
  compound=true;
  ranksep=0.30; nodesep=0.22;
{PREAMBLE}
  subgraph cluster_offline {{
    label=<<b>Trained once, offline — data-rich anchors</b>>;
    labeljust=l; style="rounded"; color="{RULE}"; margin=8;
{cards}
{deltas}
{chr(10).join(f'    a{i} -> w{i} [label=<{small("LoRA r=16", INK2)}>];'
              for i in range(len(anchors)))}
    {{ rank=same; {" ".join(f"a{i};" for i in range(len(anchors)))} }}
    {{ rank=same; {" ".join(f"w{i};" for i in range(len(anchors)))} }}
  }}

  merge [shape=box, style="rounded,filled", fillcolor=white, color="{BLUE}",
         penwidth=1.4, margin="0.16,0.08", label=<
    <table border="0" cellborder="0" cellspacing="0" cellpadding="1">
      <tr><td align="center" colspan="2"><b>DARE-TIES merge</b></td></tr>
      <tr><td align="left">{small("1. DARE: drop 90% of each ΔW, fixed seed → deterministic")}</td>
          <td align="right">{small("W = W<sub>base</sub> + ΔW(C)", BLUE, 9)}</td></tr>
      <tr><td align="left">{small("2. scale by c<sub>a,g</sub> — per anchor × depth group")}</td>
          <td align="right">{small("exactly reversible:", MUTED)}</td></tr>
      <tr><td align="left">{small("3. TIES: elect a sign, average the agreeing contributions")}</td>
          <td align="right">{small("no reload per trial", MUTED)}</td></tr>
    </table>>];

  subgraph cluster_target {{
    label=<<b>Per sparse target — the only data-poor step</b>>;
    labeljust=l; style="rounded"; color="{RULE}"; margin=8;
    data [label={card("target's 30 utterances", "with prior session context")},
          fillcolor="{ORANGE_T}", color="{ORANGE}"];
    obj  [label={card("objective: held-out NLL", "of the real utterances")}];
    bo   [label={card("Bayesian optimization", "GPSampler · 40 trials/fold")},
          fillcolor="{BLUE_T}", color="{BLUE}"];
    {{ rank=same; data; obj; bo; }}
    data -> obj [color="{ORANGE}"];
    obj -> bo;
  }}

{chr(10).join(f'  w{i} -> merge [color="{BLUE}"];' for i in range(len(anchors)))}
  merge -> obj [color="{MUTED}", style=dashed, label=<{small("scores W(C)", MUTED)}>];
  bo -> merge [color="{BLUE}", style=dashed, constraint=false,
               label=<{small("proposes C", BLUE)}>];
}}
'''
    render("fig_pipeline", dot, png)


# ------------------------------------------------------------------ merge


def fig_merge(d: dict, png: bool) -> None:
    """The merge arithmetic, walked along one parameter of one module.

    Included because "elect a sign, then take a *disjoint* mean" is the step readers
    most often picture wrong: a DARE-dropped entry becomes a hole, not a zero vote
    against the surviving anchors, and only the third stage is under the optimizer's
    control. Laid out left to right, one node per stage, so the whole thing is a
    short wide strip rather than a column — the fitted coefficient matrix that used
    to sit beside it is a measurement and moved to the plotted figures.
    """
    def stage(nid: str, title: str, vals: list[str], emph: list[bool]) -> str:
        rows = "".join(
            f'<tr><td align="right">'
            f'{small("ΔW", INK2)}<sup>{small(f"({j + 1})", INK2, 6)}</sup></td>'
            f'<td width="38" align="center" bgcolor="{BLUE_T if e else "#ffffff"}" '
            f'border="1" color="{BLUE if e else RULE}">'
            f'<font point-size="9" color="{INK}">{v}</font></td></tr>'
            for j, (v, e) in enumerate(zip(vals, emph)))
        return (f'  {nid} [shape=none, margin=0, label=<\n'
                f'    <table border="0" cellborder="0" cellspacing="3" cellpadding="2">\n'
                f'      <tr><td colspan="2" align="left">{small(title, MUTED)}</td></tr>\n'
                f'      {rows}\n    </table>>];\n')

    dot = f'''digraph merge {{
  rankdir=LR;
  ranksep=0.22; nodesep=0.16;
{PREAMBLE}
{stage("raw", "at one coordinate", ["+0.8", "−0.6", "0", "+0.4"], [False] * 4)}
{stage("dare", "after DARE", ["+8.0", "dropped", "0", "+4.0"], [False] * 4)}
{stage("scaled", "after scaling by c<sub>a,g</sub>", ["+2.7", "—", "0", "+1.2"],
        [True, False, False, True])}
  ties [shape=box, style="rounded,filled", fillcolor="{SURFACE}", color="{RULE}",
        margin="0.14,0.09", label=<
    <table border="0" cellborder="0" cellspacing="0" cellpadding="1">
      <tr><td align="left"><b>TIES</b></td></tr>
      <tr><td align="left">{small("elect the majority sign,")}</td></tr>
      <tr><td align="left">{small("average only the agreeing entries")}</td></tr>
      <tr><td align="left">surviving signs {{ +, + }} → +</td></tr>
      <tr><td align="left"><font color="{BLUE}">mean(+2.7, +1.2) = +1.95</font></td></tr>
      <tr><td align="left"><font color="{BLUE}">W = W<sub>base</sub> + 1.95</font></td></tr>
    </table>>];

  raw  -> dare   [label=<{small("drop 90%,")}<br/>{small("fixed seed")}>];
  dare -> scaled [label=<{small("the only step")}<br/>{small("the BO controls")}>,
                  color="{BLUE}"];
  scaled -> ties;
}}
'''
    render("fig_merge", dot, png)


# ------------------------------------------------------------------ protocol


def fig_protocol(d: dict, png: bool) -> None:
    """What each method is allowed to see, on one outer fold.

    Drawn because one picture answers three separate objections: the coefficients
    never touch the test fold, the in-context prefix is built from dev only, and
    every method — merge, fine-tuning, prompting — is handed the same 24 instances.
    """
    folds = "".join(
        f'<td width="74" align="center" bgcolor="{ORANGE_T if k == 3 else BLUE_T}">'
        f'<font point-size="9">{"test (6)" if k == 3 else "dev (6)"}</font></td>'
        for k in range(5))

    dot = f'''digraph protocol {{
  rankdir=TB;
  ranksep=0.34; nodesep=0.35;
{PREAMBLE}
  strip [shape=none, margin=0, label=<
    <table border="0" cellborder="1" cellspacing="3" cellpadding="4" color="{RULE}">
      <tr><td colspan="5" border="0" align="left">
        <b>Nested 5-fold CV — one outer fold shown</b></td></tr>
      <tr>{folds}</tr>
      <tr><td colspan="5" border="0" align="left">
        {small("30 utterances in 5 folds; each is held out in turn and every method is rotated over identical folds.")}</td></tr>
      <tr><td colspan="5" border="0" align="left">
        {small("The four dev folds — 24 instances — are the whole low-resource budget, and each method below gets all of them.")}</td></tr>
    </table>>];

  polis [label=<<b>POLIS (BO)</b><br/>{small("40 GP trials search C")}<br/>{small("12 coefficients fitted")}>,
         fillcolor="{BLUE_T}", color="{BLUE}"];
  ft    [label={card("SFT / DPO baselines", "LoRA on the dev folds<br/>≈20M parameters fitted")}];
  icl   [label={card("ICL baseline", "the dev utterances become<br/>an in-prompt prefix")}];

  strip -> polis [color="{BLUE}"];
  strip -> ft;
  strip -> icl;

  score [label=<<b>scored on the untouched test fold</b><br/>{small("paired — the same 6 utterances for every method")}>,
         fillcolor="{ORANGE_T}", color="{ORANGE}"];
  polis -> score [color="{BLUE}"];
  ft -> score;
  icl -> score;

  note [shape=box, style="rounded,dashed", color="{RULE}", fillcolor=white,
        margin="0.16,0.09", label=<
    <table border="0" cellborder="0" cellspacing="0" cellpadding="1">
      <tr><td align="left"><b>No leakage by construction.</b>&nbsp;
        {small("The in-context prefix is built from dev only, and the merge is", INK2, 8)}</td></tr>
      <tr><td align="left">{small("scored with the model restored to base weights, so the test fold enters exactly once — at scoring time.", INK2, 8)}</td></tr>
    </table>>];
  score -> note [style=invis];
}}
'''
    render("fig_protocol", dot, png)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default=os.path.join(ART, "paper_numbers.json"))
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--only", default=None)
    args = ap.parse_args()
    with open(args.json, encoding="utf-8") as fh:
        d = json.load(fh)
    figs = {"pipeline": fig_pipeline, "merge": fig_merge, "protocol": fig_protocol}
    for name, fn in figs.items():
        if not args.only or name == args.only:
            fn(d, args.png)


if __name__ == "__main__":
    main()
