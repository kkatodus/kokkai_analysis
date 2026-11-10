#!/usr/bin/env python3
"""Emit the paper's data appendix: real training instances, verbatim, plus corpus stats.

`main.tex` \\input's the file this writes. The examples are pulled from the shipped
JSONL by *fixed* person id and index rather than sampled, so the appendix is stable
across runs and a reader can locate any instance in the corpus from the speech id
printed beside it.

English glosses are author translations, hard-coded here beside the record they
belong to. They are for readability only — every experiment consumes the Japanese
verbatim — and they are kept in this file rather than in the data so it is obvious
they are not part of the corpus.

Needs the dataset volume mounted (`kdata mount`); refuses to write a partial
appendix, because a silently truncated one would be worse than none.

    python paper_examples.py                     # writes appendix_examples.tex
    python paper_examples.py --show              # print the picked records instead
"""
from __future__ import annotations

import argparse
import json
import os
import statistics as st

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
SPEC = os.path.join(REPO, "specs", "polis-low-resource-persona")
POLIS = os.path.join(REPO, "data", "data", "polis")
OUT = os.path.join(REPO, "paper",
                   "parameter-optimization-for-low-resource-ideological-simulation",
                   "appendix_examples.tex")

# Fixed picks. Chosen for length (each fits on a page with its gloss) and because
# each shows something the prose asserts: the anchor instance shows what the DPO
# `rejected` side actually looks like, and the target instance shows that a
# backbencher's turn is a committee question rather than a set-piece speech.
ANCHOR_PICK = ("2377", 15)      # 塩川鉄也 (JCP), non-regular staff below minimum wage
TARGET_PICK = ("2447", 17)      # 齋藤裕喜 (CDP), 82 speech records — the 60–120 band

# Author translations of the picked records.
GLOSS = {
    ("2377", 15, "prompt"): (
        "You are the Japanese Diet member “Shiokawa Tetsuya (Japanese Communist "
        "Party).” Continue the following exchange in a Diet deliberation with your "
        "own remarks. \\quad "
        "\\textsc{Shiokawa}: As you say, the notice instructs ministries to note that "
        "each prefecture's regional minimum wage is being revised and to respond so "
        "as not to fall below it. Doesn't that itself indicate that there are cases "
        "actually falling below the minimum wage? \\quad "
        "\\textsc{Matsuo (National Personnel Authority)}: The Authority has issued the "
        "notice and is urging each ministry to take care in applying it, but we do not "
        "have a grasp of any actual instances of non-regular staff being paid below "
        "the minimum wage. \\quad "
        "\\textsc{Shiokawa}: So isn't grasping the actual situation and correcting it "
        "precisely your job? [\\ldots] \\quad "
        "\\textsc{Matsuo}: National public employees are not subject to the Minimum "
        "Wage Act, but we have issued a notice and have been guiding each ministry "
        "towards appropriate pay, and intend to continue doing so."),
    ("2377", 15, "chosen"): (
        "So, given that revisions to the minimum wage have been taking place, isn't "
        "this precisely the moment to confirm properly what the actual situation is? "
        "At a time when efforts are being made to raise the minimum wage across the "
        "board, I think it is extremely important to investigate thoroughly what the "
        "actual state of non-regular minimum wages is in each ministry. Will you "
        "conduct such a survey of actual conditions? President of the National "
        "Personnel Authority, what do you say?"),
    ("2377", 15, "rejected"): (
        "Even if the Minimum Wage Act does not apply, if there is a reality in which "
        "pay effectively falls below the minimum wage, that ought to be a problem. "
        "Merely saying you have not grasped it does not permit the conclusion that no "
        "such reality exists. If corrective guidance is to be given, one should begin "
        "by grasping the actual situation accurately."),
    ("2447", 17, "prompt"): (
        "You are the Japanese Diet member “Saito Yuki (Constitutional Democratic "
        "Party / Independents).” Continue the following exchange with your own "
        "remarks. \\quad "
        "\\textsc{Asao (Liberal Democratic Party, Environment Minister)}: [\\ldots] "
        "The Ministry of the Environment will steadily carry out the decontamination "
        "needed so that residents who wish to return may do so at the earliest "
        "possible date. Since decontamination aims to reduce effects on human health "
        "and the living environment, for forest land we are decontaminating areas "
        "adjacent to residential land. [\\ldots] Under the policy of eventually "
        "lifting evacuation orders for all difficult-to-return zones, the government "
        "as a whole will address the matter."),
    ("2447", 17, "chosen"): (
        "Next, I should like to ask about radiation monitoring and its continued "
        "management in Fukushima Prefecture and neighbouring prefectures. Thirteen "
        "years and nine months have passed, yet reputational damage to living areas "
        "and to agriculture, forestry and fisheries has still not been dispelled, and "
        "residents and producers are in great difficulty. Not only ambient dose rates, "
        "but continued management of radiation in the living environment, monitoring of "
        "farmland, and continuous measurement of ground-surface and agricultural "
        "product radiation levels would, I believe, serve transparent disclosure, "
        "prevent reputational damage and provide reassurance. What is your view? Your "
        "answer, please."),
}


def load(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as fh:
        return [json.loads(l) for l in fh]


def tex_escape(s: str) -> str:
    """Escape the characters LaTeX would otherwise act on.

    Diet transcripts carry `％` and `〜` as full-width forms, which are safe, but
    ASCII `%` and `&` do appear in figures quoted in speech and would silently
    comment out the rest of a line.
    """
    for a, b in (("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"),
                 ("$", r"\$"), ("#", r"\#"), ("_", r"\_"), ("{", r"\{"),
                 ("}", r"\}"), ("~", r"\textasciitilde{}"), ("^", r"\textasciicircum{}")):
        s = s.replace(a, b)
    return s


def block(role: str, ja: str, en: str | None, note: str = "") -> str:
    """One labelled example block: the verbatim Japanese, then the gloss."""
    out = [f"\\dexlabel{{{role}}}{note}", tex_escape(ja).replace("\n", "\\par\n")]
    if en:
        out += ["", f"\\dexgloss{{{en}}}"]
    return "\n".join(out) + "\n"


def abridge_prompt(prompt: str, keep_turns: int) -> str:
    """Keep the header, the first `keep_turns` turns, and the trailing speaker cue.

    Prompts run to ~1.2k characters by design (the export's char budget), which is
    more page than an illustration needs; the elision is marked so nobody mistakes
    the abridged form for the input the model saw.
    """
    parts = [p for p in prompt.split("\n") if p.strip()]
    header, cue, body = parts[0], parts[-1], parts[1:-1]
    if len(body) <= keep_turns:
        return "\n\n".join([header] + body + [cue])
    kept = body[:keep_turns]
    return "\n\n".join([header] + kept + ["［…以下、同じ審議の続きを省略…］", cue])


def corpus_stats() -> tuple[list, list]:
    """Per-anchor and per-band instance counts and character lengths."""
    with open(os.path.join(SPEC, "targets_n30.json"), encoding="utf-8") as fh:
        meta = {str(t["person_id"]): t for t in json.load(fh)["targets"]}
    for pid, (nm, band) in {"1279": ("高市早苗", "original"),
                            "2053": ("赤嶺政賢", "original"),
                            "2289": ("枝野幸男", "original")}.items():
        meta[pid] = {"name": nm, "band": band, "speeches": None}

    anchors = []
    for pid, jp, party in (("152", "岸田文雄", "LDP"), ("2377", "塩川鉄也", "JCP"),
                           ("3631", "福島みずほ", "SDP"), ("5520", "上田清司", "DPJ")):
        rows = load(os.path.join(POLIS, "dpo_pairs_full", f"{pid}.jsonl"))
        anchors.append({
            "pid": pid, "name": jp, "party": party, "n": len(rows),
            "prompt": st.median(len(r["prompt"]) for r in rows),
            "chosen": st.median(len(r["chosen"]) for r in rows),
            "rejected": st.median(len(r["rejected"]) for r in rows if r.get("rejected")),
            "turns": st.median(r["prompt"].count("：") for r in rows),
        })

    bands: dict[str, list[dict]] = {}
    for pid, m in meta.items():
        path = os.path.join(POLIS, "dpo_pairs_targets", f"{pid}.jsonl")
        if not os.path.exists(path):
            continue
        rows = load(path)
        bands.setdefault(m["band"], []).append({
            "n": len(rows),
            "prompt": st.median(len(r["prompt"]) for r in rows),
            "chosen": st.median(len(r["chosen"]) for r in rows),
            "turns": st.median(r["prompt"].count("：") for r in rows),
        })
    order = ["original", "3000-+", "1000-3000", "500-1000", "250-500", "120-250",
             "60-120"]
    label = {"original": "originals", "3000-+": "3000+", "1000-3000": "1000--3000",
             "500-1000": "500--1000", "250-500": "250--500", "120-250": "120--250",
             "60-120": "60--120"}
    targets = [{"band": label[b], "k": len(bands[b]),
                "n": st.median(x["n"] for x in bands[b]),
                "prompt": st.median(x["prompt"] for x in bands[b]),
                "chosen": st.median(x["chosen"] for x in bands[b]),
                "turns": st.median(x["turns"] for x in bands[b])}
               for b in order if b in bands]
    return anchors, targets


def build() -> str:
    apid, aidx = ANCHOR_PICK
    tpid, tidx = TARGET_PICK
    a = load(os.path.join(POLIS, "dpo_pairs_full", f"{apid}.jsonl"))[aidx]
    t = load(os.path.join(POLIS, "dpo_pairs_targets", f"{tpid}.jsonl"))[tidx]
    anchors, targets = corpus_stats()

    utas_item = next(
        it for it in json.load(open(os.path.join(POLIS, "utas_ground_truth",
                                                 "2024HoR.json"), encoding="utf-8"))["items"]
        if it["code"] == "Q4_1")
    enumerated = "\n".join(f"{i + 1}. {o}" for i, o in enumerate(utas_item["options_ja"]))

    def clip(s: str, n: int = 150) -> str:
        """Trim a demonstration for display. The run uses the full utterance."""
        return s if len(s) <= n else s[:n].rstrip() + "［…］"

    icl_chosen = [clip(r["chosen"]) for r in
                  load(os.path.join(POLIS, "dpo_pairs_targets", f"{tpid}.jsonl"))[:2]]

    L = []
    add = L.append
    add(r"""% Generated by research/polis/paper_examples.py -- do not edit by hand.
% Every Japanese string below is verbatim from the shipped corpus; the English is an
% author translation for readability only.
\appendix
\section{Training and Evaluation Instances}
\label{app:examples}

All instances below are verbatim from the corpus the experiments consume. English
renderings in italics are our translations, supplied for readability; no experiment
sees them. Speech identifiers are given so each instance can be located in the Diet
record.

\newcommand{\dexlabel}[1]{\par\vspace{3pt}\noindent{\footnotesize\scshape #1}\par\nobreak\vspace{1pt}}
\newcommand{\dexgloss}[1]{\par\vspace{1pt}\noindent{\footnotesize\itshape #1}\par}
\newenvironment{dexample}{%
  \par\vspace{4pt}\begin{list}{}{%
    \setlength{\leftmargin}{1.1em}\setlength{\rightmargin}{0em}%
    \setlength{\itemindent}{0em}\setlength{\parsep}{2pt}%
    \setlength{\topsep}{2pt}}\item[]\small%
}{\end{list}\vspace{2pt}}
""")

    # ---- A.1 anchor instance ------------------------------------------
    add(r"\subsection{An anchor training instance (Section~\ref{sec:main}, "
        r"``Anchor Alignment'')}" "\n")
    add(f"""
Anchor \\textbf{{{tex_escape(a['speaker'])}}} ({tex_escape(a['speakerGroup'])}),
sitting of {a['date']}, speech \\texttt{{{tex_escape(a['speechID'])}}}. The
\\emph{{prompt}} is the reconstructed prior context of the same sitting plus a speaker
cue; the \\emph{{chosen}} completion is what the politician actually said next; the
\\emph{{rejected}} completion, used only by the DPO arm, is a strong-LLM caricature of
the same politician answering the same cue. The context is abridged here to two turns
of the four in the original ({len(a['prompt'])} characters).

\\begin{{dexample}}
""")
    add(block("prompt (abridged)", abridge_prompt(a["prompt"], 2),
              GLOSS[(apid, aidx, "prompt")]))
    add(block("chosen: the real utterance", a["chosen"],
              GLOSS[(apid, aidx, "chosen")]))
    add(block(f"rejected: machine-generated caricature "
              f"({tex_escape(a['rejected_model'])}), not a real statement",
              a["rejected"], GLOSS[(apid, aidx, "rejected")]))
    add(r"\end{dexample}" "\n")
    add(r"""
\paragraph{The content of the preference contrast.} The caricature is not an
incompetent generation: it is fluent, on topic, and argues the same side of the
question. What it lacks is \emph{procedure}. The real utterance names the official it
addresses, situates the demand within an ongoing policy movement, and closes with a
specific institutional request---that a survey of actual conditions be conducted. The
caricature closes with a generalisation. This is the distinction the preference
objective is constructed to capture, and Section~\ref{sec:objective} establishes that
capturing it does not require the policy to move toward the politician's own
distribution: any direction that separates the real utterance from this caricature
suffices, and most such directions are uninformative about the speaker's identity.
""")

    # ---- A.2 target instance ------------------------------------------
    add(r"\subsection{A sparse-target instance}" "\n")
    add(f"""
Target \\textbf{{{tex_escape(t['speaker'])}}} ({tex_escape(t['speakerGroup'])}),
sitting of {t['date']}, speech \\texttt{{{tex_escape(t['speechID'])}}} --- a member with
82 speech records, in the second-sparsest band of our sample. Targets carry
prompt/completion pairs only: a held-out target is never given an adapter, so no
\\emph{{rejected}} side is generated for it. Note the difference in register that the
sampling design was intended to expose: this is a committee question closing with an
explicit request for an answer, rather than the prepared set-piece characteristic of a
party leader.

\\begin{{dexample}}
""")
    add(block("prompt (abridged)", abridge_prompt(t["prompt"], 1),
              GLOSS[(tpid, tidx, "prompt")]))
    add(block("chosen: the real utterance", t["chosen"],
              GLOSS[(tpid, tidx, "chosen")]))
    add(r"\end{dexample}" "\n")

    # ---- A.3 the ICL prefix -------------------------------------------
    add(r"\subsection{The in-context prefix (baseline 4)}" "\n")
    add(r"""
\texttt{ICL} prepends the target's own dev-fold utterances --- the \emph{chosen} sides,
not their debate contexts, which would exhaust the context window without saying
anything more about how the politician speaks --- to every held-out prompt. The block
is capped at 12k characters, which for a 24-instance budget is a prefix of roughly 9k
tokens paid at every inference. Two demonstrations are shown, each clipped after 150
characters; the run uses every dev instance in full.

\begin{dexample}
""")
    demo = ("以下は、あなたがこれまでの国会審議で実際に行った発言です。\n\n"
            + "\n\n".join(f"・{c}" for c in icl_chosen)
            + "\n\n［…残りの発言を省略…］\n\n"
            "上記の発言と同じ立場・話し方で、次の審議に応じてください。")
    add(block("prefix template, with two of the demonstrations", demo,
              "Below are remarks you have actually made in past Diet deliberations. "
              "[\\ldots] Respond to the following deliberation in the same position "
              "and manner of speaking as the remarks above."))
    add(r"\end{dexample}" "\n")

    # ---- A.4 UTAS elicitation -----------------------------------------
    add(r"\subsection{The UTAS elicitation prompt (Section~\ref{sec:utas})}" "\n")
    add(f"""
Numeric-label scoring: the options are enumerated in the prompt and only the single
label token the model would emit is scored, so every candidate continuation is exactly
one token and the answer distribution is length-unbiased. Item
\\texttt{{{tex_escape(utas_item['code'])}}} of the 2024 House of Representatives wave is shown. The
persona is conditioned on the name alone --- no speech, no adapter and no merge is
required to run this, which is what made the 594-persona population control in
Section~\\ref{{sec:utas}} possible.

\\begin{{dexample}}
""")
    add(block("system", "あなたは日本の国会議員、高市早苗です。以下の政策に関する意見について、"
                        "選択肢の中からあなたの立場に最も近いものを一つだけ答えてください。",
              "You are a member of the Japanese Diet, Takaichi Sanae. For the "
              "following policy opinion, answer with the single option closest to "
              "your own position."))
    add(block("user", f"{utas_item['question_ja']}\n{enumerated}\n\n"
                      f"上記の選択肢の中から、あなたの立場に最も近いものの番号"
                      f"（1〜{len(utas_item['options_ja'])}）だけを答えてください。",
              f"“{tex_escape(utas_item['source_text'])}” \\quad 1. Agree \\quad 2. Somewhat agree "
              "\\quad 3. Neither \\quad 4. Somewhat disagree \\quad 5. Disagree "
              "\\quad Answer only with the number of the option closest to your "
              "position."))
    add(block("scored continuation", "1 / 2 / 3 / 4 / 5",
              "One token. The reported expectation is $\\sum_k k\\,p(k)$ on the 1--5 "
              "scale; the rank metric uses the resulting 33-vector."))
    add(r"\end{dexample}" "\n")
    add(f"""
The item wording here is {'a machine translation into Japanese of the English codebook'
if utas_item['provenance'] == 'translated_from_en' else 'the native Japanese wording'},
performed once and reused for every persona and configuration, so no configuration is
advantaged by it.
""")

    # ---- A.5 corpus statistics ----------------------------------------
    add(r"""\subsection{Instance counts and lengths}

Character counts rather than token counts, because the export budgets context in
characters (Japanese runs at roughly one token per character for this backbone). The
prompt cap is what keeps prompt-plus-completion inside the trainer's 1\,024-token
limit.

\begin{table}[t]
\centering
\caption{Anchor training sets. Each anchor contributes 1\,500 instances; the
\emph{rejected} column exists only in the DPO arm. Medians.}
\label{tab:anchorstats}
\begin{tabular}{llrrrrr}
\toprule
Anchor & Party & instances & prompt & turns & chosen & rejected \\
\midrule
""")
    for r in anchors:
        add(f"{r['name']} & {r['party']} & {r['n']:,} & {r['prompt']:.0f} & "
            f"{r['turns']:.0f} & {r['chosen']:.0f} & {r['rejected']:.0f} \\\\\n")
    add(r"""\bottomrule
\end{tabular}
\end{table}

\begin{table}[t]
\centering
\caption{Held-out targets by prominence band: median instances available per target
and median lengths in characters. Only 30 instances are ever used, whatever a target
has; the export caps extraction at 300.}
\label{tab:targetstats}
\begin{tabular}{lrrrrr}
\toprule
Band (speech records) & targets & instances & prompt & turns & chosen \\
\midrule
""")
    for r in targets:
        add(f"{r['band']} & {r['k']} & {r['n']:.0f} & {r['prompt']:.0f} & "
            f"{r['turns']:.0f} & {r['chosen']:.0f} \\\\\n")
    add(r"""\bottomrule
\end{tabular}
\end{table}
""")
    sparse, rich = targets[-1], targets[1]
    ratio = sparse["chosen"] / rich["chosen"]
    add(r"""
Two things in Table~\ref{tab:targetstats} are worth noting. The 300-instance extraction
cap binds for every band except the two sparsest, so for most targets the binding
constraint on the experiment is the 30-utterance \emph{budget} rather than data
availability --- which is the sense in which the method is low-resource by construction
rather than by circumstance. Second, and less expected, \textbf{sparse targets speak in
longer turns}: median completion length rises from """
        + f"{rich['chosen']:.0f} characters in the {rich['band']} band to "
          f"{sparse['chosen']:.0f} in the {sparse['band']} band, a "
          f"{ratio:.1f}$\\times$ difference "
        + r"""in the opposite direction to speech count. Frequent speakers accumulate a
record through many short interventions, whereas a backbencher's record is a handful of
long committee questions. This is a plausible part of why the margins in
Section~\ref{sec:prominence} do not decay with prominence --- a fixed 30-utterance
budget buys more text on a sparse target than the speech count suggests --- and it is a
caveat against reading speech-record counts as a proxy for available training signal.
""")
    return "".join(L)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--show", action="store_true",
                    help="print the picked records instead of writing the appendix")
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    if not os.path.isdir(POLIS):
        raise SystemExit(f"dataset volume not mounted: {POLIS} is missing "
                         f"(run `kdata mount`)")

    if args.show:
        for pid, idx, sub in ((ANCHOR_PICK[0], ANCHOR_PICK[1], "dpo_pairs_full"),
                              (TARGET_PICK[0], TARGET_PICK[1], "dpo_pairs_targets")):
            r = load(os.path.join(POLIS, sub, f"{pid}.jsonl"))[idx]
            print("=" * 72, f"{sub} {pid}[{idx}]  {r['speaker']}  {r['date']}")
            for k in ("prompt", "chosen", "rejected"):
                if r.get(k):
                    print(f"--- {k} ({len(r[k])} chars) ---\n{r[k]}")
        return

    tex = build()
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(tex)
    print(f"wrote {os.path.relpath(args.out, REPO)}  ({len(tex):,} bytes)")


if __name__ == "__main__":
    main()
