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


def main() -> None:
    ap = argparse.ArgumentParser(description="Option-logprob scoring for POLIS personas")
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--adapter", default=None, help="Optional LoRA adapter directory")
    ap.add_argument("--demo", action="store_true", help="Run the Phase-0 demo items")
    args = ap.parse_args()
    if args.demo:
        _demo(args.base, args.adapter)
    else:
        ap.error("nothing to do: pass --demo (or import score_options)")


if __name__ == "__main__":
    main()
