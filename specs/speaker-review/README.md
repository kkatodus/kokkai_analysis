# Speaker review: confidence levels for speech → politician matches

**Status:** in-progress (started 2026-10-15) · **Builds on:** [speech-auto-update](../speech-auto-update/README.md) (`data/speech_update/`) · **Guides:** [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)

## 1. Problem

`SpeakerResolver` (speech-auto-update §4.5) treats every match as certain: an exact kanji match, a kana-only fallback and an election-history pick all count the same. Checking the 7.68M filed speeches on 2026-10-15 found real misattributions:

| Pattern | Example | Speeches |
|---|---|---|
| Kana-only match, kanji differ | 中村正**雄** (member 1947–87) filed under 中村正**男** #2648 (elected 1983–93) | 3,861 |
| | 太田**正**孝 (1952–65) filed under 太田**昌**孝 #2720 (first elected 2017) | 2,547 |
| Same name, only one in `person` | 鈴木俊一 speeches 1947–1990 (the bureaucrat / Tokyo governor) filed under LDP 鈴木俊一 #1977 (first elected 1990) | ~4,675 |

Signals measured on the whole table:
- 429 (speaker, person) name pairs / 541,699 speeches where the NDL `speaker` ≠ `person.name_kanji`. Most are old/new character forms (澤/沢, 榮/栄, 藏/蔵 …) or names written in kana (福島みずほ/福島瑞穂). A minority swap a different character (雄→男, 正→昌, 榮→英, 勇→有, 次→二): almost always a different person.
- 685 (speaker, person) pairs with speeches more than a year before the person's first win or more than 7 years after their last. Many are fine (bureaucrats or private-sector ministers who were elected later: 川口順子, 竹中平蔵, 斎藤昇), some aren't (鈴木俊一 above).

## 2. Goal

Every match gets a confidence level. Sure matches flow through as today. Unsure ones are **held** (not filed, not written to Postgres) and queued for a human decision, made once per speaker/politician pair. Decisions persist, so every later run, including full rebuilds, follows them. Applying a decision moves already-filed speeches to the right place.

## 3. Design

### 3.1 Confidence (resolver)

`Resolution` gains `confidence` (`sure` | `review`) and `review_key`. A match is **flagged** with the first applicable reason:

| Reason | Rule |
|---|---|
| `kanji_differs` | cleaned `speaker` ≠ `person.name_kanji` after normalising old/new character forms (`variants.py`) and small/large kana, **unless** the speaker is written partly in kana and `speakerYomi` = `person.name_kana` (福島みずほ) |
| `election_pick` | chosen among same-name people by election history (not by a unique kana match) |
| `before_career` | meeting date < first win − 1 year |
| `after_career` | meeting date > last win + 7 years |

`review_key = (speaker, speakerYomi or "", person_id, reason)`. One decision covers every speech with that key, e.g. all 鈴木俊一 speeches *before* #1977's career, while his in-career speeches stay sure.

### 3.2 Decisions (Postgres)

```
speaker_review        one row per review_key
  id, speaker, speaker_yomi, person_id, reason,
  status  pending | confirmed | unlinked | reassigned
  new_person_id (reassigned), note,
  groups[], positions[], sample_speech_ids[],
  first_seen, decided_at, applied_at
speaker_review_issue  (review_id, issue_id) → speeches, first_date, last_date
```

The resolver loads decisions at start: `confirmed` → sure (same person); `reassigned` → sure, `new_person_id`; `unlinked` → no person (skipped like a non-member); `pending` / unknown → held.

### 3.3 Flow

- **Daily run** (`all`): route holds flagged speeches and upserts their keys as `pending`. Slack: "N new speakers need review". Then it applies any decided-but-unapplied rows (3.4) before the upload stage, so decisions made during the day go live overnight.
- **Backlog:** `review scan` re-resolves every issue in the mirror (read-only for files) and fills the queue. Already-filed speeches stay where they are until decided.
- **Review:** `review` (interactive) shows one pair at a time, biggest first: speaker, reading, reason, group / position, date range, two quotes, the candidate's elections, and other people with the same name or reading. Keys: `y` confirm, `n` unlink, `r <id>` reassign, `s` skip, `q` quit. `review decide <id> confirm|unlink|reassign <pid>` does the same non-interactively; `review list` prints the queue.
- **Apply** (`review apply`, also run nightly): for decided, unapplied rows, re-resolve their issues; remove moved/unlinked speeches from the old person's `all_speeches.jsonl` and topic files; route the issues again (files them under the new person, upserts Postgres); delete DB rows for unlinked speeches; mark `applied_at`; queue changed paths for upload.

### 3.4 Non-goals

- No fuzzy matching or automatic decisions. Rules only decide *whether* to ask.
- Unmatched speakers (not in `person`) keep the existing `unmatched_speakers.jsonl` flow.
- A web review UI can come later on top of the same tables.

## 4. Checklist

- [x] `variants.py` (old/new forms, small kana) + tests
- [x] Resolver confidence + decisions; Router holds flagged speeches and records them
- [x] `speaker_review` tables (created on first use)
- [x] `review scan | list | decide | apply` + interactive review
- [x] Nightly: record + notify + apply
- [x] Backlog scan run (2026-10-15, ~3 min): 762 pairs / 183,559 speeches (2.4% of 7.68M) queued
  | reason | pairs | speeches |
  |---|---|---|
  | `before_career` | 553 | 154,151 |
  | `after_career` | 179 | 12,974 |
  | `kanji_differs` | 25 | 11,840 |
  | `election_pick` | 5 | 4,594 |
  Apply verified as a dry run (decisions reset afterwards): unlinking 太田正孝 removes all 2,547 of his speeches from #2720's files.
- [ ] User works through the queue (`python -m speech_update.review`); the nightly run applies decisions
- [x] Docs: DATA-PIPELINES.md, speech-auto-update PROGRESS.md
