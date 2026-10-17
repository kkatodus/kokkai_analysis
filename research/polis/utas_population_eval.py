"""Administer a UTAS wave to many name-personas under one model (POLIS spec §4.4).

The §4.4 metric has only ever been computed for the 3 held-out targets, each scored
against its own answers. That design cannot separate two very different failures:

  * the persona is *wrong*  — the model has views, they don't match this politician;
  * the persona is *inert*  — the answers don't depend on the name at all, so no
    merge, adapter or coefficient could ever move the metric.

Telling them apart needs the rest of the wave. This script administers every item to
N name-personas under a single model and dumps the raw answer vectors; the analysis
in `utas_rank_metric.py` then reports

  * **name-swap divergence** — how much simulated vectors move when only the name
    changes, against how much the *real* politicians differ from each other. A ratio
    near zero is the inert case, and explains a flat §4.4 table in one number.
  * **rank of the true politician** — for a simulated persona, how many of the wave's
    real answer vectors are closer to it than its own is. Unlike MAE this has an exact
    null (50th percentile = chance) and is unaffected by every politician clustering
    near the scale midpoint, since only the ordering matters.

Only the survey answers are needed per politician — the persona is conditioned on the
name alone (`_persona_system`), so this runs over the whole wave (594 of the 676 in
2024HoR answered all 33 items) without speech data, adapters or a merge.

Run from research/polis/ with the research venv:
    python utas_population_eval.py --base Qwen/Qwen2.5-7B-Instruct --device cuda \
        --gt "$KOKKAI_DATA_DIR/polis/utas_ground_truth/2024HoR.json" \
        --out utas_population_7b_base.json
"""
from __future__ import annotations

import argparse
import json
import os
import random
import time

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from polis_option_logprob import (
    _persona_system, score_options, score_options_numeric,
)


def _numeric_prompt(question: str, options: list[str]) -> str:
    """The enumerated question score_options_numeric builds, kept byte-identical."""
    enumerated = "\n".join(f"{i+1}. {o}" for i, o in enumerate(options))
    n = len(options)
    return (f"{question}\n{enumerated}\n\n"
            f"上記の選択肢の中から、あなたの立場に最も近いものの番号（1〜{n}）だけを答えてください。")


class NumericScorer:
    """One forward pass per item instead of one per option.

    score_options_numeric() scores N single-token labels by running the model N times
    over the same prompt. For single-token continuations log P(label | prompt) is just
    the last prompt position's log-softmax, so all N come out of a single pass — the
    result is identical, N-times cheaper, and `verify()` asserts that on real items
    rather than taking it on faith.
    """

    def __init__(self, model, tokenizer):
        self.model, self.tok = model, tokenizer
        self._label_ids: dict[int, list[int]] = {}

    def _labels(self, n: int) -> list[int]:
        if n not in self._label_ids:
            ids = []
            for i in range(n):
                enc = self.tok(str(i + 1), add_special_tokens=False).input_ids
                if len(enc) != 1:
                    raise RuntimeError(
                        f"label {i+1!r} is {len(enc)} tokens under this tokenizer; the "
                        f"single-pass shortcut assumes one. Use --no-fast-scorer.")
                ids.append(enc[0])
            self._label_ids[n] = ids
        return self._label_ids[n]

    def score(self, system: str, question: str, options: list[str]):
        messages = [{"role": "system", "content": system},
                    {"role": "user", "content": _numeric_prompt(question, options)}]
        enc = self.tok.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt", return_dict=True)
        ids = enc["input_ids"].to(self.model.device)
        with torch.no_grad():
            logits = self.model(ids).logits[0, -1]
        lp = torch.log_softmax(logits.float(), dim=-1)
        scores = torch.tensor([lp[t].item() for t in self._labels(len(options))])
        probs = torch.softmax(scores, dim=0)
        return (int(probs.argmax().item()) + 1,
                float(sum((i + 1) * p for i, p in enumerate(probs.tolist()))))

    def verify(self, system: str, items: list[dict], n_check: int = 3, tol: float = 1e-3) -> None:
        """Assert the shortcut matches score_options_numeric on real items."""
        for it in items[:n_check]:
            ref = score_options_numeric(self.model, self.tok, system,
                                        it["question_ja"], it["options_ja"])
            arg, exp = self.score(system, it["question_ja"], it["options_ja"])
            if arg != ref.argmax + 1 or abs(exp - ref.expectation) > tol:
                raise RuntimeError(
                    f"fast scorer disagrees on {it['code']}: argmax {arg} vs "
                    f"{ref.argmax + 1}, E {exp:.4f} vs {ref.expectation:.4f}")
        print(f"[check] fast scorer == score_options_numeric on {n_check} items")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--gt", required=True, help="wave file from build_utas_ground_truth.py")
    ap.add_argument("--out", required=True, help="where to write the answer vectors (JSON)")
    ap.add_argument("--personas", type=int, default=0,
                    help="how many name-personas to administer to; 0 = every politician "
                         "who answered the full item set")
    ap.add_argument("--include", default="",
                    help="comma-separated person_ids to always include (e.g. the targets)")
    ap.add_argument("--scoring", choices=["numeric", "verbose"], default="numeric",
                    help="numeric = score the 1..N label token (recommended); verbose = score "
                         "the full option strings, which collapses toward the midpoint")
    ap.add_argument("--no-fast-scorer", action="store_true",
                    help="call score_options_numeric per option instead of the single-pass "
                         "equivalent (N times slower; use if --check ever trips)")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--device", default="auto",
                    help="'auto' = device_map=auto; 'cuda'/'cpu' pins the whole model")
    args = ap.parse_args()

    with open(args.gt, encoding="utf-8") as f:
        gt = json.load(f)
    items = [it for it in gt["items"] if it.get("question_ja") and it.get("options_ja")]
    codes = [it["code"] for it in items]

    # Only politicians with a complete vector: the rank metric compares vectors
    # elementwise, so a partial row would silently change the distance scale.
    full = [pid for pid, a in gt["answers"].items()
            if all(a["coded"].get(c) is not None for c in codes)]
    forced = [p.strip() for p in args.include.split(",") if p.strip()]
    missing = [p for p in forced if p not in gt["answers"]]
    if missing:
        raise SystemExit(f"--include ids absent from the wave: {missing}")
    pool = [p for p in full if p not in forced]
    if args.personas and args.personas < len(pool) + len(forced):
        random.Random(args.seed).shuffle(pool)
        pool = pool[: max(0, args.personas - len(forced))]
    chosen = forced + pool
    print(f"wave={gt['wave']}  items={len(codes)}  complete-vector politicians={len(full)}  "
          f"administering to {len(chosen)} personas  scoring={args.scoring}")

    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    device_map = "auto" if args.device == "auto" else {"": args.device}
    model = AutoModelForCausalLM.from_pretrained(args.base, device_map=device_map,
                                                dtype=torch.bfloat16)
    model.eval()

    fast = None
    if args.scoring == "numeric" and not args.no_fast_scorer:
        fast = NumericScorer(model, tok)
        fast.verify(_persona_system(gt["answers"][chosen[0]]["name"]), items)

    vectors: dict[str, dict] = {}
    t0 = time.time()
    for k, pid in enumerate(chosen, 1):
        name = gt["answers"][pid]["name"]
        system = _persona_system(name)
        argmax, expect = [], []
        for it in items:
            if fast is not None:
                a, e = fast.score(system, it["question_ja"], it["options_ja"])
            else:
                scorer = score_options_numeric if args.scoring == "numeric" else score_options
                res = scorer(model, tok, system, it["question_ja"], it["options_ja"])
                a, e = res.argmax + 1, res.expectation
            argmax.append(a)
            expect.append(round(float(e), 4))
        vectors[pid] = {"name": name, "argmax": argmax, "expectation": expect}
        if k % 25 == 0 or k == len(chosen):
            el = time.time() - t0
            print(f"  {k}/{len(chosen)}  {el:6.1f}s elapsed  "
                  f"{el / k:.2f}s/persona  eta {(len(chosen) - k) * el / k / 60:.1f}min",
                  flush=True)

    payload = {"wave": gt["wave"], "base_model": args.base, "config": "base",
               "scoring": "numeric-label" if args.scoring == "numeric" else "verbose-option",
               "item_codes": codes, "personas": vectors}
    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    print(f"\nwrote {len(vectors)} answer vectors -> {args.out}")
    print(f"next: python utas_rank_metric.py --gt {args.gt} --dump {args.out}")


if __name__ == "__main__":
    main()
