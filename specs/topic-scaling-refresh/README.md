# Topic scaling refresh

**Status:** in-progress · **Owner:** kenchan · **Created:** 2026-10-19 · **Implementation started:** 2026-10-19

Keep the ideological scaling current the same way speeches, labels and member lists are kept current: a monthly job re-summarises, re-embeds and re-projects every politician on every configured topic, inside each topic's time window, publishes a new `ideology/` file with an "all representatives" and a "current members" view, and posts topic and window suggestions to Slack for the user to act on by hand.

Related: [speech-auto-update](../speech-auto-update/README.md) (nightly speeches, `speech_update` package), [speech-quality-labels](../speech-quality-labels/README.md) (Gemini Batch client, Postgres ledger, monthly cap), [member-auto-update](../member-auto-update/README.md) (current member lists), [ensemble-scaling-reliability](../ensemble-scaling-reliability/README.md) (scope-aware summaries in `data/ensemble_scaling/a3_build_summaries.py`, model grid in `a4_embed_grid.py`). Guides: [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [RESEARCHER.md](../../docs/agents/RESEARCHER.md), [CONTRACTS.md](../../docs/agents/CONTRACTS.md), [FRONTEND.md](../../docs/agents/FRONTEND.md).

---

## 1. Why

- The served file `kokkai-doc/ideology/ideology.json.gz` was built once, on the old machine, from Gemini stance summaries and `cl-tohoku/bert-base-japanese-v3` embeddings. It has not changed since the bucket was created (2025-12-29). It covers 631 politicians; 447 of the 711 current members with a `person_id` are in it, so about a third of today's Diet is missing, and nothing said since the build counts.
- Nothing in the repo assembles that file. `quantify_politician_stance_to_topics.py` writes per-sub-topic `*_1d.json` / `*_2d.json` under `data/results/<date>/`; the merge into `{data:[{topic, sub_topics:[…]}]}` was done by hand or in a lost notebook.
- Its inputs are gone. `data/data/idea_summaries/` exists on no machine or drive here (checked 2026-10-19: this Mac, `~/kokkai_data/`, `/Volumes/KokkaiData` (erased 2026-10-15), S3 `kokkai-doc-bucket-dev` which has only `archive/speech-quality-v1-20261018/` and `kokkai-doc/`). Only `data/axis/{topic}/` (axes and generated reference speeches, 35 sub-topic example files) survives in git.
- Every topic is scaled on all history. A politician's 1998 speeches on nuclear power count the same as their 2012 ones, and topics that only exist after an event (decommissioning after 3.11) are polluted by pre-event text that matched the search words for other reasons.
- The scatter plot shows everyone ever scaled, with no way to look at the sitting Diet only.

## 2. Goals

1. **Monthly rescale.** `python -m topic_scaling all` re-summarises politicians whose in-window speeches changed, re-embeds them with `sbintuitions/sarashina-embedding-v2-1b`, re-projects every (politician, sub-topic), and publishes a new ideology file. Incremental, idempotent, resumable, same conventions as `speech_update`.
2. **Time windows.** Each topic in `data/resource/experiment_config.json` has a `window` (`from`, optional `to`). Only speeches inside it feed that topic's summaries. The window is shown in the UI.
3. **Two views.** The scatter plot toggles between every representative scaled in the window and current members only. Positions are the same in both views; the job precomputes the 2D layout for both subsets.
4. **Suggestions, not automation.** The job posts to Slack: candidate new topics (with search words, sample sentences, volume curves), window suggestions for existing topics, and newly scaled sub-topics that `available.json` does not list yet. The user edits `experiment_config.json`, `data/axis/`, and `frontend/app/data/available.json` by hand. The job never changes those files.
5. **Under the existing cap.** Summaries are Gemini Batch jobs charged to the same `$100/month` ledger as the quality labels.

## 3. Non-goals

- Changing the scaling method beyond the embedding model. One embedding per (politician, topic); 1D = projection onto the sub-topic axis between the generated for/against reference speeches; 2D = UMAP of politicians plus the two reference points. Ensembles wait for the paper's gates (G1/G2 in the ensemble spec); the job is written so a different embedder or an ensemble is a config change (§4.5).
- Per-term snapshots or trajectories over time. One scale per topic per run. The versioned history (§4.7) makes that possible later without redesign.
- Separate fits for the current-member view (decided 2026-10-19: filter, don't refit).
- Editing `experiment_config.json` or `available.json` automatically (decided 2026-10-19: Slack suggestions only).
- Moving the job to AWS. Same Phase 3 note as the speech updater.

## 4. Design

### 4.1 Overview

```mermaid
flowchart LR
    CFG[experiment_config.json<br/>topics · search words · window] --> SEL
    RS[(repr_speeches_id_organized/<br/>{person}/{Topic}.jsonl)] --> SEL[select<br/>window filter · opinion gate]
    SEL -->|opinion sets + hash| SUM[summarize<br/>Gemini Batch · ledger]
    SUM -->|summary.json| EMB[embed<br/>sarashina-v2-1b · cache]
    AX[data/axis/{topic}<br/>axis.json · examples] --> PRJ[project<br/>1D axis · 2D UMAP all+current]
    EMB --> PRJ
    PM[(parliamentMembers/<br/>latest snapshots)] -->|current person_ids| PRJ
    PRJ --> PUB[publish<br/>ideology.json.gz + history/ · upload · revalidate]
    RS --> SUG[suggest<br/>clusters · agendas · externals · volume curves]
    CFG --> SUG
    SUG --> SL[Slack]
    PUB --> SL
```

Stages run in that order under one lock; each writes its output to state before the next starts, so any stage can be resumed or run alone: `select | summarize | embed | project | publish | suggest | all`.

### 4.2 Config: topics and windows

`experiment_config.json` entries gain:

```json
{
  "topic_id": 4,
  "topic_name": "原発",
  "topic_name_en": "NuclearPower",
  "search_words": ["原発", "..."],
  "window": {"from": "2011-03-11", "to": null},
  "scaling": {"enabled": true, "min_opinions": 3}
}
```

- `window.from` is required for a topic to be scaled; `to: null` means open-ended. A topic without `window` is reported in Slack as "unscaled: no window" and skipped. Nothing else in the pipeline (`speech_update` routing, labels) reads `window`, so adding it is safe.
- `scaling.enabled: false` keeps the topic's speech files updating but leaves it out of the scale.

**Initial windows (user's choice 2026-10-19: proposal below, to be edited by hand before the first run).**

| topic_id | Topic | from | Reason for the cut |
|---|---|---|---|
| 1 | Defence 防衛 | 2000-01-01 | matches the labels' since-2000 cut |
| 2 | DecliningBirthrate 少子化 | 2000-01-01 | same |
| 4 | NuclearPower 原発 | 2011-03-11 | Fukushima; restart / decommissioning debate starts here |
| 5 | ClimateChange 気候変動 | 2015-12-12 | Paris Agreement |
| 6 | Economy 経済対策 | 2000-01-01 | valence topic, no natural cut |
| 7 | LivingCostandTax 物価高対策・減税と賃上げ | 2022-01-01 | post-COVID inflation |
| 8 | SocialSecurity 社会保障全般の見直し | 2000-01-01 | |
| 9 | Pension 年金制度改革 | 2004-01-01 | 2004 pension reform |
| 10 | FamilySeparate 夫婦別姓 | 2000-01-01 | |
| 11 | OnlineVoting オンライン投票 | 2013-04-19 | internet election campaigning legalised |
| 12 | MyNumber マイナンバー | 2015-10-05 | number issuance began |
| 13 | LGBT | 2015-04-01 | Shibuya partnership ordinance |

All open-ended. The job's monthly volume curves (§4.9) are the evidence for narrowing or widening these later.

### 4.3 Select: window filter and opinion gate

For every (politician, topic) with a `{Topic}.jsonl`:

1. Keep speeches with `window.from <= meta.date <= window.to`. Both houses (the paper's HoR-only filter is a research choice, not a site choice).
2. Split into sentences, keep those containing a search word, run `kkatodus/jp-speech-classifier` and keep `意見文` segments, exactly as `create_idea_summaries.py` does today. The classifier runs locally on the M6 (MPS); its outputs are cached per `speechID` in `state/opinions/{person}/{topic}.jsonl` so a speech is classified once.
3. Gate: fewer than `min_opinions` (default 3) → not scaled this run; recorded in `state/select.json` with the count so the Slack report can say "212 politicians below the gate on LGBT".
4. **Change key:** `opinion_hash = sha1(sorted speechIDs of kept opinions)`. If it equals the hash stored with the existing `summary.json`, the pair is unchanged and skips summarize and embed. This is what makes the monthly run cheap: only politicians who spoke on the topic since last month, or whose window changed, are redone.

Output: `state/select.json` listing `{person_id, topic, n_opinions, opinion_hash, changed}`.

### 4.4 Summarize: Gemini Batch under the shared cap

- Prompt: the existing `SummaryPrompt` (anonymised, `SUMMARY_RUNS = 3` runs per pair, same as production and the paper's A3). Topic name in the prompt is `topic_name`.
- Model: `gemini-3.5-flash-lite` (the summariser the paper diagnoses; cheapest). Open question Q3 if the user wants 3.8 Flash.
- Transport: `speech_quality.gemini_batch.GeminiBatch`, moved to a shared `data/llm/gemini_batch.py` (the quality job keeps working through a re-export).
- Ledger: the same `label_batch` / `label_price` tables with `kind = 'summary'` added to the `CHECK` constraint, and a new `summary_result(person_id, topic, opinion_hash, batch_id, model, prompt_version, run_idx, summary, tokens…)`. `month_spend()` already sums every kind, so the cap is shared with no further change. `SPEECH_LABEL_MONTHLY_CAP_USD` stays the single cap.
- **Priority within the cap (proposal, Q1):** new-meeting labels first, then this month's summary changes, then the label backlog. The summary step prices its batch with the same character estimate the label job uses and submits only if `month_spend + estimate <= cap`; otherwise the changed pairs wait and the Slack line says so.
- Output: `s3_mirror/.topic-scaling/summaries/{person_id}/{topic}/summary.json` with the production schema (`person_id, topic_en, topic_jp, opinion_count, summaries[]`) plus `opinion_hash, window, model, prompt_version, generated_at`, and `opinions.json` for provenance. Batches finish within 24 h, so the monthly run is two launchd firings: submit on day 2, collect and continue on day 3 (§4.8), the same collect-then-submit shape as the label job.

**Size of the first run.** 4,647 politicians have at least one topic file; with the windows above most pre-2000 speakers drop out. Expect 1,500–2,500 politicians and roughly 8,000–15,000 (politician, topic) pairs that clear the gate, times 3 runs. At batch prices that is about $40–60 on Flash-Lite ($100–150 on 3.8 Flash), so one to two months under the shared cap, running behind the label backlog. Phase 0 measures the real number with `select --dry-run` before anything is submitted.

### 4.5 Embed

- `sbintuitions/sarashina-embedding-v2-1b` through `sentence-transformers`, loaded once per run, batch size 16 on MPS. Each summary is embedded; the 3 runs are mean-pooled into one vector per (politician, topic), as the production pipeline and A4 do.
- Reference points: the for/against example speeches in `data/axis/{topic}/examples/*_example_speeches.json` are embedded with the same model and mean-pooled into one `for` and one `against` vector per sub-topic. They are embedded every run (cheap) so a model change or an edited example file is picked up.
- Cache: `state/embeddings/{model_slug}/{topic}/{person_id}.npy` keyed by `opinion_hash`; the sub-topic reference vectors in `state/embeddings/{model_slug}/{topic}/refs/{sub_topic}.npz`. Changing `TOPIC_SCALING_EMBED_MODEL` starts a fresh cache directory, which is how a future ensemble or model swap slots in.
- Switching from bert-ja-v3 to sarashina moves every point once. That is accepted; the first publish is announced in Slack as a full re-scale.

### 4.6 Project: 1D axis, 2D UMAP, current flag

Per sub-topic in `data/axis/{topic}/{topic}_axis.json`:

- **1D:** `x = (e_p - mid) · (e_for - e_against) / |e_for - e_against|` with `mid` the midpoint of the references, so 0 is the axis midpoint, positive is `for`. Same quantity as today's `VectorOperator` projection. `y` is the rank index as the current file uses it.
- **2D:** UMAP (`n_components=2, n_neighbors=30, random_state=42`) over the topic's politician embeddings plus the two reference vectors. Fit twice: on everyone scaled in the window (`2d`) and on the current-member subset (`2d_current`). ≈ 55 sub-topics × 2 fits on ≤ 2,500 points, minutes on the M6.
- **Current members:** the union of `person_id`s in the latest `parliamentMembers/shugiin_*.json` and `sangiin_*.json` (the files the member job writes; take the lexically last per house). Stored per point as `current: true|false`, so the 1D view is a client-side filter.
- Point metadata comes from Postgres `person` (name, kana) and the member snapshot (house, kaiha → `party` via the same party mapping the old script used; politicians not in a snapshot get their last `election_result` party and house). `party` and `color` keep today's values (kaiha abbreviation such as れ新, plain colour name) so the frontend needs no change; `party_full` is added, and aligning colours with `frontend/app/lib/config/parties.ts` (full party names, Tailwind classes) is a frontend follow-up.

### 4.7 Publish: file format, versions, upload

Output schema (v2) is a superset of today's `IdeologyData`, so the frontend keeps working before it is updated:

```json
{
  "version": 2,
  "generated_at": "2026-11-03T05:40:00+09:00",
  "embed_model": "sbintuitions/sarashina-embedding-v2-1b",
  "summary_model": "gemini-3.5-flash-lite",
  "current_members_as_of": "2026-11-01",
  "data": [
    {
      "topic": "nuclear",
      "topic_en": "NuclearPower",
      "topic_jp": "原発",
      "window": {"from": "2011-03-11", "to": null},
      "n_scaled": 812,
      "n_current": 388,
      "sub_topics": [
        {
          "topic": "nuclear",
          "sub_topic": "restart",
          "sub_topic_jp": "原発の再稼働について",
          "axis": {"pro": "...", "con": "..."},
          "1d": {"data": [{"idx": 0, "x": -2.48, "y": 0, "repr": "...", "hiragana": "...", "house": "upper", "party": "れ新", "color": "green", "ref_point": "none", "person_id": 3364, "current": true, "n_opinions": 41, "last_speech": "2026-06-12"}]},
          "2d": {"data": ["... same point shape, plus the two ref_point rows ..."]},
          "2d_current": {"data": ["... UMAP of current members + refs ..."]}
        }
      ]
    }
  ]
}
```

- Written to `s3_mirror/kokkai-doc/ideology/ideology.json.gz` (what the router serves) and copied to `s3_mirror/kokkai-doc/ideology/history/ideology-YYYY-MM-DD.json.gz`. Rolling back is copying a history file over the live one and uploading. The backend route is unchanged; a `?version=` parameter is a later addition.
- Upload with the existing `speech_update.upload` changed-path uploader and the `kokkai-speech-update` IAM profile (same prefix policy covers `kokkai-doc/ideology/*`). Never delete.
- The topic `topic` key (e.g. `nuclear`) and sub-topic keys stay exactly as in the current file and `available.json`, taken from a new `slug` field on each axis entry in `data/axis/{topic}/{topic}_axis.json`; the job fails loudly if a slug is missing rather than inventing one.
- Call the frontend revalidation hook after upload, as the speech updater does.

### 4.8 Scheduling

launchd, `com.kokkaidoc.topic-scaling.plist`, installed by `scripts/install-topic-scaling-schedule.sh` (copy of the member-update installer). Two firings a month:

| Day (JST) | Command | Why |
|---|---|---|
| 2nd, 05:00 | `topic_scaling all` | after the nightly speech update (04:00) and the member refresh (1st, 05:00), so new speeches and the new member list are in. Runs select → submits summary batches → embeds and projects what is already summarised → suggest → Slack. |
| 3rd, 05:00 | `topic_scaling all` again | collects finished batches, embeds and projects them, publishes. If batches are still pending (cap, or a 48 h expiry), `all` is safe to run any later day by hand; the wrapper retries once after 15 min like the others. |

Publishing only happens when every changed pair that was submitted has been collected; otherwise the old file stays live and Slack says what is pending. A `--publish-partial` flag forces a publish with the pairs available (used for the first backfill, which spans months).

`scripts/update-topic-scaling.sh` mirrors `update-speeches.sh`: venv `.venv-topic-scaling` (torch MPS build, sentence-transformers, umap-learn, transformers, psycopg2, same `requirements-*.txt` pattern), `caffeinate`, bare launchd PATH, lock in `s3_mirror/.topic-scaling/lock`.

### 4.9 Suggest: topics and windows for the user

Runs monthly after publish. Everything it finds goes into one Slack message (plus a Markdown file in `state/suggestions/YYYY-MM.md` for the full detail), formatted so the user can paste into `experiment_config.json`. **The job never edits config files** (decided 2026-10-19).

**A. Window suggestions for existing topics.** Monthly count of search-word-matching speeches per topic since 1990 (cheap scan over `issues/`, cached per month). Report the curve as a sparkline and the earliest month where the 12-month rolling volume exceeds 20% of its all-time maximum, next to the configured `from`. A topic whose last 12 months are below 10% of its peak is flagged as possibly closed. Suggestion only.

**B. Clusters of recent Diet speech.** Over the last 6 months of `issues/`: sentence segments that match *no* existing search word, embedded with the sarashina model already loaded, clustered with BERTopic (HDBSCAN + c-TF-IDF with the repo's `stopwords-ja.txt` and MeCab tokens; the `TopicModeller` class on the unmerged `origin/topic_modelling` branch, 2024, is the starting point). Top 10 clusters by size: keyword list, 3 sample sentences, number of distinct speakers and parties. Clusters dominated by one committee's procedure (予算, 法案名 boilerplate) are dropped by a stop-phrase list that grows with use.

**C. Gemini reading of recent agendas.** Agenda items (本日の会議に付した案件 in each record's opening 会議録情報 speech; the label job's `segment.py` only reads the header line, so a small parser is added) and meeting names of the last 6 months, one prompt per month: "list the 10 most contested policy questions, each with a Japanese name, 5–10 search words, a for/against question, and the meetings where it was argued; skip anything matching these existing topics". Output is JSON matching an `experiment_config.json` entry minus `window`, so the user can paste it.

**D. External signals** (user chose all four; phased, see §8):

| Source | How | Phase |
|---|---|---|
| Party manifestos | `data/data/data_manifesto/` per DATA-LAYOUT.md (2025 upper house was collected, but the directory is not on this Mac: restore or re-run `analyze_manifesto_of_parties.py` first); Gemini lists policy themes that 3+ parties raise, diffed against existing topics | 2 |
| Google Custom Search news | `SEARCH_ENGINE_ID` + API key already in `data/.env`; monthly queries like `国会 争点`, `法案 対立`, `与野党 攻防` over the last 30 days; Gemini clusters headlines into themes | 2 |
| Party-leader debates / press conferences | 国家基本政策委員会合同審査会 records are in `issues/` already (feed them to C with extra weight); party press-conference pages need scrapers per party | 3 |
| Opinion polls | NHK / 読売 monthly "most important issue" items; scraping and licensing to check first | 3 |

**E. Merge and rank.** Candidates from B, C, D are merged by Gemini into at most 8 suggestions, each scored by: Diet volume (from B), external salience (D), and overlap with existing topics (search-word Jaccard; above 0.5 becomes "widen topic X" instead of a new topic). Final Slack message:

```
📐 Topic scaling, November 2026
Published ideology-2026-11-03 (12 topics, 55 sub-topics, 2,113 scaled, 652 current)
Summaries: 1,240 pairs changed, 1,240 submitted ($9.80), 0 pending · October: $71.20 of $100
Below gate: LGBT 212, OnlineVoting 311 (min_opinions=3)

Window suggestions
  NuclearPower  from 2011-03-11 · volume ▁▁▁▂▂▃▇█▆▅▄▄▃▃▃  rises 2011-04 ✓
  Pension       from 2004-01-01 · volume ▃▅█▆▃▃▂▂▃▄▃▂▂▂▂  rises 1999-11 → consider 1999-11
  OnlineVoting  last 12 months 4% of peak → consider closing

New topic candidates (details: state/suggestions/2026-11.md)
  1. 選択的夫婦別姓 → overlaps FamilySeparate 0.7 — add words: 旧姓使用, 通称
  2. 外国人労働者・移民 (Diet 1,842 speeches/6mo, 7 parties; manifestos 5/9; news 23 headlines)
     search_words: 外国人労働者, 技能実習, 育成就労, 移民, 入管 …
     question: 外国人労働者の受け入れを拡大すべきか
  3. ...
Not yet in available.json: nuclear/fukushimasupport, defence/foodsecurity

Next: edit data/resource/experiment_config.json (+ window), then
  python -m topic_scaling onboard <TopicNameEn>
```

**F. Onboarding a new topic** (manual trigger after the user adds the entry): `topic_scaling onboard <Topic>` builds `{Topic}.jsonl` for every politician by scanning `all_speeches.jsonl` with the new search words (the nightly `speech_update` routes new speeches from then on, since it reads the same config), generates the controversy axes and the for/against example speeches with the existing `ControversyAxis` prompts (moved out of `quantify_politician_stance_to_topics.py` into `topic_scaling/axis.py`, Gemini instead of the legacy OpenAI prompter), writes `data/axis/{topic}/` with slugs, and posts the axes to Slack. The user edits `data/axis/{topic}/{topic}_axis.json` and `available.json` if they want; the next monthly run scales it.

### 4.10 Frontend

`IdeologicalScatterPlot.tsx`:

- A segmented toggle next to the 1D/2D switch: **全議員（期間内）** / **現職のみ**. 1D filters points by `current`; 2D swaps `2d` for `2d_current`. The choice persists in `localStorage`.
- Window label under the topic selector: `対象期間 2011-03-11 〜 現在 · 812人（現職 388人）`.
- Tooltip gains `n_opinions` and `last_speech`.
- Types in `frontend/app/types` extended with the optional v2 fields; the component works on a v1 file (no `current` → toggle disabled).
- `available.json` stays the manual on/off switch for topics and sub-topics. The Slack report lists scaled sub-topics it does not mention.

`app/page.tsx` already fetches the ideology file server-side with caching; no new endpoint. `CONTRACTS.md` gets the v2 shape.

### 4.11 Code layout

```
data/
  llm/
    gemini_batch.py        # moved from speech_quality/, re-exported there
    ledger.py              # moved from speech_quality/, kind in ('new','backlog','summary')
  topic_scaling/
    __init__.py
    config.py              # experiment_config.json + window parsing, slugs, env
    select.py              # window filter, opinion classifier, gate, opinion_hash
    summarize.py           # batch build/submit/collect, summary.json writer
    embed.py               # sarashina loader, cache, reference vectors
    project.py             # 1D projection, UMAP all/current, point metadata
    publish.py             # v2 file, history copy, upload, revalidate
    suggest/
      volume.py            # monthly search-word curves (A)
      clusters.py          # BERTopic over recent segments (B)
      agendas.py           # Gemini over agenda items (C)
      externals.py         # manifestos, CSE news, debates, polls (D)
      rank.py              # merge + Slack rendering (E)
    axis.py                # ControversyAxis + example generation for `onboard`
    onboard.py             # new-topic backfill of {Topic}.jsonl + axes
    state.py               # lock, run state, resumability
    __main__.py            # CLI: select|summarize|embed|project|publish|suggest|onboard|all [--dry-run] [--topic X] [--publish-partial]
scripts/
  update-topic-scaling.sh
  install-topic-scaling-schedule.sh
frontend/app/components/visualizations/IdeologicalScatterPlot.tsx  (toggle, window label)
frontend/app/types/…                                               (v2 fields)
```

State in `s3_mirror/.topic-scaling/` (gitignored): `lock`, `last_run.json`, `select.json`, `opinions/`, `summaries/`, `embeddings/`, `volume/`, `suggestions/`, `logs/`.

### 4.12 Failure handling

- Any stage can be re-run; `all` resumes from state. A missing Gemini key fails summarize only; embed/project/publish still run on what is summarised (so a key outage degrades to "no new summaries this month", not "no publish").
- Postgres down: select and summarize still run (they only need files); project needs `person` for names and is postponed, as the speech job postpones route.
- Cap reached: changed pairs wait; publish still happens with `--publish-partial` semantics only if the user asked for it, otherwise the old file stays live and Slack explains.
- Slack: failure (after the wrapper's retry), monthly report (§4.9 E), and the cap thresholds already handled by the ledger.

## 5. Edge cases

| Case | Handling |
|---|---|
| A window is edited | Every pair's `opinion_hash` changes for that topic → full re-summarise of that topic next run, priced against the cap; Slack shows the estimate before submission if `--dry-run` |
| Search words edited for an existing topic | `{Topic}.jsonl` files are stale. `onboard --refresh <Topic>` rebuilds them from `all_speeches.jsonl`; the monthly run warns if a topic's search words changed since the files were built (hash stored in `state`) |
| Politician below the gate this month but scaled last month | Dropped from the new file. Their old position is in `history/` |
| Same person in both houses over time | One `person_id`, one point; `house` is the current or most recent house |
| A politician merged/split by the speaker-review job | Topic files already move with `refile`; the stale summary is keyed by a `person_id` that no longer has a directory → deleted from state, reported |
| New topic added but no `window` | Reported "unscaled: no window", not scaled |
| Axis example file edited | Reference vectors are re-embedded every run, so 1D/2D shift for that sub-topic only |
| Embedding model changed | New cache directory, full re-embed (no LLM cost), full re-project |
| UMAP non-determinism | Fixed seed; still, layouts change between runs when points are added. The 2D view is exploratory; 1D is the comparable number |

## 6. Credentials and cost

- Gemini key: `GEMINI_API_KEY` in `data/.env` (exists). Shared `$100/month` cap via the ledger. Google Cloud billing budget at $120 is the backstop.
- AWS: `kokkai-speech-update` profile; its policy already covers `kokkai-doc/*`.
- Google Custom Search: `SEARCH_ENGINE_ID` exists; the CSE JSON API's free tier is 100 queries/day, far above the monthly need.
- Local compute: classifier + sarashina + UMAP on the M6 (24 GB). First run: classifier over roughly 1–2 M segments, a few hours under `caffeinate`; monthly runs minutes.

## 7. Testing

- Unit: window filter boundaries, opinion hash stability, gate, 1D projection sign (for → positive), `current` flag from fixture snapshots, v2 writer validates against a JSON schema, v1 compatibility (frontend types test).
- Regression against today's file: for Defence and NuclearPower, Spearman between the new 1D positions (sarashina, windowed) and the live positions for politicians present in both. Expect moderate agreement; large disagreement is a bug signal, not a go/no-go.
- Ledger: a fake Gemini batch client, cap arithmetic with mixed kinds.
- Suggest: snapshot test on a fixed 6-month fixture; Slack rendering test.
- Dry run of the whole chain on 2 topics × 30 politicians (`--topic NuclearPower --limit 30`), published to `history/` only, viewed in the local frontend with the toggle.

## 8. Rollout

1. **Phase 0, measure:** add `window` to the 12 topics (the user edits the table in §4.2 into `experiment_config.json`); run `select --dry-run` to get the real pair count and cost estimate; post it to Slack. Create `.venv-topic-scaling`; confirm sarashina loads on MPS. Add slugs to `data/axis/*/…_axis.json` matching `available.json` and the live file.
2. **Phase 1, backfill:** summarize in monthly tranches under the cap (new-meeting labels first, then summaries, then label backlog); embed/project as batches land; `--publish-partial` once Defence, NuclearPower and Economy are complete so the site improves early. Frontend toggle ships with the first v2 publish.
3. **Phase 2, scheduled:** install the launchd job; watch two monthly cycles.
4. **Phase 3, suggestions:** A (volume) and B (clusters) and C (agendas) in the first scheduled run; D manifestos and CSE news the month after; debates/press conferences and polls when their scrapers exist.
5. **Phase 4, later:** `?version=` on the ideology route for diachronic views; ensemble embedder behind the model config once the paper's gates decide.

## 9. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Embedding model | **sarashina-embedding-v2-1b, single model** (2026-10-19) |
| D2 | Window semantics | **One window per topic, filter speeches, one scale** (2026-10-19) |
| D3 | Current-member view | **Filter the same scale; 2D precomputed for both subsets** (2026-10-19) |
| D4 | Who edits config/axes | **Job posts suggestions to Slack; user edits files by hand** (2026-10-19) |
| D5 | Suggestion sources | **Clusters of recent speeches, Gemini over agendas, all four external sources (phased)** (2026-10-19) |
| D6 | Initial windows | **User sets by hand, starting from the §4.2 table** (2026-10-19) |
| D7 | Runtime | **This Mac, launchd, same pattern as the other jobs** (2026-10-19) |
| D8 | Summary budget | **Shared `$100/month` ledger and cap with the quality labels** (2026-10-19) |
| D9 | Old summaries | **Regenerate; none exist anywhere (verified 2026-10-19), and windows change the input anyway** |

## 10. Open questions

| # | Question | Proposed default |
|---|---|---|
| Q1 | Priority inside the shared cap | new-meeting labels → summary changes → label backlog |
| Q2 | Minimum opinions for the gate, and whether it should scale with window length | 3, same as today |
| Q3 | Summary model | `gemini-3.5-flash-lite` (paper's A3 choice, cheapest); 3.8 Flash if quality matters more than backfill speed |
| Q4 | Should the "current" view also hide politicians who sit today but were below the gate in the window | yes (they are simply absent) |
| Q5 | Keep `y = rank index` in 1D or let the frontend compute it | keep, for v1 compatibility |
| Q6 | Slack: one message or a thread per section | one message, details in the Markdown file |

## 11. Task checklist

Done 2026-10-19 (first implementation pass, uncommitted on the dev worktree):

- [x] `experiment_config.json`: `slug`, `window`, `scaling` on all 12 topics (windows from §4.2); `slug` on every entry of `data/axis/*/…_axis.json` (55 sub-topics, all with example speeches)
- [x] Ledger reuse without moving files: `topic_scaling/ledger_ext.py` adds `kind='summary'` to `label_batch` (constraint altered in place, verified) plus `summary_request` / `summary_result`; `month_spend()` already counts every kind, so the cap is shared
- [x] `config.py` (topics + windows + axes, loud on missing slug/examples), `state.py`, `select.py` (window filter, cached classifier, `opinion_hash`, `--estimate`), `summarize.py` (batch build, cap check, collect → `summary.json`), `embed.py` (sarashina on MPS, fp16, OOM fallback, caches), `members.py` (current from snapshots, Postgres for the rest, party short names/colours), `project.py` (1D, UMAP all + current), `publish.py` (v2 writer, `history/`, upload via `speech_update.upload`), `suggest/volume.py` (A: volume curves), `__main__.py` (CLI, Slack report)
- [x] `.venv-topic-scaling` (python3.12, torch 2.14 MPS), `data/requirements-topic-scaling.txt`
- [x] `scripts/update-topic-scaling.sh`, `scripts/install-topic-scaling-schedule.sh` (2nd + 3rd, 05:00)
- [x] Frontend: v2 types, 全議員/現職のみ toggle (localStorage), window label, tooltip extras; `tsc --noEmit` clean
- [x] 11 unit tests (`topic_scaling/tests`), docs (DATA-PIPELINES, CONTRACTS, DATA-LAYOUT, agent-help)
- [x] Phase 0 numbers: `select --estimate` over everything = 10,843 pairs, ≈$59 on Flash-Lite / ≈$129 on 3.8 Flash (upper bound; the classifier keeps about two thirds of the estimated pairs on NuclearPower)

- [x] `suggest/agendas.py` (C): agenda items parsed from each record's 会議録情報 speech, one Gemini call → 8 pasteable candidates (tested 2026-10-19: 防災庁, 経済安全保障→Defence overlap, 憲法改正手続, 入管, 皇室典範, 政治改革, 社会保障 overlap, 種苗法)
- [x] `axis.py` + `onboard.py` (F): `onboard --topic T` backfills `{T}.jsonl` from `all_speeches.jsonl` (reproduces the existing LGBT files line for line) and uploads; `onboard --topic T --axes` extracts axes with slugs from the topic's summaries and generates 10 reference speeches per side
- [x] `speech_quality/label_job.py`: `collect()` now only picks up `kind IN ('new','backlog')`, so the nightly label run leaves summary batches alone
- [x] End-to-end check on a scratch state (fake summaries from the opinion cache): embed → project → v2 file validated (names, parties, `current`, `2d_current`, refs at ±1 on the 1D axis)
- [x] First real summary batch submitted 2026-10-19 22:29 JST: `label_batch` id 8, NuclearPower + LGBT for the first 600 person directories, 109 pairs / 327 requests, ~$0.31; `python -m topic_scaling summarize` (or `all`) collects it once Gemini finishes (≤ 24 h)

Left:

- [ ] Full `select` over every topic (classifier; estimate a few hours on the M6) and the first `summarize` tranche under the cap; then `all --publish-partial`
- [ ] Regression vs the live file for Defence / NuclearPower (§7)
- [ ] `suggest/clusters.py` (B), `externals.py` (D: manifestos, CSE news, debates, polls), `rank.py` (E, merge of B/C/D)
- [ ] Install the launchd job (`scripts/install-topic-scaling-schedule.sh install`) after one hand-run cycle
- [ ] Later: `?version=` on the ideology route; ensemble embedder behind `TOPIC_SCALING_EMBED_MODEL`; align colours with `parties.ts`
