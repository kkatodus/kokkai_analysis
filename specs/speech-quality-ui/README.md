# Speech quality UI: showing the exchange labels on the site

Status: in-progress (started 2026-11-09). Sequel to [speech-quality-labels](../speech-quality-labels/README.md), which produces the labels.

## 1. Decision

The old relevance × productivity display (hidden since 2026-10-18 behind `SHOW_SPEECH_QUALITY`) is **replaced, not revived**. The user decided on 2026-11-09 that backwards compatibility with the old labels is not needed: the site is rebuilt around the new scheme (`function`, `contribution`, `issues`, `responsible`, `outcomes`, `topic`, `reason`), and the derived `is_relevant` / `is_productive` / `quality_reason` fields and the `Unproductive.jsonl` / `Irrelevant.jsonl` per-person tabs go away.

Why not just flip the flag: under the new rubric 93% of exchanges are `substantive` and effectively all have a `function`, so the old four-bucket chart would be one colour. The information worth showing is the function mix, the failure patterns and who was responsible, and what the exchange produced.

## 2. Data files (written by `data/speech_quality/publish.py`)

Everything lives under `s3_mirror/kokkai-doc/speech_quality/`, uploaded by the nightly job like other mirror paths.

### 2.1 `aggregate.json` — one file for the explorer

```
{ version: 1, generated_at, prompt_version: "v3", models: ["gemini-3.8-flash", …],
  coverage: { from: "2015-09-10", to: "2026-10-05", exchanges: 51021, meetings: 6012 },
  totals: { as_questioner: Counts, as_answerer: AnswerCounts },           // whole corpus, for baselines
  persons: [ { person_id, name, group,                                      // group = latest 会派 seen as questioner
               as_questioner: Counts | null, as_answerer: AnswerCounts | null } ] }

Counts = { n, first, last,                                 // exchanges started, date range
           function: {legislation, oversight, policy, representation, procedural, none},
           contribution: {substantive, limited, none},
           issues: { <type>: {part, most} },                // questioner-side issues (by = questioner | both)
           outcomes: {new_information, commitment, proposal},
           topic: { <topic>: n },
           responsible: {questioner, answerer, both, neither} }
AnswerCounts = { n, first, last,                           // exchanges answered
                 issues: { <type>: {part, most} },          // answerer-side issues (by = answerer | both)
                 outcomes: {new_information, commitment} }
```

Only persons with at least one labelled exchange appear. Names come from Postgres `person`; the frontend still prefers `allParliamentMemberTable` for display.

### 2.2 `persons/{person_id}.jsonl` — one person's exchanges, newest first

One line per exchange the person took part in, as questioner or answerer:

```
{ role: "questioner" | "answerer", start_speech_id, issue_id, date, house, meeting,
  questioner, questioner_group, orders: [6, 7, 8, …],      // speechOrder of every speech in the exchange
  function, contribution, issues, responsible, outcomes, topic, reason, model }
```

`orders` lets the frontend map any speech in the person's speech list to its exchange (`speechID = issue_id + "_" + zero-padded order`) without rewriting the per-person speech files. The file is read whole by the detail pane (a heavy questioner has ~1,500 exchanges over 26 years, under 1 MB).

### 2.3 `issues/{id}/speeches.jsonl` — the meeting view

The exchange's first speech keeps a single `quality` object: `{function, contribution, issues, responsible, outcomes, topic, reason, model, prompt, speech_ids}`. The derived fields are no longer written; `write_issues` strips them from files it touches, and a one-off `python -m speech_quality.label_job write --all` cleans every labelled file.

### 2.4 When files are written

- Nightly (`label` stage): after collecting batches, `publish.rebuild(cur, mirror_root, persons=touched)` rewrites the touched persons' files and `aggregate.json`; the paths are queued for upload.
- Full rebuild: `python -m speech_quality.publish --all` (also run once after this spec lands).
- `questioner_group` is now stored on `label_result` (new column, backfilled from the issue files) so the aggregate's `group` and the per-person lines don't need to reopen meetings.

## 3. Backend

- `GET /speeches/quality/aggregate` → the aggregate file.
- `GET /speeches/quality/person?person_id=` → `{ exchanges: [...] }`, empty list if the person has no file.
- `GET /speeches/get_all_relevance_stats` removed.

## 4. Frontend

Feature flag removed; everything below is always on.

| Place | Before | After |
|---|---|---|
| Explorer right column | 関連度・生産性 bar list | **やり取りの評価** bar list: per politician, a stacked bar of contribution (substantive / limited / none) with chips for the most frequent issue types; sort by substantive share, any-issue rate, softball rate, grandstanding rate, proposal rate, evasive rate (as answerer); minimum-count filter; click opens the detail pane |
| Detail pane header | 関連度・生産性 bar | Compact contribution bar + function mix for the person, link to the new tab |
| Detail pane tabs | 発言 / 選挙履歴 | 発言 / **やり取り** / 選挙履歴. The やり取り tab lists the person's labelled exchanges (date, meeting, function, contribution, issue chips, reason) with filters by role, function and issue type; each row opens the meeting at the exchange's first speech |
| Speech list badges | 関連性 / 生産性 | function + contribution chip on the speech that starts an exchange, issue chips where flagged, reason on hover; built from the person's exchange file, so no speech-file rewrite |
| Unproductive / Irrelevant tabs | files from the old pipeline | removed |
| Meeting view | segments by is_relevant × is_productive | segments by `quality.speech_ids` (exact spans), coloured by contribution; every labelled segment gets a header with function, issues and reason; legend updated |
| 注意事項 | old rubric, gemma3 prompt | new definitions, models (Gemini 3.8 Flash; Claude Sonnet 5.5 when credits allow), prompt v3 text, coverage window from `aggregate.coverage`, fairness note |

Label vocabulary in Japanese lives in `frontend/app/lib/quality.ts` and mirrors `data/speech_quality/prompt.py`.

## 5. Checklist

- [x] `label_result.questioner_group` column + backfill
- [x] `publish.py`: aggregate + per-person files, CLI, nightly hook, tests
- [x] `labels.py`: single `quality` object; `write --all`
- [x] Backend endpoints
- [x] Frontend: types, `lib/quality.ts`, bar list, detail pane tab, badges, meeting view, disclaimer, flag removal
- [x] Full publish + upload; issue files rewritten (2026-11-09: 1,232 persons, 6,353 meetings, 7,586 files uploaded)
- [x] Docs: DATA-LAYOUT, CONTRACTS, DATA-PIPELINES, speech-quality-labels checklist
- [ ] dev → prd PR for the frontend (Vercel builds from prd)

## 6. Open questions

- Party-level comparison (fairness check from the labels spec §3.6): the aggregate has everything needed; a party view is a follow-up.
- Whether to show `topic` on the site beyond the per-person exchange filter.
- Person files for long-serving ministers are already 2.3 MB (加藤勝信, 2,687 answered exchanges) and will roughly triple with the full backlog; paginate or split by role if load time becomes a problem.
- Verified 2026-11-09 by type-check, `next build`, FastAPI TestClient and a server-rendered page check; no browser walkthrough yet.
