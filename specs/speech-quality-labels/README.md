# Speech quality labels: relevance and productivity, kept current

**Status:** planned (2026-10-17) · **Builds on:** [speech-auto-update](../speech-auto-update/README.md) (`data/speech_update/`), [speaker-review](../speaker-review/README.md) · **Guides:** [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)

## 1. Problem

The site shows whether each question-and-answer exchange was **relevant** to the agenda and **productive**, with a one-line reason, plus per-politician totals. Those labels came from a one-off import (`data/process_relevance_data.py`, from NDL TSV exports) and nothing updates them:

| | |
|---|---|
| Labelled exchanges | 96,180, in 6,152 meetings (2002-01 … 2025-06), about 20% of the meetings since 2000 |
| Split | 63.5k relevant + productive · 28.4k relevant, not productive · 4.2k not relevant · 3 not relevant but productive |
| Per-politician totals | `relevance_and_productivity/aggregate_processed.jsonl`, built 2026-02, before the speaker-review corrections |
| New speeches | never labelled |

How the labels are stored (the frontend reads them as-is, so this stays the same):
- A label sits on the **first speech of an exchange**, in `issues/{id}/speeches.jsonl`: `is_relevant` / `is_productive` as the strings `"True"` / `"False"`, plus `quality_reason` (Japanese, one or two sentences).
- An exchange runs from one labelled speech to the next (`frontend/app/components/features/issue/speechSegmentation.ts`). It includes the answers, so officials' and ministers' replies are part of what gets judged.
- The per-person `Unproductive.jsonl` / `Irrelevant.jsonl` files and `aggregate_processed.jsonl` are derived from these labels.

The user ruled out a fine-tuned BERT classifier: productivity is too nuanced. An LLM judges each exchange in context.

## 2. Goals

1. Label every exchange since 2000, **newest first**, so the site is current at once and history fills in behind.
2. Label new meetings as part of the nightly speech job.
3. **Spend at most $100 a month** (calendar month, JST), enforced by the job itself.
4. **Report spend in Slack**: on every nightly run, at thresholds, and in a monthly summary.
5. Rebuild the per-politician totals from the corrected speech → politician links.

Not in scope now: meetings before 2000 (possible later, same mechanism), a review UI for labels.

## 3. Size and cost

Measured on the mirror, 2026-10-17:

| | Meetings | Text (all speakers) | Exchanges (est., ~15.6 / meeting) |
|---|---|---|---|
| Since 2000 | 30,881 | ~1.26B characters (5.37 GB of `speeches.jsonl`) | ~480k |
| Per year (2024, 2025) | ~1,000 | ~46M characters | ~16k |

Tokens: about 1–1.25B for the text, plus ~600 per exchange for instructions and agenda, so **~1.3–1.55B input**. Output ~80 tokens per exchange (two labels and a reason) ≈ 40M, with thinking off or minimal (thinking tokens bill as output).

Batch API prices (half the interactive rate, results within 24 h), per 1M tokens, from ai.google.dev/gemini-api/docs/pricing on 2026-10-17:

| Model | In / out | Backlog since 2000 | Per year after |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | $0.15 / $1.25 | ~$250 | ~$12 |
| Gemini 3 Flash Preview | $0.25 / $1.50 | ~$400 | ~$18 |
| Gemini 3.8 Flash, launch price to 2026-12-31 | $0.375 / $1.875 | ~$600 | ~$28 |
| Gemini 3.8 Flash from 2027-01-01 | $0.75 / $3.75 | ~$1,200 | ~$55 |

With the $100 cap: nightly labelling of new meetings takes ~$2–5 a month and the rest goes to the backlog. **Flash-Lite**: done in ~3 months. **3.8 Flash**: ~$240 of backlog at the launch price (Oct–Dec 2026, about 40%), the rest at the 2027 price, so ~10 months and ~$950 in all. The model choice comes from the evaluation (§4.1).

## 4. Design

### 4.1 Phase 1: evaluation (pick the model and prompt)

- **Gold set:** the user hand-labels ~150 exchanges: a stratified sample across eras (2000s / 2010s / 2020s), houses, committee vs plenary, and parties, oversampling the old "not relevant" and "not productive" labels. A small local page shows the exchange with its agenda and records relevant / productive / note.
- **Candidates:** Gemini 3.8 Flash, 3.5 Flash-Lite, and one local model (Qwen3 14B via MLX) as a reference, with the same prompt and context.
- **Score:** agreement with the gold set per label (accuracy, plus recall on "not productive", the minority that matters), cost per 1,000 exchanges, and agreement with the old labels on the same exchanges (for continuity, not truth).
- **Decide (user):** the model, and whether to relabel the 96k old exchanges (one consistent method, ~20% more backlog) or keep them. The default is to relabel; old values are kept in the ledger, not lost.
- Cost: a few dollars.

### 4.2 Unit of labelling: exchanges

New meetings have no exchange boundaries, so the job draws them: a new exchange starts when the chair gives the floor to a member to ask questions (the chair's `○委員長（…君）` turn naming the next questioner, or the questioner's first turn after it), and runs until the next one. Plenary sessions: each 代表質問 with its answers is one exchange. Procedural turns outside any exchange are not labelled.

Tested against the 6,152 meetings that already have labels: the drawn boundaries should match the existing labelled speeches on ≥95% of exchanges before it is used.

### 4.3 Prompt and context

Per exchange, the model gets: meeting name, date, house, agenda items (from the meeting record's opening section), the full exchange (speaker, role, text), and the criteria. It returns JSON `{"is_relevant": bool, "is_productive": bool, "reason": "…"}`, the reason in Japanese, one or two sentences, in the style of the existing `quality_reason`. Very long exchanges are truncated in the middle with a marker. Exchanges are packed many per batch request; the batch file and its estimated cost are fixed before submission.

### 4.4 Budget and ledger (Postgres)

```
label_batch   id, model, submitted_at, finished_at, status,
              exchanges, input_tokens_est, cost_est,
              input_tokens, output_tokens, cost_usd          -- from usageMetadata
label_result  issue_id, start_speech_id, end_speech_id, batch_id, model,
              is_relevant, is_productive, reason, labelled_at
label_price   model, valid_from, input_per_m, output_per_m   -- batch prices, dated
```

- **Monthly spend** = sum of `cost_usd` (actual, from each response's `usageMetadata` × `label_price`) for batches finished this month, plus `cost_est` for batches still in flight.
- **Before submitting**, the job prices the batch from `countTokens` (free) or a character estimate and submits only if spend + estimate ≤ cap. Otherwise the backlog waits for next month; new meetings are still labelled (they're cheap) unless that would exceed the cap.
- Cap: `SPEECH_LABEL_MONTHLY_CAP_USD=100` (config, default 100). Prices live in `label_price` with dates, so the 2027 price change is a row, not a code change.
- **Backstop:** a Google Cloud Billing budget on the Gemini project at $120/month, with email alerts. It doesn't stop spending; it catches a ledger bug. Set up once by the user in the Cloud console.

### 4.5 Slack

- **Every nightly run**, one line in the existing summary: `🏷️ Labels: 412 exchanges ($3.18) · October: $57.40 of $100 (57%) · backlog done back to 2019-03 (~210k exchanges left)`.
- **Thresholds**, once each per month: 50%, 80%, 100% (`⚠️ Label spend reached $80.12 of $100 for October; backlog paused until November`).
- **Monthly summary** on the 1st: last month's spend by model, exchanges labelled, backlog left, and the projected finish date at the current cap.
- **Price check:** if actual cost per token differs from `label_price` by more than 10%, say so (the price table is out of date).

### 4.6 Writing the results

For each finished batch:
- write `is_relevant` / `is_productive` / `quality_reason` onto the exchange's first speech in `issues/{id}/speeches.jsonl` (the router already keeps these fields when it re-files lines);
- refile the affected speeches into the person's `Unproductive.jsonl` / `Irrelevant.jsonl`;
- rebuild `aggregate_processed.jsonl` from all labels, using `person_id`s from the speaker resolver (so speaker-review decisions apply), same fields as today;
- queue the changed paths for upload.

### 4.7 Nightly flow

`all` gains a `label` stage after `route`: collect finished batches and write them (4.6) → submit new meetings' exchanges → submit backlog batches, newest first, while under the cap → report (4.5). A batch that fails or expires is resubmitted next night; its estimate stops counting once it is marked failed.

## 5. Checklist

- [ ] Phase 1: gold-set page; user labels ~150 exchanges
- [ ] Phase 1: run the three candidates; report; user picks the model and the relabel decision
- [ ] Exchange segmenter + test against the 6,152 labelled meetings (≥95% boundary match)
- [ ] Ledger tables, price table, cap check, Gemini Batch client (`GEMINI_API_KEY` from `data/.env`)
- [ ] Writer (4.6) + aggregate rebuild + upload
- [ ] Slack lines, thresholds, monthly summary
- [ ] Nightly `label` stage; backlog newest first
- [ ] User: Cloud Billing budget at $120 with email alerts
- [ ] Docs: DATA-PIPELINES.md, DATA-LAYOUT.md

## 6. Open questions

- Model: decided by Phase 1.
- Relabel the 96k old exchanges or keep them? (Default: relabel.)
- Should the site say which model labelled an exchange, or flag the change in method?
