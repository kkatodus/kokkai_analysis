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
- ~195k filed speeches fall outside the person's elected terms. Most are the right person before or after serving (bureaucrats or private-sector ministers later elected: 川口順子, 竹中平蔵, 斎藤昇); some are a namesake (鈴木俊一 above). **Decision (user, 2026-10-15): speeches made outside a politician's time serving are not attributed to them at all.**
- The election data is incomplete for recent elections (2025 upper house: ~90 rows vs ~150 in 2022; 2026 lower house: 357 vs 667 in 2024) and some older upper-house terms (笠井亮 1995–2001). So the term check can't be the only evidence of membership.
- NDL sets `speakerGroup` (会派) on every speech made as a sitting member, ministers included, and leaves it empty for civil servants, witnesses and non-member ministers. That makes it reliable evidence of membership where the election data is missing.

## 2. Goal

Every match gets a confidence level. Sure matches flow through as today. Unsure ones are **held** (not filed, not written to Postgres) and queued for a human decision, made once per speaker/politician pair. Decisions persist, so every later run, including full rebuilds, follows them. Applying a decision moves already-filed speeches to the right place.

## 3. Design

### 3.1 Confidence (resolver)

`Resolution` gains `confidence` (`sure` | `review`) and `review_key`. A match is **flagged** with the first applicable reason:

| Reason | Rule |
|---|---|
| `kanji_differs` | cleaned `speaker` ≠ `person.name_kanji` after normalising old/new character forms (`variants.py`) and small/large kana, **unless** the speaker is written partly in kana and `speakerYomi` = `person.name_kana` (福島みずほ) |
| `election_pick` | chosen among same-name people by election history (not by a unique kana match) |
| `out_of_term` | outside every elected term **and** speaking with a `speakerGroup`: the speaker was a member, so either the election data is missing a win or it's someone else |
| `not_serving` | outside every elected term and **no** `speakerGroup`: not attributed at all, without asking (checked first, before the reasons above). A `confirmed` decision can override it. |

**Service terms** (`resolver.service_terms`): each Diet win starts a term that runs 4 years (衆) or 6 years (参), cut short by the next election in that house the person stood in (won or lost), plus 30 days' grace. The house comes from the election name or district (`N区`/`ブロック` → 衆; `県選挙区`/`比例区`/`全国区`/`地方区` → 参). Local elections and the House of Peers don't count.

`review_key = (speaker, speakerYomi or "", person_id, reason)`. One decision covers every speech with that key, e.g. all of 太田正孝's speeches filed under 太田昌孝.

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

The resolver loads decisions at start: `confirmed` → sure (same person); `reassigned` → sure, `new_person_id`; `unlinked` → no person (skipped like a non-member); `pending` / unknown → held (`not_serving`: dropped). `not_serving` keys are recorded as rows already `unlinked` (note `auto: …`), so `apply` removes them from files that already had them and you can see or override them.

### 3.3 Flow

- **Daily run** (`all`): route holds flagged speeches and upserts their keys as `pending`. Slack: "N new speakers need review". Then it applies any decided-but-unapplied rows (3.4) before the upload stage, so decisions made during the day go live overnight.
- **Backlog:** `review scan` re-resolves every issue in the mirror (read-only for files) and fills the queue. Already-filed speeches stay where they are until decided.
- **Review:** `review` (interactive) shows one pair at a time, biggest first: speaker, reading, reason, group / position, date range, two quotes, the candidate's elections, and other people with the same name or reading. Keys: `y` confirm, `n` unlink, `r <id>` reassign, `s` skip, `q` quit. `review decide <id> confirm|unlink|reassign <pid>` does the same non-interactively; `review list` prints the queue.
- **Apply** (`review apply`, also run nightly): for decided, unapplied rows, re-resolve their issues; remove moved/unlinked speeches from the old person's `all_speeches.jsonl` and topic files; route the issues again (files them under the new person, upserts Postgres); delete DB rows for unlinked speeches; mark `applied_at`; queue changed paths for upload.

### 3.4 Non-goals

- No fuzzy matching. The only automatic decision is `not_serving`; every other rule only decides *whether* to ask.
- Unmatched speakers (not in `person`) keep the existing `unmatched_speakers.jsonl` flow.
- A web review UI can come later on top of the same tables.

## 4. Checklist

- [x] `variants.py` (old/new forms, small kana) + tests
- [x] Resolver confidence + decisions; Router holds flagged speeches and records them
- [x] `speaker_review` tables (created on first use)
- [x] `review scan | list | decide | apply` + interactive review
- [x] Nightly: record + notify + apply
- [x] Backlog scan, first version (career = first win − 1 y … last win + 7 y): 762 pairs, all for review. Replaced the same day by service terms + `not_serving` per the user's decision.
- [x] Backlog scan with service terms (2026-10-15, ~3 min):
  | reason | pairs | speeches | |
  |---|---|---|---|
  | `not_serving` | 723 | 164,025 | dropped automatically |
  | `out_of_term` | 116 | 24,515 | review |
  | `kanji_differs` | 24 | 11,839 | review |
  | `election_pick` | 5 | 4,594 | review |
- [x] Applied the 723 `not_serving` rows (backups: `s3_mirror/.speech-update/backups/pre-not-serving-20261015/` with 713 person dirs; `~/kokkaidoc-speeches-pre-not-serving.dump`)
- [ ] User works through the 145-pair queue (`python -m speech_update.review`); the nightly run applies decisions
- [ ] Fill the missing 2025 upper-house and 2026 lower-house results in `election_result` (shrinks `out_of_term`)
- [x] Docs: DATA-PIPELINES.md, speech-auto-update PROGRESS.md
