"""DARE-TIES merge smoke test over POLIS anchors (spec §2.3, Phase 3 start).

Loads the base model + all anchor LoRA adapters into one PeftModel, builds a
uniform DARE-TIES weighted merge (drop rate ~0.9 → density 0.1, per spec §2.3),
and confirms the merged model still produces a usable answer distribution via the
option-logprob scorer. This is the precursor to the custom layer-group merge that
Bayesian optimisation will tune (§2.4); here the goal is only to prove the merge →
forward → option-logprob path works end-to-end.

Run from research/polis/ with the research venv:
    python merge_anchors_dare_ties.py
"""
from __future__ import annotations

import argparse
import glob
import os

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

from polis_option_logprob import (
    score_options,
    LIKERT_AGREE_JA,
    AB_SCALE_JA,
)

DEMO_ITEMS = [
    ("社会保障などの行政サービスが多少低下しても、費用の安い小さな政府の方が望ましい。", LIKERT_AGREE_JA),
    ("原子力発電について、A「原子力発電は直ちに廃止すべきだ」、B「原子力発電は今後も電力源の一つとして残すべきだ」。", AB_SCALE_JA),
]
SYSTEM = (
    "あなたは日本の国会議員です。以下の政策に関する意見について、"
    "選択肢の中からあなたの立場に最も近いものを一つだけ答えてください。"
)


def _report(tag, model, tokenizer):
    print(f"\n########## {tag} ##########")
    for q, opts in DEMO_ITEMS:
        res = score_options(model, tokenizer, SYSTEM, q, opts)
        print(f"Q: {q[:38]}…  argmax={res.argmax + 1}  E[1..{len(opts)}]={res.expectation:.3f}")


def main() -> None:
    ap = argparse.ArgumentParser(description="DARE-TIES merge smoke test over anchors")
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--adapters", nargs="*", help="Adapter dirs (default: output/polis_*)")
    ap.add_argument("--density", type=float, default=0.1, help="DARE keep fraction (1 - drop rate)")
    args = ap.parse_args()

    here = os.path.dirname(__file__)
    adapters = args.adapters or sorted(glob.glob(os.path.join(here, "output", "polis_*")))
    adapters = [a for a in adapters if os.path.isfile(os.path.join(a, "adapter_model.safetensors"))]
    names = [os.path.basename(a).replace("polis_", "") for a in adapters]
    print(f"Merging {len(adapters)} anchors (DARE-TIES, density={args.density}): {names}")

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    base = AutoModelForCausalLM.from_pretrained(args.base, device_map="auto", dtype=torch.bfloat16)

    # Load first adapter, then the rest into the same PeftModel.
    model = PeftModel.from_pretrained(base, adapters[0], adapter_name=names[0])
    for a, n in zip(adapters[1:], names[1:]):
        model.load_adapter(a, adapter_name=n)

    # Uniform DARE-TIES weighted merge.
    model.add_weighted_adapter(
        adapters=names,
        weights=[1.0] * len(names),
        adapter_name="merged",
        combination_type="dare_ties",
        density=args.density,
    )
    model.eval()

    # Baseline: no adapter (disable) vs. merged.
    with model.disable_adapter():
        _report("BASE (no adapter)", model, tokenizer)
    model.set_adapter("merged")
    _report("MERGED (DARE-TIES, uniform)", model, tokenizer)
    print("\n[OK] merge → forward → option-logprob path works on the merged model.")


if __name__ == "__main__":
    main()
