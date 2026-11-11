# Stance summaries in the representative detail pane (立場 tab)

**Status:** draft 2026-11-11 (decisions agreed in a grilling session; nothing built yet)
**Branch / worktree:** `stance-summaries-panel` in `../kokkai_analysis-stance` (off `origin/dev`)
**Related specs:** [topic-scaling-refresh](../topic-scaling-refresh/README.md) (produces the summaries), [speech-quality-ui](../speech-quality-ui/README.md) (per-person file + proxy pattern this copies)
**Related guides:** [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [CONTRACTS.md](../../docs/agents/CONTRACTS.md), [BACKEND.md](../../docs/agents/BACKEND.md), [FRONTEND.md](../../docs/agents/FRONTEND.md)
**Related code:** `data/topic_scaling/publish.py`, `data/topic_scaling/select.py`, `backend/app/routers/ideology.py`, `frontend/app/components/features/DetailPane.tsx`, `frontend/app/components/features/SpeechRecordCard.tsx`, `frontend/app/components/features/IdeologicalScatterPlot.tsx`, `frontend/app/components/tutorial/tutorialSteps.ts`

## 1. Goal

The monthly scaling job already writes, for every scaled politician and topic, a Japanese
stance summary (three LLM runs per pair; their mean embedding is what the scatter plot
projects). Today that text is used only as an intermediate: it lives in the gitignored
`s3_mirror/.topic-scaling/summaries/` and never reaches the site. Readers see a dot on an
axis but not *why* it sits there.

Show the summaries in the detail pane as a fourth tab 「立場」, next to the dot's position
on each sub-topic axis, with the evidence counts and a link back to the speeches the
summary was built from. No new LLM calls, no new cost: this is publishing what exists.

Figures as of 2026-11-11: 8,330 (person, topic) pairs over 2,011 people and 12 topics;
median 620 characters per run; 20 KB median per person (max 84 KB), 47 MB of text in total.

## 2. Decisions (agreed 2026-11-11)

| Topic | Decision | Why |
|---|---|---|
| Transport | One JSON file per person, `ideology/persons/{person_id}.json`, fetched when the pane opens | 47 MB can't ride in the 3.9 MB `ideology.json.gz` that every page load fetches server-side; 20 KB on click is nothing. Same shape of solution as `speech_quality/persons/`. |
| Runs | Publish all three; show run 1 with a 「別の要約 2/3」 toggle | Keeps the card short while letting a reader see how stable the sampled summary is. |
| Positions | Each topic card also shows one bar per sub-topic | Explains the scatter plot in the same place as the text; data is already loaded for the plot. |
| Bar scale | Percentile rank among all scaled people for that sub-topic, median tick, pro/con axis sentences at the ends | Raw x is skewed (e.g. 自衛隊の憲法明記 spans −1.7…0.2, median −0.85); a dot on −1…+1 would mislead. |
| Entry from the scatter plot | Opens the pane on 立場, scrolled to the plot's current topic; all other entry points keep opening on 発言 | The click came from a position; land the reader on its explanation. Tutorial and habits otherwise unchanged. |
| Thin evidence | Always show 「発言 N件・意見文 M件」 + window; amber 「根拠が少ない」 under 10 opinion sentences | The pipeline gate is 3 sentences; some summaries rest on 3–5. Same threshold goes on the scatter tooltip. |
| Provenance | Publish the contributing speech IDs; 「元になった発言を見る」 switches to 発言 on that topic and marks those speeches | Lets a reader check the paraphrase against the record. Sentences themselves are not published (size, and the speeches are one click away). |
| Stale files | Uploader never deletes; the pane shows a topic only if the person also appears in the loaded ideology data for it | Merged IDs or topics that fell below the gate leave orphan objects that nothing links to. No delete path needed. |
| Attribution | One note at the top of the tab + per-card 「要約: Claude Sonnet 5.5 · 2026-10」 from the file's own `model`; one sentence added to the methodology disclaimer and the about page | The top-level `summary_model` in the ideology file is wrong for the 109 Gemini-fallback pairs; the per-file field is right. |
| Tour / analytics | New tour step 「立場タブ」 after 選挙履歴, `DetailPanelView{panel}` on tab change, `StanceProvenanceClick{topic}` | The sample person (268) has nine topics. |
| Topic order in the tab | Config order (`experiment_config.json`), the same as the scatter plot's selector | Consistent across the page. |
| Spec placement | This folder, linked from the scaling spec and `specs/README.md` | Spans pipeline, backend and frontend. |
| First publish | Hand-run `python -m topic_scaling project --publish-partial` once from the prd checkout after the PR merges; the monthly job keeps files current afterwards | The person files are written by the same publish call as the ideology file, so the two never drift. |

Resolved from the codebase:

- `select.json` does not store the contributing speech IDs, only their sha1 (`opinion_hash`). The opinion cache (`opinions/{pid}/{Topic}.jsonl`, one line per speech with the kept sentences) plus the topic file dates reproduce them without the classifier; `select_pair` with `classifier=None` is that cache-only path.
- `DetailPane` hard-codes three panels (`PANEL_ORDER`, `w-[300%]`, `100/3`); the tutorial drives tabs through `setDetailPanel(panel)` typed as `DetailPanel`. Both become N-panel.
- `handlePoliticianSelect(id, { source })` already knows whether the click came from `ideology_scatter`; the plot's selected topic lives in `IdeologicalScatterPlot` state and must be lifted or reported through the select callback.
- The 発言 tab's topic keys are the `{TopicEn}.jsonl` names, identical to `topic_en` in the summaries, so provenance maps onto the existing topic selector with no translation.
- The uploader (`speech_update.upload.Uploader`) uploads every path it is given and never deletes; "changed only" has to be decided by the caller before the upload.

## 3. Non-goals

- No new summaries, no prompt change, no re-run of the Gemini-fallback pairs.
- No per-sub-topic text: summaries are per topic; scores are per sub-topic. The card says so.
- No publishing of the opinion sentences themselves (only the speech IDs).
- No change to the scatter plot beyond the tooltip threshold and reporting its topic on click.
- No English, no landing-page chapter for the tab (the landing's 立場 chapter stays as is).

## 4. Data: per-person stance file

### 4.1 Publish step

`data/topic_scaling/publish.py` gains `write_person_files(cfg, state, doc, topics) -> List[str]`, called from
`run_project` right after `write_document`, so the person files and `ideology.json.gz` are always built from the
same `select.json` and the same summary set. Steps:

1. Collect `(person_id, topic)` from `doc["data"][*].sub_topics[*]["1d"].data[*].person_id` (the set the plot
   shows; a pair that was summarised but not projected is left out, matching the frontend cross-check).
2. For each pair read `summaries/{pid}/{TopicEn}/summary.json`. Skip the pair, with a note, if the file's
   `opinion_hash` differs from `select.json`'s (summary out of date for a changed window).
3. Derive the contributing speech IDs with `select.select_pair(topic, pid, topic_file, state, classifier=None)`
   (cache only). If the sha1 of the sorted IDs ≠ `opinion_hash`, publish the summary **without** `speech_ids`
   and count it in the notes rather than fail.
4. Build the document (§4.2), serialise with `ensure_ascii=False, separators=(",", ":")`, compare against the
   existing file's bytes, and write only when different. Return the relative paths that changed; `run_project`
   passes them to `upload()` together with the ideology paths.
5. Slack report line: `Person files: 2,011 written, 37 changed, 3 without provenance, 0 stale summaries`.

`--no-upload` and `--dry-run` apply as they do for the ideology file. History copies are not kept.

### 4.2 Schema (`kokkai-doc/ideology/persons/{person_id}.json`)

```
{ version: 1,
  person_id: 268,
  generated_at: "2026-11-02T05:40:00+09:00",       # same stamp as the ideology file it was built with
  ideology_generated_at: "...",                    # doc["generated_at"], for debugging drift
  topics: [
    { topic: "defence", topic_en: "Defence", topic_jp: "防衛",
      window: { from: "2000-01-01", to: null },
      n_speeches: 16, n_opinions: 9,
      first_speech: "2008-04-25", last_speech: "2021-05-18",
      model: "claude-sonnet-5-5", prompt_version: "s1", summarised_at: "2026-10-22T23:59:39+09:00",
      summaries: ["１．…\n・…", "…", "…"],        # 3 runs, in run order, preamble already stripped
      speech_ids: ["120105254X03120200608_013", …]  # contributing speeches, sorted; absent when not reproducible
    }, …
  ] }
```

Topics are in config order. `speaker` from `summary.json` is **not** copied (the site takes names from the member
table). Nothing in the file is personal beyond what the ideology file already exposes.

### 4.3 Mirror and S3

Path `s3_mirror/kokkai-doc/ideology/persons/{person_id}.json`, uploaded to
`s3://kokkai-doc-bucket-dev/kokkai-doc/ideology/persons/` with the `kokkai-speech-update` profile (same bucket
as everything else; prod reads it, see [[shared-data-bucket]]). Content type `application/json`. Orphans from merged
IDs stay; nothing links to them.

## 5. Backend

`backend/app/routers/ideology.py`:

```
GET /ideology/person?person_id=268   → the file as JSON, or { "version": 1, "person_id": 268, "topics": [] } when missing
```

Same error handling as `/speeches/quality/person` (log, return empty, never 500 on a missing file). API key
required like the rest of the router. Added to `./scripts/list-api-routes.sh` output automatically.

## 6. Frontend

### 6.1 Plumbing

- `app/api/ideology/person/route.ts`: proxy, `revalidate = 600`, `X-API-KEY`, 502 on error, copied from
  `app/api/speeches/quality_person/route.ts`.
- `lib/services/ideologyService.ts`: `fetchPersonStances(personId): Promise<PersonStances>`.
- `types/index.ts`: `PersonStances`, `PersonStanceTopic` (mirror of §4.2).
- `DetailPane` receives `ideologyData: IdeologyData | null` from `ParliamentExplorerClient` (already in scope
  there) and fetches the person file in a `useEffect` on open, like the other three fetches.

### 6.2 The tab

`PANEL_ORDER = ["speeches", "quality", "history", "stances"]`; the strip width and translate use
`PANEL_ORDER.length`. `DetailPanel` type and the tutorial's `setDetailPanel` follow. Tab label 「立場」.

Top of the panel, one note (collapsible after first read is **not** needed; keep it to two lines):

> 国会での発言から抽出した意見文を AI が論点ごとに要約したものです。氏名は除いて要約しており、
> 言い回しが実際の発言と異なることがあります。[手法と限界 →](opens the existing VisualizationDisclaimer)

Then one card per topic, config order, only for topics where `ideologyData` has this `person_id` in at least one
sub-topic's `1d` data (stale-file guard). Empty state when the file has no usable topic:
「この議員の立場の推定はまだありません（対象トピックでの発言が少ないため）」.

### 6.3 Topic card

```
┌ 防衛  2000-01-01〜現在 ─────────────────────────────┐
│ 発言 16件 ・ 意見文 9件        [根拠が少ない]  (amber, < 10 opinions)
│ １．日米同盟の維持・強化を支持                        │
│ ・日米安全保障体制を中核とする同盟を重視し…           │
│ ２．…                                                 │
│ 別の要約を見る  1 / 2 / 3                             │
│ ── 論点ごとの位置 ──────────────────────────────────  │
│ 自衛隊の憲法明記   反対側 ●━━━━━┿━━━━━━━━ 賛成側  上位 23 %   │
│ 防衛予算の増額     反対側 ━━━━━━━┿━━●━━━━ 賛成側  上位 71 %   │
│ …                                                     │
│ 元になった発言を見る →          要約: Claude Sonnet 5.5 · 2026-10 │
└───────────────────────────────────────────────────────┘
```

- Summary text: render the numbered lines as `<ol>` items and the 「・」 lines as their sub-text. Lines that
  don't match either pattern are shown as plain paragraphs (the Gemini runs are less regular).
- Run toggle: three small segmented buttons; the active run is remembered per card for the pane's lifetime only.
- Position bars: for each sub-topic of that topic in `ideologyData`, take all `1d` points, compute this
  person's percentile (share of people with `x` strictly below theirs), draw the dot at that fraction, a tick at
  the median, `axis.pro` / `axis.con` as the end labels (truncated to the first clause, full text on hover).
  Caption: 「賛成側の上位 23 %」 when the dot is right of the median, 「反対側の上位 …」 otherwise.
  A sub-topic where this person is missing is omitted, not shown empty.
- Caveat line under the bars, once per card, small: 「要約はトピック全体、位置は論点ごとの推定です」.
- Provenance link: visible only when `speech_ids` is present. Calls `setActivePanel("speeches")`,
  `setSelectedTopicKey(topic_en)`, and sets a `markedSpeechIds: Set<string>` that `SpeechRecordCard` receives as a
  new optional prop; marked rows get a left border in the stance colour and a 「要約の根拠」 chip. Marking is
  cleared when the person changes. If the speeches for that topic aren't loaded yet, `ensureSpeechPage` runs
  first (existing behaviour of the topic selector).
- Model line: `model` mapped to a display name (`claude-sonnet-5-5` → Claude Sonnet 5.5, `gemini-3.5-flash-lite`
  → Gemini 3.5 Flash-Lite) + `summarised_at` as `YYYY-MM`.

### 6.4 Opening from the scatter plot

`IdeologicalScatterPlot.onPoliticianSelect(id)` becomes `onPoliticianSelect(id, { topic })` with the plot's selected
topic slug. `handlePoliticianSelect` for `source === "ideology_scatter"` sets
`panelRequest = { panel: "stances", nonce, topic }`; `DetailPane` scrolls the matching card into view after the
file has loaded (`scrollIntoView({ block: "start" })` on the card ref, no smooth scroll inside the pane). Every
other source keeps the current reset to 発言.

### 6.5 Scatter tooltip

Add the same amber 「根拠が少ない」 marker to the tooltip when `n_opinions < 10`, so the plot and the pane agree.

### 6.6 Tutorial and analytics

- New step after `history-tab`:
  `{ id: "stances-tab", target: '[data-tour="detail-pane"]', title: "立場タブ", body: "国会での発言を AI が論点ごとに要約し、各論点での位置と並べています。「元になった発言を見る」で根拠の発言に飛べます。", placement: "left", onEnter: (a) => a.setDetailPanel("stances") }`.
  The `ideology` step that follows still closes the person.
- `track("DetailPanelView", { panel })` on every `activePanel` change (all four tabs, so the new one can be
  compared with the old ones). `track("StanceProvenanceClick", { topic })` on the provenance link.
- Both events listed in FRONTEND.md's analytics table.

### 6.7 Copy elsewhere

- `VisualizationDisclaimer.tsx` step ③: add 「要約の本文は議員の詳細パネル「立場」タブで読めます。要約には氏名を含めないよう指示していますが、役職名が残ることがあります。」
- About page methodology section: one sentence pointing to the tab.

## 7. Docs to update in the same PR

- `docs/agents/CONTRACTS.md`: §Ideology gains the person-file schema and the `/ideology/person` route; the
  Next.js proxy list gains `app/api/ideology/person`.
- `docs/agents/DATA-LAYOUT.md`: mapping-table row for `ideology/persons/{person_id}.json`; delete the stale
  「Per-politician topic summaries — `idea_summaries/`」 paragraph (that directory no longer exists anywhere;
  verified in the scaling spec 2026-10-19).
- `docs/agents/FRONTEND.md`: DetailPane tabs, new proxy, events.
- `specs/topic-scaling-refresh/README.md`: §4.7 publish gets one line pointing here; its `opinions.json`
  mention is corrected (never written; provenance is derived at publish time instead).
- `specs/README.md`: row for this spec.

## 8. Rollout

1. PR `stance-summaries-panel → dev`. Frontend and backend only need the merge; the backend part is a new route
   in an existing router, so the dev deploy workflow runs for `backend/**`.
2. On dev: open any scaled person (e.g. 268) and confirm the empty state (no person files on S3 yet) renders
   without errors.
3. From the prd checkout after `dev → prd`: `python -m topic_scaling project --publish-partial` once
   (`--no-upload` first to inspect `s3_mirror/kokkai-doc/ideology/persons/268.json`, then without). Roughly 2,011
   files, ~47 MB; the uploader does 8 in parallel.
4. Confirm on production: 268 shows nine cards; a 2024 merge victim (pick one from the speaker-review log) shows
   the empty state rather than stale text; the scatter → pane path lands on the right card.
5. The monthly job (2nd, 05:00) keeps the files current with no further action.

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A wrong paraphrase under a real name | Tab note + per-card model line + provenance link; the general disclaimer already labels this as AI output. Reports go through the existing contact mail. |
| Summaries drift from the plotted positions | Person files are written in the same publish call from the same selection; the frontend hides topics missing from the loaded ideology file. |
| `select_pair` cache-only path can't reproduce the IDs (classifier model or search words changed since) | Hash check → publish without `speech_ids`, counted in the Slack line; the card just hides the link. |
| Pane gets long for prolific members (12 topics × 3–10 bars) | Cards are collapsible, first one open; bars are 14 px tall. |
| `DetailPanel` type change breaks tutorial steps | TypeScript catches every `setDetailPanel` call. |
| 2,011 extra objects on the first upload | One-off; subsequent months upload only changed files (byte comparison in §4.1 step 4). |

## 10. Task list

- [ ] `publish.write_person_files` + `run_project` wiring, `--dry-run` / `--no-upload` honoured, Slack line, unit test on a fixture summary dir (hash match, hash mismatch, missing summary)
- [ ] `GET /ideology/person` + test for the missing-file case
- [ ] Proxy route, service, types
- [ ] `DetailPane`: four-panel strip, fetch, tab note, cards, run toggle, percentile bars, provenance marking in `SpeechRecordCard`, stale-file guard, empty state
- [ ] Scatter plot: report topic on select; tooltip marker; `handlePoliticianSelect` routing to 立場
- [ ] Tutorial step, analytics events
- [ ] Disclaimer + about copy
- [ ] Docs (§7), `specs/README.md` row
- [ ] Lint, type-check, `next build`; screenshots at desktop and 390 px
- [ ] After merge to prd: first hand-run publish and the production checks in §8

## 11. Open questions

None blocking. Two things to look at once it is live:

- Whether the three runs ever disagree enough that showing run 1 alone misleads; if so, prefer the run whose
  embedding is closest to the mean (computable at publish time from the cached `.npz`).
- Whether readers use the provenance link at all (`StanceProvenanceClick`); if not, the 発言-tab marking can go.
