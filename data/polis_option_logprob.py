"""Option-logprob scoring for POLIS persona evaluation (spec §4.4 headline metric).

Given a persona (base model + optional LoRA adapter) and a survey item with
enumerated answer options, score each option by the model's log-probability of
producing that option as its answer. This is the primitive the whole UTAS-agreement
evaluation is built on: no free-text parsing, a clean argmax for categorical items,
and a probability-weighted expectation for ordinal (Likert) items.

Design:
- The question is presented through the model's chat template as a system (persona)
  + user (item) turn; each candidate answer is scored as the assistant completion.
- Only the continuation (answer) tokens are scored, under teacher forcing.
- Returns raw summed log-probs, length-normalised log-probs, a softmax distribution,
  the argmax option, and the 1..N expectation (useful for MAE on Likert items).

This module is model-agnostic and has no dependency on the rest of the repo; run it
with the persona venv interpreter (torch/transformers/peft), e.g.
    /root/projects/idea/persona/.venv/bin/python data/polis_option_logprob.py --demo
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from typing import Sequence

import torch


@dataclass
class OptionScore:
    """Result of scoring one survey item against its answer options."""

    logprobs: list[float]            # summed log P(option | prompt), per option
    norm_logprobs: list[float]       # length-normalised (per-token) log-probs
    probs: list[float]               # softmax over `norm_logprobs` (length-unbiased distribution)
    argmax: int                      # index of the most probable option
    expectation: float               # sum_i (i+1) * probs[i]  -> position on a 1..N scale

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)


def _sequence_logprob(model, input_ids: torch.Tensor, start: int) -> tuple[float, int]:
    """Sum log P of tokens input_ids[start:] under teacher forcing.

    Returns (summed_logprob, n_scored_tokens). `start` is the number of prompt
    tokens; everything from `start` onward is treated as the scored continuation.
    """
    with torch.no_grad():
        logits = model(input_ids).logits  # [1, T, V]
    # logits[:, t] predicts token t+1, so the log-prob of token i uses logits[i-1].
    log_probs = torch.log_softmax(logits[0, :-1].float(), dim=-1)
    targets = input_ids[0, 1:]
    tok_lp = log_probs.gather(-1, targets.unsqueeze(-1)).squeeze(-1)  # [T-1]
    # Token i (0-indexed) is scored by tok_lp[i-1]; we want i in [start, T).
    scored = tok_lp[start - 1 :]
    return scored.sum().item(), scored.numel()


def score_options(
    model,
    tokenizer,
    system: str | None,
    question: str,
    options: Sequence[str],
) -> OptionScore:
    """Score `options` as candidate assistant answers to `question`.

    `system` is the persona instruction (e.g. "あなたは〇〇議員です…"); pass None
    to score the bare base model. Options are the answer-choice strings exactly as
    the model should emit them (e.g. "1. そう思う" or "そう思う").
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": question})

    # transformers >=5 returns a BatchEncoding here; pull out the id tensor.
    prompt_enc = tokenizer.apply_chat_template(
        messages, add_generation_prompt=True, return_tensors="pt", return_dict=True
    )
    prompt_ids = prompt_enc["input_ids"].to(model.device)
    prompt_len = prompt_ids.shape[1]

    logprobs: list[float] = []
    norm_logprobs: list[float] = []
    for opt in options:
        opt_ids = tokenizer(opt, add_special_tokens=False, return_tensors="pt").input_ids.to(
            model.device
        )
        full = torch.cat([prompt_ids, opt_ids], dim=1)
        lp, n = _sequence_logprob(model, full, prompt_len)
        logprobs.append(lp)
        norm_logprobs.append(lp / max(n, 1))

    # Softmax over LENGTH-NORMALISED log-probs. Option strings differ in token
    # count (e.g. 「そう思う」 vs 「どちらかといえばそう思う」), so a softmax over raw
    # summed log-probs is biased toward shorter options and collapses degenerately;
    # per-token log-prob removes that length artefact.
    norm_t = torch.tensor(norm_logprobs)
    probs = torch.softmax(norm_t, dim=0).tolist()
    argmax = int(norm_t.argmax().item())
    expectation = sum((i + 1) * p for i, p in enumerate(probs))
    return OptionScore(logprobs, norm_logprobs, probs, argmax, expectation)


def score_options_numeric(
    model,
    tokenizer,
    system: str | None,
    question: str,
    options: Sequence[str],
) -> OptionScore:
    """Numeric-label variant of :func:`score_options`.

    Instead of scoring each full option string as the assistant continuation, the
    options are enumerated in the *prompt* as a numbered list and only the single
    label token ("1".."N") the model would emit is scored. Motivation (Phase-0
    finding): at small scale, verbose-option scoring collapses degenerately — the
    summed log-prob is dominated by option *length*/surface form rather than the
    model's actual preference, and length-normalisation only partly rescues it.
    Numeric labels make every candidate continuation exactly one token, so the
    softmax is a clean, length-unbiased answer distribution and the argmax stops
    tracking string length. The returned `expectation` is still on the 1..N scale.
    """
    enumerated = "\n".join(f"{i+1}. {o}" for i, o in enumerate(options))
    n = len(options)
    q = (
        f"{question}\n{enumerated}\n\n"
        f"上記の選択肢の中から、あなたの立場に最も近いものの番号（1〜{n}）だけを答えてください。"
    )
    labels = [str(i + 1) for i in range(n)]
    # Labels are single tokens, so length-normalisation is a no-op and the softmax
    # in score_options reduces to a plain softmax over the label log-probs.
    return score_options(model, tokenizer, system, q, labels)


# --- Standard UTAS answer scales (from the English codebook, presented in Japanese) ---

# Q4-style: 5-point agree/disagree (1. agree ... 5. disagree)
LIKERT_AGREE_JA = [
    "そう思う",
    "どちらかといえばそう思う",
    "どちらともいえない",
    "どちらかといえばそう思わない",
    "そう思わない",
]

# Q5-style: A/B 5-point (1. close to A ... 5. close to B)
AB_SCALE_JA = [
    "Aに近い",
    "どちらかといえばAに近い",
    "どちらともいえない",
    "どちらかといえばBに近い",
    "Bに近い",
]


def load_persona(base: str, adapter: str | None, dtype=torch.bfloat16):
    """Load a base causal LM plus an optional LoRA adapter, in eval mode."""
    from transformers import AutoModelForCausalLM, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(base, device_map="auto", dtype=dtype)
    if adapter:
        from peft import PeftModel

        model = PeftModel.from_pretrained(model, adapter)
    model.eval()
    return model, tokenizer


def _demo(base: str, adapter: str | None) -> None:
    """Prove the loop end-to-end at dev scale (Phase 0 gate).

    Administers two real UTAS 2024 items in Japanese and reports the option
    distribution — confirming the base model produces a usable answer distribution
    over enumerated options (UTAS-format answer reliability check).
    """
    model, tokenizer = load_persona(base, adapter)

    system = (
        "あなたは日本の国会議員です。以下の政策に関する意見について、"
        "選択肢の中からあなたの立場に最も近いものを一つだけ答えてください。"
    )
    items = [
        # UTAS 2024 Q4_5 (smaller-government preference), agree/disagree scale
        (
            "社会保障などの行政サービスが多少低下しても、"
            "費用の安い小さな政府の方が望ましい。",
            LIKERT_AGREE_JA,
        ),
        # UTAS 2024 Q5_6 (nuclear power), A/B scale
        (
            "原子力発電について、A「原子力発電は直ちに廃止すべきだ」、"
            "B「原子力発電は今後も電力源の一つとして残すべきだ」。",
            AB_SCALE_JA,
        ),
    ]
    for q, opts in items:
        res = score_options(model, tokenizer, system, q, opts)
        print("\n" + "=" * 72)
        print("Q:", q)
        for i, (o, p, lp) in enumerate(zip(opts, res.probs, res.norm_logprobs)):
            mark = " <-- argmax" if i == res.argmax else ""
            print(f"  {i+1}. {o:22} p={p:6.3f}  norm_lp={lp:7.3f}{mark}")
        print(f"  expectation (1..{len(opts)} scale) = {res.expectation:.3f}")


def _persona_system(name: str | None) -> str:
    """Persona instruction. Naming the anchor mirrors the DPO training prompt header
    (「あなたは〇〇議員です…」); pass name=None for the neutral 'a Diet member' framing."""
    who = f"、{name}" if name else ""
    return (
        f"あなたは日本の国会議員{who}です。以下の政策に関する意見について、"
        "選択肢の中からあなたの立場に最も近いものを一つだけ答えてください。"
    )


def evaluate_anchor(
    model,
    tokenizer,
    ground_truth: dict,
    person_id: str,
    name_persona: bool = True,
    numeric: bool = False,
) -> dict:
    """Administer a wave's UTAS items to a persona and score against the real answers.

    `ground_truth` is a wave file from build_utas_ground_truth.py. Only items the
    anchor actually answered (coded value not null) are scored. Returns per-item rows
    plus aggregate MAE (argmax and expectation), exact + within-1 accuracy, over the
    1..5 scale — the spec §4.4 headline metric.

    `numeric=True` uses :func:`score_options_numeric` (enumerate-and-score-the-digit)
    instead of scoring the full option strings — the Phase-0 fix for degenerate argmax
    at small scale.
    """
    scorer = score_options_numeric if numeric else score_options
    ans = ground_truth["answers"][str(person_id)]
    name = ans["name"]
    system = _persona_system(name if name_persona else None)
    items = {it["code"]: it for it in ground_truth["items"]}

    rows: list[dict] = []
    for code, truth in ans["coded"].items():
        if truth is None:
            continue
        it = items[code]
        q = it["question_ja"]
        if not q:
            continue  # untranslated wording -> unscorable
        res = scorer(model, tokenizer, system, q, it["options_ja"])
        rows.append(
            {
                "code": code,
                "type": it["type"],
                "truth": truth,
                "argmax": res.argmax + 1,
                "expectation": round(res.expectation, 3),
                "abs_err_argmax": abs((res.argmax + 1) - truth),
                "abs_err_exp": round(abs(res.expectation - truth), 3),
            }
        )

    n = len(rows)
    agg = {
        "person_id": person_id,
        "name": name,
        "n_scored": n,
        "mae_argmax": round(sum(r["abs_err_argmax"] for r in rows) / n, 3) if n else None,
        "mae_expectation": round(sum(r["abs_err_exp"] for r in rows) / n, 3) if n else None,
        "exact_acc": round(sum(r["argmax"] == r["truth"] for r in rows) / n, 3) if n else None,
        "within1_acc": round(sum(r["abs_err_argmax"] <= 1 for r in rows) / n, 3) if n else None,
    }
    return {"aggregate": agg, "items": rows}


def _run_utas_eval(base: str, adapter: str | None, gt_path: str, person_id: str,
                   neutral: bool, numeric: bool):
    """Load a persona (base [+adapter]) and print the UTAS headline metric for one anchor."""
    with open(gt_path, encoding="utf-8") as f:
        gt = json.load(f)
    model, tokenizer = load_persona(base, adapter)
    result = evaluate_anchor(model, tokenizer, gt, person_id,
                             name_persona=not neutral, numeric=numeric)
    agg = result["aggregate"]

    print("=" * 72)
    tag = f"adapter={adapter}" if adapter else "base model"
    print(f"UTAS eval — {agg['name']} (person_id {person_id}), {gt['wave']}, {tag}")
    print(f"persona={'neutral' if neutral else 'named'}  "
          f"scoring={'numeric-label' if numeric else 'verbose-option'}  "
          f"items scored: {agg['n_scored']}")
    print("-" * 72)
    print(f"  {'item':7} {'truth':>5} {'argmax':>6} {'E[1..5]':>8}  {'|err|':>5}")
    for r in result["items"]:
        print(
            f"  {r['code']:7} {r['truth']:>5} {r['argmax']:>6} {r['expectation']:>8.2f}"
            f"  {r['abs_err_argmax']:>5}"
        )
    print("-" * 72)
    print(
        f"  MAE(argmax)={agg['mae_argmax']}  MAE(E)={agg['mae_expectation']}  "
        f"exact={agg['exact_acc']}  within1={agg['within1_acc']}"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description="Option-logprob scoring for POLIS personas")
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--adapter", default=None, help="Optional LoRA adapter directory")
    ap.add_argument("--demo", action="store_true", help="Run the Phase-0 demo items")
    ap.add_argument("--utas-eval", metavar="GROUND_TRUTH_JSON",
                    help="Wave file from build_utas_ground_truth.py; run the headline metric")
    ap.add_argument("--person-id", help="Anchor person_id to evaluate (with --utas-eval)")
    ap.add_argument("--neutral", action="store_true",
                    help="Drop the anchor name from the persona prompt (weights-only persona)")
    ap.add_argument("--numeric", action="store_true",
                    help="Numeric-label scoring: enumerate options, score the '1'..'N' token "
                         "(Phase-0 fix for degenerate argmax at small scale)")
    args = ap.parse_args()
    if args.demo:
        _demo(args.base, args.adapter)
    elif args.utas_eval:
        if not args.person_id:
            ap.error("--utas-eval requires --person-id")
        _run_utas_eval(args.base, args.adapter, args.utas_eval, args.person_id,
                       args.neutral, args.numeric)
    else:
        ap.error("nothing to do: pass --demo, --utas-eval, or import score_options")


if __name__ == "__main__":
    main()
