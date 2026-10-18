# Speech quality labels: does an exchange advance Japanese politics?

**Status:** planned (2026-10-17) · **Builds on:** [speech-auto-update](../speech-auto-update/README.md) (`data/speech_update/`), [speaker-review](../speaker-review/README.md) · **Guides:** [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)

## 1. Problem

The site shows whether each question-and-answer exchange was **relevant** and **productive**, with a one-line reason, plus per-politician totals. Those labels came from a one-off import (`data/process_relevance_data.py`, from NDL TSV exports) and nothing updates them:

| | |
|---|---|
| Labelled exchanges | 96,180, in 6,152 meetings (2002-01 … 2025-06), about 20% of the meetings since 2000 |
| Split | 63.5k relevant + productive · 28.4k relevant, not productive · 4.2k not relevant · 3 not relevant but productive |
| Per-politician totals | `relevance_and_productivity/aggregate_processed.jsonl`, built 2026-02, before the speaker-review corrections |
| New speeches | never labelled |

How the labels are stored (the frontend reads them as-is):
- A label sits on the **first speech of an exchange**, in `issues/{id}/speeches.jsonl`: `is_relevant` / `is_productive` as the strings `"True"` / `"False"`, plus `quality_reason` (Japanese).
- An exchange runs from one labelled speech to the next (`frontend/app/components/features/issue/speechSegmentation.ts`), so it includes the answers.
- The per-person `Unproductive.jsonl` / `Irrelevant.jsonl` files and `aggregate_processed.jsonl` are derived from these labels.

**The old definitions are weak** (from the `quality_reason`s, sampled 2026-10-17):
- *Relevance* compares the exchange with the meeting's agenda ("決算委員会としての案件との関連性が薄い"). But 予算委員会 / 決算委員会 questioning legitimately covers all of government, and raising an urgent issue in an unrelated committee is often how the Diet works.
- *Productivity* is "concrete policy discussion or fact-finding" vs "personal criticism, heckling, arguments about time". It marks oversight of public bodies (e.g. pursuing the NHK chairman's conduct) as unproductive, and it doesn't separate a legitimate subject from repetitive pursuit of it.
- The whole exchange is charged to the questioner, so a minister who stonewalls makes the questioner look unproductive.

The user ruled out a fine-tuned BERT classifier: this is too nuanced. An LLM judges each exchange in context.

## 2. Goals

1. Detect exchanges that **don't advance Japanese politics**: private-life scandals, redundant questioning, evasion, procedural fights, grandstanding, softball questions, personal attacks. Attribute each failure to the side responsible.
2. Label every exchange since 2000, **newest first**, and new meetings nightly.
3. **Spend at most $100 a month** (calendar month, JST), enforced by the job.
4. **Report spend in Slack**: nightly, at thresholds, and monthly.
5. Rebuild the per-politician totals from the corrected speech → politician links, separately for asking and answering.

Not in scope now: meetings before 2000 (same mechanism later), a review UI for labels. Plenary sessions (本会議, mostly 代表質問 read from a script) are out of scope (user, 2026-10-18): only committee exchanges are labelled.

## 3. What the labels mean (decided with the user, 2026-10-17)

An exchange **contributes** if it serves one of the Diet's functions. It is judged on whether it did that well, and failures are charged to whoever caused them.

### 3.1 `function`: what the exchange is for

| Value | Meaning | Example |
|---|---|---|
| `legislation` | Examining a bill: what it does, gaps, amendments | 「この法案の第5条では対象外となる事業者は何社か」 |
| `oversight` | Holding the government to account for its conduct: public money, use of authority, administrative failure, **and scandals involving public office or public money** | 「補助金の交付先選定の経緯を説明されたい」 |
| `policy` | Debating what the government should do | 「物価高対策として給付と減税のどちらが有効か」 |
| `representation` | Bringing a group's or a region's concrete problem to the government | 「被災地の農家に再建支援が届いていない」 |
| `procedural` | Running the meeting: time, order, points of order | 「理事会で協議願います」 |
| `none` | None of these | a private-life scandal, small talk |

`function` says what kind of work it was, not whether it was good. It sets the yardstick (oversight is judged on facts brought out, legislation on whether the bill was tested) and supports profiles ("60% oversight, 10% legislation").

### 3.2 `issues`: why it falls short (any number)

| Issue | Meaning | Charged to |
|---|---|---|
| `private_scandal` | Private life unrelated to public office: personal conduct, family, gaffes outside the job. Scandals involving public money or official power are **not** this; they're `oversight`. A public official's private habits used to insinuate wrongdoing **are** this (user, 2026-10-18). Possible blackmail or other leverage over a senior official is **not**: it's a security/oversight matter. | questioner |
| `redundant` | Repeats a question already answered, in this meeting or earlier in the session, with no new angle or evidence. A legitimate subject can still be redundant: this is how "fixation" is caught. | questioner |
| `evasive` | Non-answer: 「お答えは差し控える」 without a real reason, reading a stock answer, answering a different question. **Not** evasive (user, 2026-10-18): an answer that turns on genuine legal nuance ("it depends on the circumstances"); declining because the matter belongs to another ministry. Privacy or "individual case" refusals count only when the excuse doesn't fit (user, 2026-10-18): shielding a private person (a detainee, a citizen's medical details) is legitimate; using it to avoid questions about the government's own conduct is evasive. | **answerer** |
| `procedural_dispute` | Fighting over time, demanding a word be withdrawn, heckling | whoever starts it (either, or both) |
| `grandstanding` | A speech with no real question; party advertising | questioner |
| `softball` | A question that only invites a prepared, favourable answer: praise plus "your thoughts", "please explain the merits", inviting attacks on another party, mostly thanks | questioner |
| `personal_attack` | Character or ability instead of policy | whoever does it |

`softball` is judged on the exchange, **not the party**: a ruling-party member asking a hard question of their own government isn't one, and a question that gets a real commitment (「来年度も確保されるのか」→「確保します」) isn't one either.

### 3.3 The other fields

- `contribution`: `substantive` / `limited` / `none` for the exchange as a whole.
- `responsible`: `questioner` / `answerer` / `both` / `neither`. Who caused the shortfall, from the issues above.
- `outcomes`: any of `new_information` (facts or figures not previously public), `commitment` (「検討する」 or firmer), `proposal` (a concrete policy proposal on the record).
- `topic`: the policy area (the site's topic list plus `other`). This replaces relevance. Being off the meeting's agenda is no longer a fault in itself.
- `reason`: one or two sentences in Japanese.

### 3.4 Per-politician totals

- **As questioner**: contribution and issues of the exchanges they started, excluding issues charged to the answerer (`evasive`).
- **As answerer** (ministers, vice-ministers, members answering for a bill): how often their answers were `evasive`, and what outcomes their answers produced.
- `function` mix, `topic` mix.

### 3.5 Compatibility with the current site

Until the frontend uses the new fields, the old ones are derived:
- `is_productive` = `contribution` ≠ `none` and no questioner-side issue
- `is_relevant` = `function` ≠ `none`
- `quality_reason` = `reason`

The new fields go alongside them on the same speech line (`quality: {function, contribution, issues, responsible, outcomes, topic}`), so nothing breaks.

### 3.6 Fairness check

A public "productivity" score has to hold up for every party. Scandal pursuit is mostly opposition behaviour and softballs mostly ruling-party behaviour, so the rubric counts both. The evaluation (4.1) checks that error rates against the user's labels are similar across parties, not just overall accuracy, and the site's methodology note says so.

## 4. Design

### 4.1 Phase 1: evaluation (model and prompt)

- **Gold set:** the user labels ~150 exchanges with the §3 scheme on a small local page that shows the exchange, its agenda and the earlier exchanges in the meeting. Stratified across eras (2000s / 2010s / 2020s), houses, 予算委員会 vs other committees, ruling vs opposition questioners, oversampling likely failures (old "not productive" labels, 予算委員会 scandal days).
- **Candidates:** Gemini 3.8 Flash, 3.5 Flash-Lite, and a local Qwen3 14B (MLX) as a reference; the same prompt and context.
- **Score:** per field (`contribution`, each issue, `responsible`, `function`), with recall on the failure classes, **broken down by the questioner's party**; cost per 1,000 exchanges.
- **Decide (user):** the model and the prompt. The 96k old labels are replaced, since the definitions changed; the old values stay in the ledger.
- Cost: a few dollars.

### 4.2 Unit of labelling: exchanges

New meetings have no exchange boundaries, so the job draws them: a new exchange starts when the chair gives the floor to a member to ask questions (the chair's turn naming the next questioner, or the questioner's first turn after it) and runs until the next one. Plenary: each 代表質問 with its answers is one exchange. Procedural turns outside any exchange are not labelled. Tested against the 6,152 meetings that already have labels: boundaries should match on ≥95% of exchanges before use.

### 4.3 Context for each exchange

Meeting name, date, house, agenda items (from the record's opening section), **one-line summaries of the earlier exchanges in the same meeting** (for `redundant`), the full exchange (speaker, role, text), and the §3 definitions. Output is JSON matching §3, with thinking off or minimal. Very long exchanges are truncated in the middle with a marker.

**Second pass (later):** redundancy across a whole session. Find earlier questions to the same minister on the same subject in the session (embeddings), and show them to the model for exchanges where it matters.

### 4.4 Size and cost

Measured on the mirror, 2026-10-17: since 2000, 30,881 meetings, ~1.26B characters (all speakers), ~480k exchanges; per year ~1,000 meetings, ~46M characters, ~16k exchanges.

Tokens: ~1–1.25B for the text, plus ~900 per exchange for definitions, agenda and earlier-exchange summaries, so **~1.45–1.7B input**. Output ~150 tokens per exchange ≈ 75M.

Batch API (per 1M tokens, ai.google.dev pricing, 2026-10-17):

| Model | In / out | Backlog since 2000 | Per year after |
|---|---|---|---|
| Gemini 3.5 Flash-Lite | $0.15 / $1.25 | ~$330 | ~$15 |
| Gemini 3 Flash Preview | $0.25 / $1.50 | ~$510 | ~$22 |
| Gemini 3.8 Flash, launch price to 2026-12-31 | $0.375 / $1.875 | ~$740 | ~$32 |
| Gemini 3.8 Flash from 2027-01-01 | $0.75 / $3.75 | ~$1,480 | ~$65 |

At $100/month: Flash-Lite finishes in ~4 months; 3.8 Flash in ~13 months (~$1,150 in all, since most of it runs at the 2027 price).

### 4.5 Budget and ledger (Postgres)

```
label_batch   id, model, prompt_version, submitted_at, finished_at, status,
              exchanges, input_tokens_est, cost_est,
              input_tokens, output_tokens, cost_usd          -- from usageMetadata
label_result  issue_id, start_speech_id, end_speech_id, questioner_person_id,
              answerer_person_ids[], batch_id, model, prompt_version,
              function, contribution, issues[], responsible, outcomes[], topic, reason,
              labelled_at
label_price   model, valid_from, input_per_m, output_per_m   -- batch prices, dated
```

- **Monthly spend** = `cost_usd` of batches finished this month (actual tokens × `label_price`) + `cost_est` of batches in flight.
- **Before submitting**, the job prices the batch (`countTokens`, free, or a character estimate) and submits only if spend + estimate ≤ cap. Otherwise the backlog waits for next month; new meetings are still labelled unless that would pass the cap.
- `SPEECH_LABEL_MONTHLY_CAP_USD=100`. Prices are dated rows, so the 2027 change needs no code change.
- **Backstop:** a Google Cloud Billing budget on the Gemini project at $120/month with email alerts (set up once by the user). It doesn't stop spending; it catches a ledger bug.

### 4.6 Slack

- **Nightly**, in the existing summary: `🏷️ Labels: 412 exchanges ($3.18) · October: $57.40 of $100 (57%) · backlog done back to 2019-03 (~210k exchanges left)`.
- **Thresholds**, once each per month: 50%, 80%, 100% (`⚠️ Label spend reached $80.12 of $100 for October`; at 100%, `backlog paused until November`).
- **Monthly summary** on the 1st: spend by model, exchanges labelled, backlog left, projected finish date.
- **Price check:** warn if actual cost per token differs from `label_price` by more than 10%.

### 4.7 Writing the results

For each finished batch: write §3.5's fields onto the exchange's first speech in `issues/{id}/speeches.jsonl` (the router keeps extra fields when it re-files lines); refile the person's `Unproductive.jsonl` / `Irrelevant.jsonl`; rebuild `aggregate_processed.jsonl` (old fields kept, new per-role totals added) with `person_id`s from the speaker resolver; queue the changed paths for upload.

### 4.8 Nightly flow

`all` gains a `label` stage after `route`: collect finished batches and write them → submit new meetings' exchanges → submit backlog batches, newest first, while under the cap → report. A failed or expired batch is resubmitted next night; its estimate stops counting once it is marked failed.

## 5. Checklist

- [x] Hide the old labels on the site: `SHOW_SPEECH_QUALITY = false` in `frontend/app/lib/config/features.ts` (PR #52, live 2026-10-18). Flip it back with the new labels.
- [x] Archive the old labels: `s3_mirror/.speech-quality-archive/v1-20261018/` (96,180 labels with reasons, 1,379 per-person Unproductive/Irrelevant files, `aggregate_processed.jsonl`). Stripped `is_relevant` / `is_productive` / `quality_reason` from 6,152 `issues/` files and 6,356 per-person files, uploaded 2026-10-18.
- [ ] Delete the 1,379 per-person `Unproductive.jsonl` / `Irrelevant.jsonl` and `relevance_and_productivity/aggregate_processed.jsonl` from S3 (needs an admin profile: the speech-update user can't delete), and copy the archive to S3
- [x] Phase 1 gold set: 169 exchanges labelled by Claude (`claude-opus-5-5`), not the user, in `data/speech_quality/gold/` (2026-10-17). Comparisons measure agreement with Opus; user to spot-check the 22 listed in its README
- [ ] Phase 1: gold-set page with the §3 scheme (optional now; for the spot-check and later relabelling)
- [ ] Phase 1: prompt v1; run the three candidates; report by field and by party; user picks
- [ ] Exchange segmenter (prototype: `data/speech_quality/segment.py`) + test against the 6,152 labelled meetings (≥95% boundary match)
- [ ] Ledger and price tables, cap check, Gemini Batch client (`GEMINI_API_KEY` in `data/.env`)
- [ ] Writer + per-role aggregate rebuild + upload
- [ ] Slack lines, thresholds, monthly summary
- [ ] Nightly `label` stage; backlog newest first
- [ ] User: Cloud Billing budget at $120 with email alerts
- [ ] Session-wide redundancy pass (4.3)
- [ ] Frontend: show `function`, issues and per-role totals (separate spec; touches `frontend/`, which deploys)
- [ ] Docs: DATA-PIPELINES.md, DATA-LAYOUT.md, site methodology note

## 6. Open questions

- Model and prompt: decided by Phase 1.
- How the site presents a minister's `evasive` rate, and whether it explains the method change from the old labels.
