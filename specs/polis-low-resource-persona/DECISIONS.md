# POLIS — decision log

Running record of what was tried, what it showed, and where the direction changed.
Chronological, newest at the bottom. The point is that a null result six months from
now should be traceable to the reasoning that produced it, including the wrong turns.

Companion to [`RUNPOD.md`](RUNPOD.md) (how to run it) and
[`README.md`](README.md) (what the plan was). Snippet IDs (`P8`, `L5`, …) refer to
RUNPOD.md's index.

**Adding an entry:** date, what was decided or found, and *why* — the why is the part
that isn't recoverable from git later.

---

## 2026-08-02 — the 7B main-scale session

One rented L40S-class pod (48 GB), ~2 h of GPU. Goal: settle the table
`main.tex` §Discussion marks *pending on higher-throughput hardware*.

### Getting it running

| # | Problem | Cause | Resolution |
|---|---|---|---|
| 1 | `FileNotFoundError: dpo_pairs_full/1279.jsonl` in the granularity ablation | `bo_granularity_ablation.py` defaults `--dpo-dir` to the full corpus, which lives on the laptop SSD and was never shipped to the pod. `run_7b_bo_gpu.sh` sets it internally, so the other two protocols were unaffected | pass `--dpo-dir …/dpo_pairs_targets` (`a9a1f12b`) |
| 2 | CUDA OOM before the first trial, on a card that had just run the other protocols fine | The script built a throwaway `probe` merger only to read `n_layers`, never dropped it, then built another per granularity. Each `LayerGroupMerger` pins ~14.8 GB (13.2 GB fp32 anchor deltas + 1.6 GB bf16 base snapshot); two of those plus the 15.2 GB model overruns 48 GB | read `n_layers` off the adapter, `del` + `empty_cache` between granularities (`a9a1f12b`). Peak now ~30 GB |
| 3 | Runbook and pasted commands disagreed on `--device` | An uncommitted edit removing `--device cuda` was sitting in the working tree and got committed without being read | pin `--device cuda` everywhere, matching §4's gate and the runner's `DEVICE=cuda` (`e78d9f52`) |
| 4 | Ran `P7` (52 min, old scoring) when `P8` (12 min) was meant | "the snippet below section 6" is ambiguous — there are 15 runnable blocks and no way to name one | every block now carries an ID; `L#` laptop, `P#` pod (`df09d6e4`) |

### Results

**NLL — the method works.** Nested 5-fold CV, paired per-fold deltas:

| target | BO vs base | BO vs best-single | folds favouring BO |
|---|---|---|---|
| 1279 高市 | +0.1159 ± 0.0230 | +0.0176 ± 0.0076 | 5/5 |
| 2053 赤嶺 | +0.0820 ± 0.0178 | +0.0177 ± 0.0154 | 4/5 |
| 2289 枝野 | +0.1143 ± 0.0233 | +0.0287 ± 0.0130 | 5/5 |

14 of 15 folds. `best-single` picks are unanimous within each target.

> **Correction made mid-session.** The margin over best-single was first read as
> "inside noise" from the granularity script's *unpaired* ±0.079 spread. That spread
> is dominated by some folds being harder than others; both methods face the same
> fold, so the paired delta (±0.008) is the right statistic. Report paired.

**Granularity — a null, and the hedge dies with it.** Nested 4-fold, target 1279:
global (4 dims) `2.1557 ± 0.0792` vs layer-group (12 dims) `2.1563 ± 0.0848`. A gap
of 0.0006 against a ±0.08 spread — an order of magnitude tighter a null than the
0.5B result. `main.tex:162` already concedes granularity doesn't help at development
scale but softens it with "the natural place for the register/ideology distinction to
appear **at main scale**". That hedge is now tested and does not pay out. **Decision:
keep the concession, retire the hedge.** A null replicating across a 14× scale gap
with its proposed mechanism ruled out is a stronger statement than either.

The 112-dim upper bookend was skipped (`--groups 1 3`); 0.5B settled it decisively
(96 dims → 3.441 vs base 2.880) and it is the most expensive cell.

**UTAS — does not support a claim, under either scorer.**

The §4.4 table was checked against a dummy that answers the scale midpoint to all 33
items, using no model at all. Under the original verbose-option scoring the dummy tied
the best config on one target and beat every config on another. Under numeric-label
scoring, **0 of 12 config×target cells beat the dummy on MAE** — worse in absolute
terms than verbose.

Root cause of the first round: `evaluate_anchor` defaults to `numeric=False`, and the
verbose path softmaxes five length-normalised per-token log-probs that all sit in a
narrow band, so the expectation collapses toward the midpoint whatever the model
believes. `score_options_numeric()` had been written as the Phase-0 fix for exactly
this and was never wired through — the string `numeric` did not appear in
`bo_merge_coeffs.py`.

The numeric scorer did fix what it was meant to: `MAE(E)` and `MAE(arg)` were far
apart under verbose (1.330 vs 1.545 on 1279) and nearly coincide under numeric (1.406
vs 1.515). The distribution is sharp now — the model commits to an answer instead of
hedging at 3. It is simply wrong more often than the midpoint guess.

One place with signal: on 2053 (赤嶺, bimodal — 8 hard disagrees, 14 hard agrees, so
the midpoint is a poor guess) every config beats the dummy on `within1`, 0.455–0.667
against 0.333.

**The finding worth reporting:** NLL and UTAS are anti-correlated. `uniform` has by
far the worst NLL (2.74–2.99 vs base 2.25–2.53) yet the best or near-best UTAS on two
targets, and BO is never the best UTAS config. Optimising speech-level likelihood does
not transfer to stated policy positions. That is a real limit of the method and
stating it plainly beats burying an uninterpretable table.

### Direction change: stop chasing absolute MAE

Two scorers both failed to clear a constant floor, so the next move is not a third
scorer. Two facts reframed it:

* the persona is conditioned on the **name alone** (`_persona_system`), so UTAS needs
  no speech, adapter or merge — it can run over the whole wave;
* the wave has **594 politicians with complete 33-item vectors, 573 of them distinct**,
  against which only 3 were ever used.

New instruments (`utas_population_eval.py`, `utas_rank_metric.py`):

1. **Name-swap divergence.** How far simulated vectors move when only the name
   changes, relative to how far the real politicians differ. A ratio near 0 means the
   persona is *inert* and a flat §4.4 table says nothing about the merge — this
   separates "wrong persona" from "no persona", which one-target MAE cannot.
2. **Rank of the true politician.** Distance from a simulated vector to all 594 real
   ones; where does its own politician land. Only the ordering matters, so it survives
   everyone clustering near the midpoint — the regime that sank MAE.

> **Design correction, caught by a known-answer fixture.** The null for the rank
> metric is *not* the 50th percentile. A constant vector sits near the population
> centroid and is therefore closer than average to everyone: an all-3 predictor scores
> the **68.4th** percentile on this wave for free. The constants are now printed as
> rows in the rank table, and the claim to make is "ranks above every constant".

### Scale: targets before anchors

Asked whether to add personas. They are two different axes:

* **Targets** (held-out, evaluated on) — n=3 today. Needs DPO pairs per target, no
  training. **633 politicians** are in both the 2024HoR wave and the organized speech
  corpus, 437 with ≥1 MB of text. ~10 min GPU per target for nested CV. **This is the
  priority**: n=3 cannot carry a population claim, and per-fold consistency is not a
  substitute because folds are slices of one person.
* **Anchors** (trained, merged from) — 4 today, spec §2.4 assumed 8. Each is a
  training run *and* ~3.3 GB of VRAM: 8 anchors = 26.4 GB of deltas + 15.2 GB model
  exceeds a 48 GB card, so it needs an 80 GB card or bf16 deltas. The one argument for
  it is that the granularity null may be a 4-anchor artefact — with four sources to
  blend there may be nothing for per-depth weighting to differentiate. Speculative and
  costly. **Deferred.**

> **Framing problem to fix.** Ranked by speech volume among the 633, the current
> targets are **#9 (枝野), #17 (高市), #20 (赤嶺)** — the top 3% of the corpus. The
> paper is about *low-resource* simulation. Sampling targets from ranks 200–600 would
> raise n and put the method on its actual thesis. Expect the margin to shrink; a
> smaller margin on genuinely data-poor politicians is the stronger result.

### Population sweep result — the §4.4 protocol does not measure persona fidelity

594 personas under base 7B, 10.7 min, 1.08 s/persona. The fast scorer's self-check
against `score_options_numeric` passed.

**Name-swap divergence 0.209.** Simulated vectors spread `0.236` against the real
politicians' `1.132` — changing the name moves the answers about a fifth as much as
the politicians actually differ from each other. Not literally inert (0 of 19 900
persona pairs are identical on expectation), but weak. Per item: median sd across all
594 personas is `0.186` against the real `1.013`, and **9 of the 33 items have
sd < 0.05** — for those, the model returns the same answer whoever you say it is.

**Rank at chance.** Median percentile `52.1%` (expectation) against a measured
constant floor of `50.1%`; top-1 `0.002`, which is exactly 1/594. The model cannot
identify which politician it is simulating.

**Systematic skew.** Simulated mean `2.271` vs real `2.763` — the personas sit
uniformly toward "agree" regardless of who they are. The three targets' simulated
means span `2.155`–`2.406`; their real means span `2.636`–`3.364`. 赤嶺 (JCP) comes
out at `2.211` against a real `3.364`, nearly indistinguishable from 高市's `2.155`.

**Conclusion.** The flat §4.4 table is a property of the instrument, not evidence
about the merge. Name-prompted persona conditioning plus option-logprob survey scoring
does not carry politician identity at this scale, so UTAS results cannot support a
claim in either direction. The NLL result stands on its own and is unaffected.

> **Correction to the earlier design note.** The rank null *is* 50% on a full sweep,
> not 68%. A name-independent vector induces one fixed distance ordering, so as the
> persona ranges over the whole candidate set its rank takes every value exactly once
> — the five constant rows all land on `50.1%`, as they must. The 68.4% seen earlier
> came from a fixture with only 60 personas against 594 candidates: sampling noise,
> not the centroid effect claimed. The constant rows remain the right comparison
> because they measure the floor under whatever subsampling was actually used.

### The merge does not inject identity either — §4.4 closed

`P12`: same single split, per-config vectors saved, ranked against the 594.

| target | base | uniform | best-single | BO | best constant |
|---|---|---|---|---|---|
| 1279 高市 | 34.3% | 37.2% | 40.2% | 39.4% | constant(1) → 67.5% |
| 2053 赤嶺 | 5.6% | 4.2% | 2.7% | 2.7% | constant(5) → 97.5% |
| 2289 枝野 | 47.5% | 25.4% | 43.8% | 44.9% | constant(5) → 81.3% |

All twelve cells at or below chance; a constant beats every model config on every
target. BO against base is +5.1 / −2.9 / −2.6 points — the merge makes it *worse* on
two of three.

赤嶺 (JCP) is the clearest case. His real answers cluster at 5 (mean 3.364), so
`constant(5)` ranks him at the 97.5th percentile, while all four model configs put him
in the **bottom 3–6%** — actively anti-correlated, not merely uninformative. Consistent
with the population sweep, where simulated-赤嶺 (2.211) was nearly identical to
simulated-高市 (2.155). The constants swing from 2.7% to 97.5% depending on which
extreme a target occupies, while every config clusters near the population's low-middle:
the simulations do not move to where the politician is.

**Decision: stop work on the UTAS metric.** Two scorers, a population control and a
rank metric all agree it does not carry politician identity at this scale, with or
without the merge. The paper reports it as a limitation with the diagnostic attached,
and the headline rests on NLL.

> **Strength caveat.** Per-target rank is one draw and these are noisy. Three targets
> cannot carry a p-value — "all below chance" is p ≈ 0.125 on sign alone with each
> target as one observation. The claim is *no evidence the merge injects identity*,
> not proof it does not. Another argument for n≈30.

### Open

- [ ] Expand targets to n≈30, sampled across the speech-volume range, not the top.
      Every negative above is limited by n=3 more than by anything else.
- [ ] Rewrite `main.tex` §Discussion: table no longer pending — NLL confirms, UTAS
      does not discriminate. Retire the main-scale hedge in `sec:granularity`.
- [ ] Decide whether the anti-correlation between NLL and UTAS is a headline finding
      or a limitation paragraph.
