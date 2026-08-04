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

### Anchor self-test — the chain breaks before the merge

Asked whether training the anchors on UTAS answers would help. Ran the control that
decides it first: the anchors have their own survey answers (152 岸田 and 2377 塩川 in
2024HoR; 3631 福島 and 5520 上田 in 2022HoC), and their adapters were trained on
12k–20k of their own speeches. Maximum resource, own answers, no merge, no
low-resource approximation — if the chain works anywhere it works here.

| anchor | n | constant-3 | adapter | base | beats constant? |
|---|---|---|---|---|---|
| 152 岸田 | 33 | 0.697 | 0.816 | 0.873 | no (+0.119) |
| 2377 塩川 | 22 | **1.682** | 2.218 | 1.998 | no (+0.536) |
| 3631 福島 | 37 | **1.243** | 0.980 | 1.085 | **yes (−0.263)** |
| 5520 上田 | 37 | 0.514 | 1.215 | 1.286 | no (+0.701) |

**1 of 4 beats a constant.** And the adapter contributes nothing consistent: MAE(E)
favours it 3–1, but `within1` favours *base* 2–1 and `exact` is 1–1 with two ties. On
塩川 the adapter is worse than base outright. Note 岸田 and 上田 answer 3 to half the
items, so their constants are near-unbeatable and they discriminate little; the
informative pair is 塩川 and 福島, which split one bad loss and one win.

Consistent with the population sweep: 塩川's real mean is 3.32 while the model's
natural output sits at ~2.27 and the adapter does not drag it up. 福島's real mean is
2.89 — close to where the model already is, which is most of why it wins.

**Decision: do not train anchors on UTAS.** The anchors' answers are not the targets'
answers, so it would not be label leakage — but the 33 items are identical, so it
would teach the task format, the scale semantics and the population answer
distribution. The claim would degrade from "personas fitted to speech encode ideology
an independent instrument can read" to "models trained on surveys answer surveys", and
the merge would then transport survey-answering *competence*, masking the very
distinction this session established. Legitimate only as a labelled diagnostic — an
upper bound isolating whether the merge can transport ideology at all — never as
evidence for the method.

### Target expansion to n=33 — selection done

Open item 1. Selection and protocol settled; export blocked on a filesystem
permission (see below).

**Framing correction.** The earlier note that the three targets being data-rich
contradicts the *low-resource* title was too strong. `HANDOVER.md:465` has a fair
defence: the BO tunes on 30 utterances regardless of how much the target has, so the
*method* is low-resource either way. The untested axis is not quantity of data but
**kind of politician** — 高市/赤嶺/枝野 are all nationally prominent, and prominent
members give prepared set-piece speeches while backbenchers ask committee questions.

**Eligibility.** Complete 33-item UTAS vector, a speech directory, not an anchor, not
an existing target → **550 eligible**, 517 with the ≥60 pairs a 30/30 split needs.
Pair yield is ~1:1 with speech records up to the 300 cap (measured 41→40, 81→81,
149→147, 297→297), so speech count is a direct proxy.

**Sampling: 6 log-spaced bands, 5 each** (`random.Random(20260802)`), recorded in
[`targets_n30.json`](targets_n30.json). Chosen over a low-profile-only or uniform-random
draw because it yields a *curve* — BO advantage against target prominence — rather than
one more mean. Party spread: LDP 11, CDP/DPJ 10, Ishin 3, Komeito 2, JCP 2, DPP 2.

**Protocol: budget 30 / test 30**, identical to the committed runs so the 3 existing
and 30 new targets pool into one analysis. Targets need prompt/chosen only — no Gemini
`rejected` step, since a held-out target gets no adapter of its own — so export is
CPU-only and takes minutes.

> **Blocker.** `/mnt/wsl/wsldata/kokkai_data` is entirely `root:root 755`. Every
> operation this session was a read, which is why it surfaced only now. The export
> needs `sudo chown ken:ken /mnt/wsl/wsldata/kokkai_data/polis/dpo_pairs_targets` —
> one directory, enough to create the new files.

Cost once unblocked: nested 5-fold at ~10 min/target ⇒ **~5 h GPU for 30**. The
single-split protocol is no longer needed — it existed to carry the UTAS half, which
is now closed.

### Considered and rejected: dropping the "3" answers

Hypothesis: politicians answer 3 (no stance) on policies they don't care about and
take clear positions elsewhere, so constant-3 wins for a reason unrelated to the
model's quality — evaluate only on non-3 items.

**The premise is correct.** 31.7% of all 594×33 answers are 3; it is the modal
response. 64 of 594 members answer 3 to more than half the items (one to all of them),
median 30%. Per item the 3-rate ranges 9%–61%.

**The conclusion does not follow.** Tested on the population dump, with the constant
baseline recomputed on each filtered set:

| filter | items | model | best const | model wins |
|---|---|---|---|---|
| all | 33 | 1.137 | 0.879 | 9% |
| drop items >35% population 3-rate | 19 | 1.111 | 0.895 | 25% |
| drop answers where truth = 3 | 22.6 | 1.162 | 1.000 | 29% |
| extremes only (truth 1 or 5) | 13.5 | 1.395 | 1.455 | 44% |

The win rate climbs to 44%, but **the model's own MAE gets worse** (1.137 → 1.395).
The gap narrows because the baseline degrades, not because the model improves. Were
the hypothesis right — good on clear stances, confused on the mushy middle — model
error would *fall* when the 3s are removed. It rises, and even on the most favourable
cut the model loses on 56% of politicians. Consistent with the population sweep: the
model answers roughly the same thing for everyone (mean 2.271 vs real 2.763,
name-swap 0.209), so its error is flat across item types.

**Methodology note for the future.** Per-*item* filtering (drop items the whole
population answers 3 to) is defensible — a property of the instrument, applied
identically to every politician and method, standard non-discriminating-item removal.
Per-*answer* filtering (drop items *this* politician answered 3 to) selects the
evaluation set on the label being predicted; not fatal if the baseline is recomputed
on the same subset, but it is a labelled subgroup analysis at best. The substantive
objection is stronger than the statistical one: **knowing when a politician abstains
is part of simulating them**, so removing those items deletes the more politically
interesting half of the task.

The fence-sitting rate is worth reporting as a finding — it is part of why survey
agreement is a hard metric for persona work — but not as a filter.

### The prominence gradient — UTAS measures knowledge, not format

Asked whether the UTAS failure is a format-mismatch problem, and whether to tune the
BO on a subset of survey items or train anchors on survey data.

**The formats really are far apart.** DPO training prompt: `国会議員「高市早苗（自由民主
党・無所属の会）」です` + ~500 chars of committee exchange → free-form ~280-char reply.
UTAS eval: `国会議員、高市早苗です` (no quotes, no party) + a bare proposition → one token
from `{1,2,3,4,5}`.

**But format is not the bottleneck.** Under that identical prompt and scoring,
**岸田文雄 ranks at the 96th percentile**, 中谷元 and 河野太郎 at 82%, 麻生 63%. Base model,
no adapter. The gradient over the whole wave:

| quintile by speech volume | median speeches | median rank pct |
|---|---|---|
| most prominent | 3450 | 58.0% |
| 2nd | 1372 | 53.7% |
| 3rd | 579 | 53.4% |
| 4th | 218 | 45.7% |
| least prominent | 47 | 47.5% |

So the instrument reads positions correctly when the model has the knowledge. It has
none for backbenchers — the bottom two quintiles sit below chance. **The failure is
knowledge coverage, not elicitation.**

**Proposal A (tune BO on some UTAS items, test on the rest): rejected.** A
nearest-neighbour lookup — most similar politician among the other 593 on 16 tuning
items, copy their held-out 17 — scores MAE **0.647**, against best-constant 0.824 and
the 7B model's 1.137, beating the constant for 396/594. The setup is solved without an
LLM, speech, adapters or a merge. It also presumes the target's survey answers, which
the low-resource scenario does not have; if it did, the speech pipeline would be
unnecessary.

**Proposal B (train anchors on UTAS): rejected for now.** The waves separate cleanly —
29 of 33 item codes are shared but **zero questions have identical text**, the codes
being positional — so cross-wave training would genuinely hold out the questions. Two
obstacles: no anchor appears in both waves (152/2377 are 2024HoR only, 3631/5520 are
2022HoC only), so at most half the anchors could be trained; and it targets format
adaptation, which 岸田's 96% shows is not what is failing.

**Reframing.** POLIS's job is to inject knowledge the base model lacks about
politicians it has never encountered. That makes the rank metric a *good* instrument
rather than a broken one, with a falsifiable prediction: **if the method works, its
targets should move from the backbench level (~47%) toward the prominent level (~58%)**.
`P12` found no such lift on 3 targets; the n=33 run measures it properly, and the
volume-stratified sample is already the right design.

## 2026-08-03 — the n=33 run: the population claim lands, the kill criterion does not

`P13` on one L40S-class pod, ~6 h. Nested 5-fold CV with `ICL=1` over all 33 targets —
the 3 originals plus the 30-target volume-stratified expansion. All 33 finished `rc=0`.

Two `rc=1` lines survive above the good block in `n33_target_{1279,2053}.log`: the
OOM-killed first attempt from before `86cb00c7`. The runner appends, so read the *last*
block in each file.

### Reproduction — the environment did not move

| target | committed 2026-08-02 | n=33 re-run |
|---|---|---|
| 1279 高市 | +0.0176 ± 0.0076 | +0.0171 ± 0.0058 |
| 2053 赤嶺 | +0.0177 ± 0.0154 | +0.0217 ± 0.0139 |
| 2289 枝野 | +0.0287 ± 0.0130 | +0.0256 ± 0.0132 |

Same sign and magnitude, inside the per-fold spread. The drift is `86cb00c7`: slicing
logits before the fp32 cast changes the reduction order, moving NLL in the last digits
and sending the GP down a slightly different trajectory. The 30 new targets are
comparable to the committed results.

### NLL vs the weight-space baselines — the population claim lands

**BO beats best-single on 33/33 targets** (mean `+0.0265`, median `+0.0232`, sd
`0.0106`; sign test p ≈ 2e-10) and base on 33/33 (`+0.1535`). n=3 was not a fluke of
three prominent politicians.

More important for the title: **the margin does not decay with target prominence.**

| band | median speeches | BO vs best-single | BO vs ICL |
|---|---|---|---|
| originals | — | +0.0215 | +0.0239 |
| 3000+ | 5855 | +0.0321 | +0.0077 |
| 1000–3000 | 1817 | +0.0258 | +0.0374 |
| 500–1000 | 693 | +0.0262 | −0.0476 |
| 250–500 | 413 | +0.0229 | −0.0660 |
| 120–250 | 166 | +0.0263 | −0.1470 |
| 60–120 | 104 | +0.0286 | −0.0250 |

The 2026-08-02 worry — that the method might only work on data-rich set-piece speakers —
does not materialise. Backbenchers with 82–166 speeches get the same margin as 野田佳彦
with 8 219.

### The kill criterion is not met

**BO beats ICL on 17/33 targets. Mean `−0.0343`, median `+0.0050`, fold-level 79/165.**
Parity. `README.md:79` calls baseline 2 the kill criterion — *"if it matches POLIS the
method is unnecessary"* — and on its own terms it matches.

Fold hygiene checked before believing it: `nested_cv` builds the prefix from `dev` and
scores `te` at restored base weights (`bo_merge_coeffs.py:219`), so ICL never sees the
test fold. Not leakage.

**Where ICL wins: repetitive speakers.** Median nearest-neighbour similarity between a
target's own 30 utterances, against ICL's advantage:

```
corr(within-target utterance similarity, ICL gain over base) = +0.787
corr(within-target utterance similarity, BO vs ICL)          = -0.702
corr(log speech count,                   BO vs ICL)          = +0.324
```

Three targets carry most of the negative mean — 1543 手塚 (−0.329, self-similarity
0.40), 110 田野瀬 (−0.325, **0.55**), 3022 津島 (−0.324, 0.23) — against ~0.18 typical.
When a politician says nearly the same thing every time, 24 in-prompt examples approach
a lookup table. Drop the two most repetitive and the mean is `−0.015` with BO at 17/31:
still parity, not a win. 3022 is the honest exception — a large ICL gain at ordinary
self-similarity — so repetition is the main mechanism, not the only one.

**Framing, not a rescue.** ICL pays a ~9k-token prefix at every inference and needs the
target's speeches at serving time; the merge pays once and ships a 130 MB adapter. That
is a real deployment distinction and it is a *cost* argument. It does not restore the
fidelity claim at `README.md:13`, which says the merge beats prompting.

### Direction: score the merge and the prefix together

A tie between a weight-space and a prompt-space method has two readings, and no
prefix-free row separates them: they carry the same information, or they carry
different information and nothing ever stacked them.

`nested_cv` now scores `BO+ICL` and `best-single+ICL` whenever `--icl` is on — the same
merged weights with the prefix in front of each held-out prompt, reusing the merger
state already applied, so it costs two extra eval passes per fold and no extra trials.
**`BO+ICL vs ICL` decides it**; `best-single+ICL` is the control, without which a
positive result would only show that *some* weight-space adaptation composes with
prompting rather than the tuned merge specifically. Runbook §9, `P14`/`P15`.

Coefficients are still fitted on prefix-free `dev` and only scored under the prefix —
the merge is used in a regime it was not tuned for. Tuning inside the prefix is ~5×
the cost (every trial re-scoring `dev` behind the prefix) and is not worth buying until
this says the merge contributes at all.

> **Process note.** `P13` kept its fitted merges only in memory, so adding one row costs
> a full ~7 h re-derivation of every BO rather than a few eval passes. `--dump-picks` /
> `DUMP_PICKS=` now writes the per-fold coefficient matrices. Set it on every nested run.

## 2026-08-03 (later) — `P15`: the merge composes with prompting

Same pod, 5 h 48 m, all 33 targets `rc=0`. Nested CV with the combined rows.

**The kill criterion is answered in the method's favour.** Exact figures, from the
`--dump-picks` JSONs rather than the rounded log lines:

| comparison | mean | median | wins | sign p |
|---|---|---|---|---|
| **BO+ICL vs ICL** | **+0.0694** | +0.0676 | **33/33** | 2.3e-10 |
| BO+ICL vs BO | +0.1036 | +0.0676 | 33/33 | 2.3e-10 |
| best-single+ICL vs ICL | +0.0562 | +0.0554 | 33/33 | 2.3e-10 |
| **BO+ICL vs best-single+ICL** | **+0.0132** | +0.0163 | **30/33** | 1.4e-06 |
| BO vs ICL *(the P13 tie)* | −0.0343 | +0.0050 | 17/33 | 1.00 |

Prompting and merging were never alternatives. Merged weights *plus* the prefix beat
the prefix alone on every target, fold-level 160/165. The `P13` tie was an artefact of
forcing a choice between two things that stack.

**The decomposition that must not be buried.** Most of the stacking gain comes from
*any* merge: `best-single+ICL` takes +0.0562 of the +0.0694, leaving **+0.0132 for the
tuned coefficients** — half the +0.0265 the BO holds prefix-free. Tuning still
contributes (30/33, p=1.4e-06), but the prefix absorbs about half of what it was
buying. Reporting only `BO+ICL vs ICL` would overstate the BO's specific contribution.

**Where the tuned merge loses under the prefix** — 3022 津島 (−0.0784), 110 田野瀬
(−0.0272), 1543 手塚 (−0.0106) — is exactly the three boilerplate speakers where ICL
beat BO by ~0.33 prefix-free. Coefficients are fitted on prefix-free `dev` and used
under the prefix, so where the prefix does most of the work the BO optimised the wrong
objective. The regime mismatch documented in `nested_cv`'s docstring, showing up where
it was predicted to.

**Decision: reword the hypothesis, don't reinterpret it.** `README.md:13` claims the
merge *beats* prompting. It does not — prefix-free they tie. The supported claim is
that **the merge composes with prompting, and the best configuration on every one of 33
targets uses both**. That is more interesting than the original and it is what the data
says; quietly reading the old sentence as if it meant this would not survive review.

**Tune-under-the-prefix is now worth its cost.** Before `P15` it was a fishing
expedition; now it has a specific prediction — the three regime-mismatch losses should
disappear. Full 33 is ~29 h at 5×; the three failures plus a matched handful of
controls answers it in ~4 h.

## 2026-08-03 (later still) — baseline 3 beats the method

Same pod. Spec §4.3 baseline 3 (`--objective sft`: LoRA on the target's own dev fold)
had never run on a GPU. It ran, and it wins.

### Getting a fair number out of it

The script's defaults (2e-4, 8 epochs) scored **3.2745** against base 2.2684 — a full
point *worse* than not training, from memorising 24 examples. Reporting that would have
been a strawman, which is exactly what the script's own design note warns against.

The grid pilot on 1279 found a 50× spread across six cells (2e-4/8ep → 3.11 on the same
fold where 5e-5/2ep → 2.03). **Selection bias turned out negligible**: the grid's
best-held-out mean was 2.1119 and a *fixed* 5e-5/2ep gives 2.1120, because that cell won
4 of 5 folds outright. So the n=33 run used fixed hyperparameters and carries no
test-set-selection asterisk. 5e-5/2ep transferred from 1279 to all 33 and won on every
one.

### The result

33 targets, 40 min, fixed 5e-5 / 2 epochs, `--icl` for the combined row:

| comparison | mean | median | wins | p |
|---|---|---|---|---|
| **SFT vs BO** | **+0.0627** | +0.0423 | **33/33** | 2.3e-10 |
| SFT vs best-single | +0.0892 | +0.0707 | 33/33 | 2.3e-10 |
| SFT vs ICL | +0.0284 | +0.0442 | 29/33 | 1.1e-05 |
| **SFT+ICL vs BO+ICL** | **+0.0355** | +0.0294 | **33/33** | 2.3e-10 |
| SFT+ICL vs ICL | +0.1049 | +0.1000 | 33/33 | 2.3e-10 |

**Direct fine-tuning on 24 utterances beats the anchor merge on every target, with and
without the prefix.** The best configuration in the whole study is `SFT+ICL`. The
hypothesis at `README.md:13` — that the merge beats fine-tuning directly on the sparse
data — is false at this budget.

Three defences, all of which fail:

* *SFT's hyperparameters were tuned.* They were picked on one target and transferred; the
  BO gets 40 trials per fold per target. POLIS is the more heavily tuned side.
* *The merge is cheaper.* SFT is 11 s/fold at 7B. The merge needs four anchor training
  runs plus 40 BO trials per fold, and both ship an adapter — identical serving cost.
* *NLL is not the only metric.* The other instrument, UTAS, was closed as uninformative
  earlier the same day. There is no second axis where the merge leads.

**The one real asymmetry.** The prefix adds **+0.1036** on top of BO but only **+0.0765**
on top of SFT. The merge and prompting carry more complementary information than SFT and
prompting do — consistent with SFT and the prefix both learning from the same 24
utterances while the merge imports something from the anchors. It is a genuine mechanism
and it still loses.

### Direction: the budget axis, the last place a positive claim could live

30 utterances was never derived from anything, and the paper's thesis is *low-resource*.
The open question is whether there is a budget below which SFT collapses and the merge
does not. The mechanism is concrete and falsifiable: **the BO fits 12 coefficients, LoRA
fits ~20M parameters**, so SFT should degrade far faster as data shrinks.

`--dev-cap N` (both scripts, via the shared `cap_dev`) trains on the first N instances of
each dev fold **with the test fold unchanged**, so every budget's numbers pair with each
other *and* with the committed 24-instance runs, and the small budgets are nested subsets
of the large ones — no sampling noise between points on the curve. Runbook §10.

If the curve is flat, the paper is a negative result: a thorough n=33 protocol showing
anchor merging beats every *merge* baseline while losing to the simplest fine-tuning
alternative, plus the UTAS instrument analysis. That is publishable and honest, but it is
a different paper, and the decision should be made deliberately rather than by omission.

## 2026-08-04 — DPO, and the confound it exposes

Baseline 4 ran: 33 targets, 70 min, fixed 5e-5 / 2 epochs, same folds. Full ordering,
mean held-out NLL over the 33:

```
SFT+ICL 2.0687 · DPO+ICL 2.1013 · BO+ICL 2.1042 · best-single+ICL 2.1174
SFT 2.1452 · ICL 2.1736 · DPO 2.2073 · BO 2.2078 · best-single 2.2343
base 2.3613 · uniform 2.7689
```

**DPO ties the merge.** BO wins 24/33 (p=0.014) with means identical to four decimals
(+0.0006): DPO loses often and narrowly, wins rarely and widely. With the prefix it is a
clean tie (14/33, p=0.49). DPO beats best-single 33/33, so it is a competent baseline.

### The confound

The anchors were trained with **DPO** (`train_one_politician_persona.py`, `DPOTrainer`,
beta=0.1). That splits every comparison in two:

| | result |
|---|---|
| objective-**matched** — merge-of-DPO-anchors vs DPO-on-sparse-target | merge wins **24/33** |
| objective-**mismatched** — merge-of-DPO-anchors vs SFT-on-sparse-target | merge loses **0/33** |

So the SFT defeat may not be "merging loses to fine-tuning" but "**SFT is the better
objective at a 24-instance budget, and the anchors were built with the other one**".
Consistent with everything else: DPO ≈ BO ≈ merge-of-DPO-anchors, with SFT 0.062 below
both. DPO needs a synthesised `rejected` side (the Gemini caricature pipeline), which on
little data may add noise rather than signal.

**Decision: probe before retraining.** `train_anchor_sft.py` trains one SFT anchor
(`P18`), reusing `sparse_target_baselines.train_lora_on` so an SFT anchor differs from the
sparse-SFT baseline in data volume alone. If it transfers better than the DPO anchor,
retrain all four; if not, the negative result stands and four training runs are saved.

### Would more anchors help? — what the 165 fitted merges already say

Asked whether n=4 anchors is the limitation. The `--dump-picks` matrices answer part of it
without new GPU time.

**Anchor choice does not track ideology — it inverts.** Best-single winner by target party:

| target party | picks |
|---|---|
| 自民 (LDP) | 塩川 (**JCP**) 53%, 上田 29% |
| 共産 (JCP) | 岸田 (**LDP**) 80% |
| 公明 (Komeito) | 塩川 (JCP) 70% |
| 立憲 (CDP) | 上田 50%, 岸田 50% |

If anchors carried ideology, an LDP target would not be best served by the Communist
anchor 62 times out of 165. This is the 0.5B "adapters encode register, not ideology"
concession, now confirmed at 7B with n=33 and a party breakdown. It also explains why the
BO only buys +0.0265 over best-single: it is blending registers, not interpolating
positions.

**The BO already discards capacity at n=4.** Mean coefficient per anchor across 165 folds:
岸田 0.245, 塩川 0.294, 上田 0.188, **福島 0.135 — near-zero in 40% of folds**. One of four
anchors is being switched off most of the time. That is what diminishing returns look
like, and it is the main reason to doubt that 20 anchors would change the result.

**What more anchors would cost, if pursued anyway:**

* *VRAM* — deltas are fp32, ~3.3 GB per anchor. 8 anchors = 26.4 GB + 15.2 GB model, which
  fits 48 GB only in bf16; 20 anchors is 66 GB fp32 and infeasible without storing LoRA
  factors and computing ΔW per module on the fly.
* *Dimensionality* — dims = n_anchors × n_groups. 20 × 3 = 60, past the point where
  `make_sampler` abandons GP for TPE, and fitting 60 coefficients on 24 instances would
  overfit. The 0.5B granularity bookend already showed high-dim coefficient search
  actively corrupting the model (96 dims → 3.441 vs base 2.880). Realistically it needs
  `n_groups=1` or an anchor-selection step before the BO.
* *Training* — one run per anchor.

**Decision: measure the slope with the anchors already trained (`P19`) before training
any.** Nested CV at 2, 3 and 4 anchors, with the subset rotated across targets so the
curve is not tied to one combination. If 3→4 is already flat, extrapolating to 20 is not
worth a training run; if it is still climbing at 4, 8 anchors becomes the obvious next
build and the VRAM work is justified. Needs no new code — `--adapters` is already explicit.

## 2026-08-04 (later) — `P18`: the anchors were the problem, and identity may not exist

One SFT anchor (152 岸田, same 1500 pairs the DPO anchor was trained on, so the only
difference is the objective), applied at **coefficient 1.0 with no target data and no
tuning**, on the 5 probe targets:

| target | base | best-single (DPO) | BO (tuned, 4 anchors) | SFT on target's own 24 | **SFT anchor, untuned** |
|---|---|---|---|---|---|
| 1083 | 2.4200 | 2.3100 | 2.2875 | 2.2392 | **2.2697** |
| 1279 | 2.2684 | 2.1701 | 2.1531 | 2.1129 | **2.1218** |
| 2053 | 2.2520 | 2.1878 | 2.1661 | 2.1467 | **2.1452** |
| 2189 | 2.3690 | 2.2386 | 2.1962 | 2.1671 | **2.1204** |
| 2289 | 2.5302 | 2.4446 | 2.4190 | 2.3872 | **2.3726** |

* vs its DPO twin: better on **5/5**, mean **+0.0714** — larger than the BO's entire
  margin over best-single (+0.0265).
* vs the tuned 4-anchor DPO merge: better on **5/5**, +0.0384.
* vs SFT on the target's own 24 utterances: **level** (3/5, +0.0047).
* vs `BO+ICL`, the best merge configuration in the study: **level** (−0.0006).

So the SFT defeat was substantially an artefact of the anchors' objective. But the
stronger reading is the one that changes the paper: **an adapter trained on a different
politician, applied untuned, matches fine-tuning on the target's own data.** Whatever
transfers here is not specific to the target.

That is now the third independent measurement pointing the same way:

1. best-single picks invert party (LDP targets pick the JCP anchor 53%, JCP targets pick
   the LDP anchor 80%);
2. UTAS rank-at-chance with name-swap divergence 0.209;
3. a foreign anchor matching target-specific fine-tuning.

**Decision: run the identity control before anything else.** Train the other three SFT
anchors and score each alone on the same 5 targets (`P18` with `ANCHOR=` and
`SKIP_DPO=1`). If all four land within noise, the transferred quantity is Diet-speech
*register* and persona identity is not being learned at all — which is the paper's
central finding and makes the merge machinery beside the point. If they separate, or
different targets prefer different anchors, identity survives and the DPO objective was
destroying it; then the merge deserves a full re-run on SFT anchors.

## 2026-08-04 (later still) — SFT anchors restore the hypothesis

Ran the identity control and, on the same anchors, the full nested protocol. Two results
that point in different directions and are both real.

### The register decomposition — four anchors, five targets

Each SFT anchor applied alone at coefficient 1.0:

| target | base | 岸田(LDP) | 塩川(JCP) | 福島(SDP) | 上田(DPJ) | spread | gap from base | best |
|---|---|---|---|---|---|---|---|---|
| 高市 LDP | 2.2684 | 2.1218 | 2.1263 | **2.1125** | 2.1369 | 0.0244 | 0.1559 | 福島 |
| 赤嶺 JCP | 2.2520 | 2.1452 | **2.1128** | 2.1342 | 2.1469 | 0.0341 | 0.1392 | 塩川 (JCP) |
| 枝野 CDP | 2.5302 | 2.3726 | 2.3765 | 2.3593 | **2.3376** | 0.0389 | 0.1926 | 上田 (DPJ) |
| 武田 LDP | 2.3690 | **2.1204** | 2.1578 | 2.1539 | 2.1326 | 0.0374 | 0.2486 | 岸田 (LDP) |
| 山崎 Komeito | 2.4200 | 2.2697 | 2.2664 | **2.2647** | 2.2661 | 0.0050 | 0.1553 | 福島 |

**Anchor choice explains ~16% of what a persona adapter buys** (mean spread 0.0280 against
a mean gap from base of 0.1783). Five-sixths is identical whichever politician the adapter
was trained on: that quantity is Diet-speech *register*, and it is the single largest
effect anywhere in this project. It stands regardless of everything below, and 上田 (4 118
speeches) transferring as well as 岸田 (20 418) rules out "the model already knows this
person" as the explanation.

The residual changed sign, though. Three of five targets prefer an ideologically matching
anchor (JCP→JCP, CDP→DPJ, LDP→LDP) where the **DPO** anchors had inverted party. n=5,
p≈0.10 — suggestive only, which is why `anchor_affinity.py` measures it at n=33.

### The hypothesis holds at matched objective

Nested CV, 5 targets, SFT anchors, versus the committed DPO-anchor run and the SFT
baseline:

| target | base | best1 | BO | BO+ICL | BO (DPO anchors) | sparse SFT | SFT+ICL |
|---|---|---|---|---|---|---|---|
| 高市 | 2.2684 | 2.1105 | 2.0811 | **2.0658** | 2.1531 | 2.1129 | 2.0964 |
| 赤嶺 | 2.2520 | 2.1170 | 2.0984 | **2.0880** | 2.1661 | 2.1467 | 2.1241 |
| 枝野 | 2.5302 | 2.3388 | 2.3240 | **2.3159** | 2.4190 | 2.3872 | 2.3617 |
| 武田 | 2.3690 | 2.1204 | 2.0937 | **2.0686** | 2.1962 | 2.1671 | 2.1218 |
| 山崎 | 2.4200 | 2.2813 | 2.2277 | **2.1870** | 2.2875 | 2.2392 | 2.1959 |

All 5/5:

* `BO` vs `best-single`: **+0.0286** — indistinguishable from the +0.0258 it bought on DPO
  anchors. **The BO's contribution is independent of the anchor objective**, which is what
  makes this a fix rather than a different method.
* SFT anchors vs DPO anchors, same protocol: **+0.0794**.
* `BO` vs sparse SFT: **+0.0456**. `BO+ICL` vs `SFT+ICL`: **+0.0349**.

**`README.md:13` holds after all** — an optimised merge of data-rich anchors does beat
fine-tuning directly on the sparse data, once both sides use the same objective. The 0/33
defeat was measuring the anchors' training objective, not merging. Note the baseline is
the favoured side: sparse SFT uses 5e-5/2ep chosen by a grid, the anchors 5e-5/1ep chosen
by nobody.

The prefix's role inverted too: **+0.0200** on top of the SFT-anchor merge against +0.0307
on top of sparse SFT, the reverse of the DPO-anchor case (+0.1036 vs +0.0765). Better
anchors already carry much of what the prompt was supplying.

### How to hold both results at once

They are not in tension, and the paper needs both:

* **Most of what any of these methods deliver is register.** ~84% of a single adapter's
  benefit is anchor-independent; a foreign anchor matches target-specific fine-tuning.
* **The part that is left responds to method.** Merging beats the best single anchor by a
  consistent +0.027 across both anchor families, and the merge beats sparse fine-tuning
  once the objective is matched.

Reporting only the second would overclaim; reporting only the first would miss that the
method works. The register decomposition is also what makes the small margins
interpretable — they are small because they are competing over a sixth of the effect.

> **Process note.** The confound was found only because baseline 4 was run. Baselines 3
> and 4 sat unimplemented through the whole 0.5B phase and the first 7B session, and the
> 33/33 defeat that looked fatal for two days was an artefact of never having compared
> like with like. Run every baseline in the spec, early.

### Open
- [ ] Full 33-target nested + ICL on SFT anchors (~6 h) — the paper's main table. The
      5-target result is where the SFT defeat stood before it held at 33/33.
- [ ] `anchor_affinity.py` at n=33: does the preferred anchor track party once the
      anchors are SFT-trained? Decides whether the 16% residual is identity or noise.
- [ ] Re-run the granularity ablation on SFT anchors: the null was measured on anchors
      whose deltas fought each other (uniform merge 2.63 vs base 1.08; on SFT anchors it
      is 1.94), so per-depth structure deserves one more look.
### Superseded open items
- [x] Identity control: done — anchor choice explains ~16%; the rest is register.
- [x] `P18`: the SFT anchor beats its DPO twin 5/5 (+0.0714) and matches sparse SFT.
- [ ] `P19`: anchor-count slope at 2/3/4 — is n=4 already saturated?
- [ ] Budget sweep (`P16`/`P17`, ~4 h): does the ordering reverse at 4–8 instances?
- [x] DPO (baseline 4): ties the merge, 24/33 to BO at p=0.014. All seven spec baselines
      are now implemented and run.
- [x] `P15`: `BO+ICL` beats `ICL` on 33/33. Kill criterion answered — see above.
- [ ] Tune the BO *inside* the prefix on 3022 / 110 / 1543 plus controls (~4 h), to test
      whether the regime mismatch explains the three losses.
- [ ] Reword `README.md:13` and the paper's hypothesis: composes-with, not beats.
- [ ] Baselines 3 and 4 (SFT / DPO on the sparse target) are implemented
      (`sparse_target_baselines.py`) but have **never run on a GPU**. Target negatives
      are exported (33 files × 30, `dpo_pairs_targets_full`) and not yet shipped to a pod.
- [ ] Rewrite `main.tex` §Discussion: table no longer pending — NLL confirms at n=33 and
      does not decay with prominence, ICL ties, UTAS does not discriminate. Retire the
      main-scale hedge in `sec:granularity`.
- [ ] Decide whether the anti-correlation between NLL and UTAS is a headline finding
      or a limitation paragraph.
- [ ] Decide how to present the ICL tie: cost/deployment framing, or a straight
      concession that prompting matches the merge on held-out NLL.
