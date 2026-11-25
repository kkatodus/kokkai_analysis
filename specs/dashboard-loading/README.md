# Dashboard loading: a fast `/app` and an interactive wait

**Status:** loading screen (§5) and site stats cards (§8) built 2026-11-11 on `dashboard-loading`, PR #70 to `dev` (see §14 for what differs from the plan); caching (§6) and the ideology split (§7) not built. **Priority: the loading screen (§5) ships first and alone; the caching quick wins (§6) are optional and come after; the ideology split (§7) is postponed indefinitely.**
**Branch / worktree:** `dashboard-loading` in `../kokkai_analysis-loading` (off `origin/dev`)
**Related specs:** [landing-page](../landing-page/README.md) (the buttons that lead here), [topic-scaling-refresh](../topic-scaling-refresh/README.md) (writes `ideology.json.gz`), [stance-summaries-panel](../stance-summaries-panel/README.md) (also splits ideology output; see §9 — that spec is still only in `../kokkai_analysis-stance`, not yet on `dev`), [speech-quality-ui](../speech-quality-ui/README.md) (aggregate + proxy pattern this copies)
**Related guides:** [FRONTEND.md](../../docs/agents/FRONTEND.md), [BACKEND.md](../../docs/agents/BACKEND.md), [CONTRACTS.md](../../docs/agents/CONTRACTS.md), [DATA-PIPELINES.md](../../docs/agents/DATA-PIPELINES.md), [DATA-LAYOUT.md](../../docs/agents/DATA-LAYOUT.md)
**Related code:** `frontend/app/app/page.tsx`, `frontend/app/lib/server/dataFetcher.ts`, `frontend/app/components/ParliamentExplorerClient.tsx`, `frontend/app/components/visualizations/IdeologicalScatterPlot.tsx`, `frontend/app/components/shared/VisualizationDisclaimer.tsx`, `frontend/app/api/speeches/quality_person/route.ts`, `backend/app/routers/ideology.py`, `data/topic_scaling/publish.py`, `data/speech_quality/publish.py`

## 1. Goal

Clicking 「ダッシュボードを開く」 on the landing page leaves the visitor staring at the landing
page for eight seconds or more before anything changes. Two things are wrong:

1. Nothing is shown while `/app` loads.
2. `/app` is slow because every visit renders a 34 MB page on a server on the wrong continent (§2).

This spec fixes the first now and records the second for later. The wait is real work — the page
is carrying the whole ideology-scaling output and every exchange label — so the screen says so: a
dashboard-styled panel with a progress bar whose stages name the datasets being prepared, usage
tips, and a quiz/fact card the visitor can play with, kept as a dismissible overlay if the
dashboard arrives mid-question. The visitor should come away with the impression that something
substantial was computed for them, because it was.

## 2. Measurements (production, 2026-11-11)

Taken with `curl` against `https://www.kokkaidoc.com`; the probe network added ~5 s to every
request, which is already subtracted here. `https://kokkaidoc.com/...` (apex) first 307s to `www`,
so a non-`www` link pays one extra round trip.

| Route | `x-vercel-cache` | TTFB | Transfer (brotli) | Uncompressed HTML |
|---|---|---|---|---|
| `/` | HIT (`x-nextjs-prerender: 1`) | ≈ 0 s | 11 KB | 11 KB |
| `/app` | MISS on every request, `age: 0` | ≈ 6 s | 3.2 MB, ≈ 2 s | **34 MB** |

`x-vercel-id: hnd1::iad1::…` — the edge is Tokyo, the function that renders `/app` runs in
Washington DC (`iad1`); the backend (ECS, `infra/lib/config/environments.ts`) is in `ap-northeast-1`.

### 2.1 Causes, by weight

1. **The ideology document is embedded in the page.** `page.tsx` awaits five datasets and passes
   them as props to `ParliamentExplorerClient`, so they are serialised into the RSC payload inside
   the HTML. `ideology.json.gz` is 3.7 MB gzipped / **25.6 MB** of JSON: 12 topics, 60 sub-topics,
   three views each (`1d`, `2d`, `2d_current`), 92,683 points, 15 keys per point, the same person
   metadata (`repr`, `hiragana`, `house`, `party`, `party_full`, `color`, `last_speech`, …) repeated
   for every sub-topic and view. Roughly 15 MB of that is repeated key names. The other four
   datasets are ~4 MB together (quality aggregate 1.3 MB, member table 0.5 MB CSV → ~1 MB JSON,
   geo 0.55 MB, member snapshot ~0.3 MB). The browser downloads, parses and hydrates all of it
   before React paints.
2. **`/app` is rendered on every request.** The page reads `searchParams` (for `person_id`), which
   opts the route out of static rendering, so `export const revalidate = 600` does nothing and
   Vercel never caches the HTML.
3. **Every render refetches 3.7 MB across the Pacific.** `getIdeologyData` goes through `fetchApi`
   with `next.revalidate`, but the response is far over Next's 2 MB data-cache limit, so it is never
   cached: each request downloads and `JSON.parse`s 25 MB from Tokyo to DC. `fetchApiRaw` (member
   table, aggregate) uses `cache: "default"`, which in a route handler/page is also uncached.
   This is most of the 6 s TTFB.
4. **Nothing is shown while waiting.** There is no `app/app/loading.tsx`; the `<Suspense>` in
   `page.tsx` sits *below* the `await Promise.all(...)`, so its fallback (`LoadingState`) can never
   render. `<Link>` prefetch cannot help a dynamic route with no loading boundary. The browser stays
   on the landing page until the whole 34 MB response has streamed.

The scatter plot only ever renders **one sub-topic at a time** (`selectedSubTopic` in
`IdeologicalScatterPlot.tsx`); the rest of the document is dead weight on every visit. The
disclaimer (`IdeologyDisclaimerContent`) reads only counts and the model/date metadata.

## 3. Decisions (agreed 2026-11-11)

| Topic | Decision | Why |
|---|---|---|
| Scope | The loading experience (§5) is the deliverable. The caching quick wins (§6) are a separate, optional follow-up. The ideology split (§7) is **postponed** — decided 2026-11-11 after the first draft | The wait is acceptable for now as long as it is visible and feels like the data work it is; shortening it is a later, separate effort. |
| Ideology transport (postponed) | When picked up: `publish.py` writes `ideology/index.json` plus one `ideology/subtopics/{topic}/{sub_topic}.json` per sub-topic; the page ships only the index; the plot fetches a sub-topic on demand | The plot needs ~200 KB at a time out of 25.6 MB. Same shape of solution the stance-summaries spec already chose for `ideology/persons/`. Not in this effort. |
| Loading UX | Staged progress bar + 使い方 tip cards + quiz/fact cards, all three | Asked for explicitly. |
| Card content | Institutions (seat counts, terms, session types, how a bill passes), how KOKKAI DOC works, **and** real site numbers from a small stats file the nightly label job writes | Topical without being stale; the stats file is tiny and separate from the data the screen is waiting for. |
| Naming | A named politician appears only with neutral activity counts (発言数, 質問回数, 登壇した委員会数, 当選回数). AI-label facts are site-wide aggregates only (「やり取りの X% が…」) | Keeps AI verdicts on individuals off a screen that precedes every caveat; consistent with the landing page and the benefit-of-the-doubt rule for labels. |
| Overlay lifetime | The card lives in a layout-level overlay that survives the `loading.tsx` boundary; once shown, it stays until answered or closed | Nothing gets cut off mid-question. |
| Fast path | No overlay if the dashboard is ready within ~1 s and the card has not been touched; 「次回から表示しない」 opt-out in `localStorage` | Today every click waits several seconds, so this rule rarely triggers; it matters the day §6 ships and landing-page clicks become prefetched and instant. Regulars must never get an interstitial. |
| Progress honesty | The bar advances through named stages on a time curve and jumps to 100 % on the real mount signal; after 15 s a 「時間がかかっています…」 line with a reload link. Stage names describe the datasets actually being prepared (§5.2), never invented steps | The browser cannot observe server progress; say what is known, do not fake precision. The datasets named are genuinely in the response, so the "heavy data work" impression is true. |

Resolved from the codebase (no decision needed):

- `ParliamentExplorerClient` already re-reads `person_id` from `window.location` on mount
  (`readFromUrl`), so dropping the server-side `searchParams` read changes nothing visible and
  restores the ISR behaviour the page's own comment describes. `?tour=1` and `?open=donate` are
  already read on the client.
- The Vercel function region is not pinned (no `vercel.json`). `{"regions": ["hnd1"]}` puts the
  render next to the backend; one region is allowed on every plan.
- `useLinkStatus` (Next ≥ 15.3; the project is on 16.0.7) gives the landing buttons an immediate
  pending state without any new state plumbing.
- The quality-aggregate proxy (`app/api/speeches/quality_person/route.ts`) is the template for the
  new proxy routes: `revalidate = 600`, `X-API-KEY` from the server env, 10-minute `Cache-Control`.
- `data/speech_quality/publish.py::rebuild` already writes `aggregate.json` and queues paths for the
  nightly upload; the stats file is one more document written there.
- `data/topic_scaling/publish.py::write_document` writes the live `ideology.json.gz` and the dated
  copy; the split files are written in the same call so they never drift from the document.

## 4. Non-goals

- No shortening of the wait in this effort: no payload split, no ISR change, no region pin (§6, §7 record them for later).
- No redesign of the dashboard, the landing page, or the scatter plot's interactions.
- No change to the scaling pipeline's maths or to `ideology.json.gz` itself (it stays, for the
  dated history and for any script that reads it).
- No service worker, no offline mode, no client-side cache beyond the browser's own.
- No moving of the other four datasets off the page in this spec (§10 lists it as follow-up).
- No AI-label ranking by name anywhere on the loading screen.

## 5. The loading experience (this effort)

### 5.1 Files

```
frontend/app/app/
  layout.tsx                 ← new: wraps page + loading in <LoadingOverlayProvider>
  loading.tsx                ← new: signals "pending" to the overlay store; renders nothing itself
  page.tsx                   ← remove the dead LoadingState + <Suspense> (fallback can never render)
frontend/app/components/loading/
  LoadingOverlay.tsx         ← the full-screen panel: progress, tips, cards, dismiss, opt-out
  LoadingProgress.tsx        ← staged bar + stage label + slow-load line
  LoadingCard.tsx            ← one tip / fact / quiz card, paging controls
  loadingStore.ts            ← tiny useSyncExternalStore store: pending, ready, shownAt, touched
  content/
    tips.ts                  ← 使い方 tips (reuse TOUR_STEPS titles/bodies where they fit)
    facts.ts                 ← static institution + site facts, each with `source`
    quiz.ts                  ← static multiple-choice items, each with `answer`, `explain`, `source`
    siteStats.ts             ← templates that turn site_stats.json into fact/quiz items
frontend/app/api/site-stats/route.ts   ← proxy for backend /speeches/quality/site_stats (second PR)
```

### 5.2 Behaviour

- **Mount signal.** `loading.tsx` mounts → `store.pending = true, shownAt = now`. It unmounts when
  the page payload arrives. `ParliamentExplorerClient` calls `store.markReady()` in a mount effect;
  that is the only "100 %" signal.
- **Overlay visibility.** The overlay is rendered by `layout.tsx` so it lives across the
  loading → page swap. It is visible when `pending`, or when `ready` arrived after
  `shownAt + 1000 ms`, or when the user touched a card. It hides on 閉じる, on answering the last
  shown question (after the explanation is read: a 「ダッシュボードへ」 button), or immediately on
  `ready` if none of those held. Dismissal is a fade; the dashboard underneath is already
  interactive once `ready`.
- **Direct hits on a cached `/app`** arrive as complete HTML, so `loading.tsx` never mounts and no
  overlay appears. Cold ISR renders and client-side navigations do show it.
- **Progress stages** (time curve, in Japanese). Each names something that really is inside the
  response, in the order the page's `Promise.all` lists them, with a one-line sub-caption:
  1. 「議員データを呼び出し中」 — 衆参の現職・歴代議員の名簿と選挙区 (0–25 %, first 1.5 s)
  2. 「立場推定の結果を展開中」 — 12テーマ・約60論点、9万点超の推定位置 (25–55 %, to 4 s)
  3. 「やり取りのAI判定を集計中」 — 2000年以降の質疑をラベル付けした集計 (55–80 %, to 6.5 s)
  4. 「地図とグラフを描画中」 — 選挙区ポリゴンと散布図 (80–95 %, asymptotic)
  → 100 % 「準備ができました」 on `ready`. Counts in sub-captions are approximate words
  (約, 超) so they do not go stale; exact numbers live on the fact cards. After 15 s without `ready`: 「時間がかかっています。もう少しお待ちいただくか、
  再読み込みしてください。」 with a reload link. Respects `prefers-reduced-motion` (no bar animation,
  stage text only).
- **Cards.** The first card appears at `shownAt + 800 ms`. Order: one tip, then alternate
  fact / quiz, site-stats items mixed in once `/api/site-stats` has answered (fetched on overlay
  mount, ~2 KB, never blocks). A quiz card shows 3–4 options; tapping reveals correct/incorrect,
  a one-line explanation and the source line. 「次へ」 pages; seen item ids are kept in
  `localStorage` so a returning visitor does not see the same ten first.
- **Opt-out.** 「次回から表示しない」 sets `kokkaidoc.loading.optout = 1`; afterwards the overlay only
  shows the bar (no cards) and hides on `ready` unconditionally. 「使い方」 in the dashboard header
  is where the tips still live, so nothing is lost.
- **Landing buttons.** Each `/app` `<Link>` on the landing page gets a `useLinkStatus` pending
  state (spinner replaces the arrow, button disabled) so the click is acknowledged in the same
  frame even before the loading boundary paints.
- **Style.** Same dark gradient (`#111827 → #020617`), Geist, cyan/indigo accents, card chrome
  from `Stage.tsx`/`Card.tsx`; reuses `LoadingIndicator`.
- **Analytics** (`@vercel/analytics` `track`, same style as `LandingCTA`):
  `DashboardLoad { ms, cold: boolean, overlay: "none" | "bar" | "cards" }`,
  `LoadingCardAnswer { id, correct }`, `LoadingCardDismiss { reason: "close" | "done" | "optout" }`.

### 5.3 Content rules

- Every static fact and quiz item carries a `source` (official 衆議院/参議院 pages, 国会法, the
  site's own 注意事項 wording). You review the list before merge; items without a source do not ship.
- Numbers that change (seat counts after an election, session dates) are not hard-coded as answers;
  they come from `site_stats.json` or are phrased so they stay true (e.g. 「任期は何年？」).
- Named politicians: only from `site_stats.top_speakers` and friends (§8), which are count-based.
- Tone: です・ます, short lines, same as the landing page. Japanese only.

## 6. Optional follow-up — caching quick wins (not part of the loading-screen work)

These two changes are cheap and independent of the split, but **they change when the overlay is
seen**: a static `/app` is prefetched while the visitor reads the landing page, so most clicks become
instant and the overlay stops appearing on the landing → dashboard path (it still shows on cold
regenerations). Do them only when a shorter wait is wanted more than the loading experience.

### 6.1 Static again

- `page.tsx` stops reading `searchParams`; `initialSelectedPersonId` goes away (the client already
  reads the URL). Keep `export const revalidate = 600`. Verify with `next build` that `/app` is
  listed as ISR (`◐`), and after deploy that `x-vercel-cache` is `HIT`/`STALE` with `age > 0`.
- `frontend/vercel.json`: `{"regions": ["hnd1"]}`.
- `getIdeologyData` is replaced by `getIdeologyIndex` (small, cacheable with `next.revalidate`).
  `fetchApiRaw` callers stay as they are; with ISR they run once per 10 minutes, not per visitor.

## 7. Postponed — ideology split

Kept here so the analysis is not lost. Nothing below is scheduled.

**Publish** (`data/topic_scaling/publish.py`, inside `write_document` so the three outputs always
come from the same `doc`):

```
s3_mirror/kokkai-doc/ideology/
  ideology.json.gz                      ← unchanged
  index.json                            ← new
  subtopics/{topic}/{sub_topic}.json    ← new, one per sub-topic (60 today)
```

`index.json` = the document minus every `1d`/`2d`/`2d_current` block, plus per sub-topic
`has_scope: bool` (any point carries `current`) and `n_points: {"1d": …, "2d": …, "2d_current": …}`.
About 60 KB. `subtopics/…json` = `{topic, sub_topic, sub_topic_jp, axis, "1d", "2d", "2d_current"}`
for that one sub-topic, written compact (`separators=(",", ":")`), ~450 KB raw / ~60 KB gzipped.
All three views in one file so the 1D/2D toggle stays instant. Uploaded by the same `upload()` call;
the uploader never deletes, so a sub-topic removed from the config leaves an orphan that nothing
links to (same policy as `persons/`).

**Backend** (`backend/app/routers/ideology.py`): `GET /ideology/index` → `index.json`;
`GET /ideology/subtopic?topic=&sub_topic=` → that file (404 if missing; both read through
`Storage.read_json`, both with the existing API-key dependency). `GET /ideology/` stays.

**Frontend:**

- `app/api/ideology/subtopic/route.ts` proxy (template: `quality_person`), `revalidate = 600`,
  `Cache-Control: public, max-age=600, stale-while-revalidate=3600`.
- `IdeologicalScatterPlot` takes `index: IdeologyIndex` instead of the whole document. It keeps a
  `Map<"topic/sub", SubTopicData>`; on selection change it fetches the missing entry and shows a
  skeleton (same box, pulsing axis line, 「読み込み中」) until it lands. After the first paint it
  prefetches the remaining sub-topics of the current topic during `requestIdleCallback`; other topics
  on demand. Stale selection races are guarded by comparing the requested key on resolve.
- `IdeologyDisclaimerContent` reads its counts from the index (`sub_topics.length`, `n_scaled`,
  `generated_at`, models), so it needs no fetch.
- Types: `IdeologyIndex`, `IdeologySubTopicIndex` (no views), `IdeologySubTopicData` (views) in
  `app/types`. `IdeologyData` stays for the pipeline's dated copies and tests.

**First publish:** hand-run `python -m topic_scaling project --publish-partial` once from the prd
checkout after the PR merges (same step the stance spec needs), check
`s3_mirror/kokkai-doc/ideology/subtopics/defence/constitution.json`, then let the monthly job keep
them current. Until the files exist on S3 the plot shows its empty state, so the frontend PR merges
only after the files are up (or the proxy falls back to slicing `/ideology/` once, cached — not
planned, noted as an option).

## 8. Site stats file

Written by `data/speech_quality/publish.py::rebuild` next to the aggregate, uploaded with it nightly:

```
s3_mirror/kokkai-doc/speech_quality/site_stats.json     (~2 KB)
{
  "version": 1,
  "generated_at": "...",
  "coverage": {"from": "...", "to": "...", "exchanges": N, "meetings": N},
  "n_persons_labelled": N,
  "n_persons_total": N,               ← rows in person table
  "n_current_members": {"lower": N, "upper": N},
  "n_speeches_total": N,              ← speeches table since 2000
  "function_share": {"legislation": 0.12, "oversight": 0.47, ...},    ← site-wide, from totals
  "contribution_share": {"substantive": 0.81, ...},
  "issue_share": {"evasive": 0.06, ...},                              ← site-wide only
  "top_questioners_current": [{"person_id": N, "name": "...", "group": "...", "n": N}, ... 5],
  "top_answerers_current": [ ... 5 ],
  "most_meetings_current": [{"person_id": N, "name": "...", "n_meetings": N}, ... 5]
}
```

Served by `GET /speeches/quality/site_stats` (backend) → `app/api/site-stats` (proxy). The
templates in `content/siteStats.ts` turn it into cards such as 「いま国会で一番質問している議員は？」
(4 options drawn from `top_questioners_current`), 「このサイトが読んだやり取りは何件？」, 「質問の
うち、行政監視にあたるものは約何割？」. No template reads a per-person label count.

## 9. Acceptance

Loading screen (this effort):

| Check | Target |
|---|---|
| Landing → dashboard click | button shows pending in the same frame; overlay within one frame of the route transition |
| Overlay content | stage 1 label visible at once, first card at 0.8 s, stages advance, 100 % and 「準備ができました」 on mount |
| Dashboard arrives mid-card | overlay stays, dashboard interactive underneath, 閉じる / answer dismisses |
| Dashboard arrives < 1 s, card untouched | no overlay |
| Slow load | 15 s line with reload link appears |
| Opt-out | bar only, never cards, hides on ready |
| Reduced motion | no bar animation, stage text only |
| Analytics | `DashboardLoad`, `LoadingCardAnswer`, `LoadingCardDismiss` events arrive in Vercel Analytics |
| Site stats | cards render without the file; stats cards appear once `/api/site-stats` answers |

Caching quick wins (§6, only if done):

| Check | Target |
|---|---|
| `curl -D - https://www.kokkaidoc.com/app` | `x-vercel-cache: HIT` or `STALE`, `age > 0` |
| Warm TTFB from Tokyo | < 300 ms |
| `next build` | `/app` is ISR, not `ƒ` |

Ideology split (§7, postponed): `/app` uncompressed HTML < 5 MB; brotli < 800 KB; sub-topic switch
shows a skeleton and lands within ~300 ms warm.

## 10. Cross-spec note

The stance-summaries spec (§2 "Positions") plans per-sub-topic percentile bars "from data already
loaded for the plot". After this split the plot holds one sub-topic at a time, so those percentiles
should be computed at publish time into `ideology/persons/{person_id}.json`. Record that in the
stance spec when it is picked up again.

## 11. Follow-ups (not in scope)

- Move the quality aggregate (1.3 MB) and the member table off the page the same way, fetched after
  first paint; that takes the HTML under 1 MB.
- Lazy-load `deck.gl` + `maplibre-gl` for the map card (`next/dynamic`, `ssr: false`) so the first
  paint does not wait on the map bundle.
- A Vercel-side `/api/ideology/subtopic` fallback that slices `/ideology/` once, if the hand publish
  turns out to be a recurring nuisance.

## 12. Open questions

- None blocking. Quiz/fact wording is drafted by the implementer and reviewed by you before merge (§5.3).

## 13. Task list

Now — the loading screen (frontend, one PR to `dev`):

1. `loadingStore.ts`, `app/app/layout.tsx`, `app/app/loading.tsx`, `markReady()` in
   `ParliamentExplorerClient`; remove the dead `LoadingState` + `<Suspense>` from `page.tsx`.
2. `LoadingOverlay` / `LoadingProgress` / `LoadingCard`, stage labels (§5.2), content files
   (tips, facts, quiz with sources), opt-out, reduced motion, analytics.
3. `useLinkStatus` pending state on the three landing `/app` buttons.
4. You review the fact/quiz list; merge; `finalize`.

Next PR — site stats cards (pipeline + backend + frontend):

5. `site_stats.json` in `speech_quality/publish.py::rebuild`, backend route, `app/api/site-stats`
   proxy, `content/siteStats.ts` templates. Cards work without it, so this can trail.

Later, if wanted (§6): `vercel.json` regions; drop `searchParams`; confirm ISR; re-measure.

Postponed (§7): the ideology split, in the order publish → backend → frontend, with the
`docs/agents` updates listed there.

## 14. As built (2026-11-11)

Tasks 1–4 of §13 are done; the quiz wording was approved by the owner on 2026-11-11.

- **Direct visits start the clock from the layout, not from `loading.tsx`.** React never hydrates a
  server-rendered Suspense fallback, so on a direct hit `LoadingSignal` inside `loading.tsx` never
  runs. `LoadingOverlay` therefore calls `loadingStore.start()` in its own layout effect when no
  dashboard is mounted, and on the first load of the document counts from `performance.timeOrigin`.
  `loading.tsx` keeps a static backdrop with the stage-1 label for the ~0.5 s before hydration and
  still signals client-side navigations. On a direct hit, scripts only run once the browser has the
  shell, so the interactive overlay appears about 0.1 s after navigation in local tests.
- **Deep links are read when the dashboard mounts** (`markReady`), not when the overlay mounts:
  during a client navigation the address still shows `/` when the layout first renders.
- **Fast path** is decided from `dashboardMounted`: if the page is already mounted when the overlay
  mounts (cached or router-cache navigation), nothing is shown.
- **Checklist labels** are short forms (議員データ / 立場推定 / AI判定の集計 / 地図とグラフ); the long
  stage label stays as the heading.
- `page.tsx` still reads `searchParams`; `/app` stays dynamic as agreed (§6 is optional, later).
- **Site stats cards (§8) were added to the same PR on request.** Differences from §8:
  `top_speakers_current` (発言数 since 2000) replaces `most_meetings_current`, and
  `top_terms_lower_current` (衆院当選回数 from the member snapshot) and `outcome_share` are added.
  `issue_share` adds questioner- and answerer-side flags (so 答弁のはぐらかし counts). `rebuild()` writes
  the file after the aggregate (~7 s, two scans of `speeches`), wrapped so a failure never breaks the
  label publish; `--site-stats` rewrites it alone. Ranking questions are only asked when first place is
  unique. `/api/site-stats` is `force-dynamic`: a route with no input is otherwise prerendered at build
  and bakes in whatever the backend said then (seen locally as a cached 404).
- The deck is 8 tips + 13 facts + 11 quiz questions, plus up to 7 quiz and 4 fact cards from the stats,
  spliced in right after the card being read once `/api/site-stats` answers.
- **First publish:** the nightly job writes and uploads `site_stats.json` once this reaches `prd`
  (the launchd job runs from the prd checkout). To have the cards before that, run from the prd
  checkout after the merge: `python -m speech_quality.publish --site-stats` then
  `python -m speech_update upload`. Until then `/api/site-stats` returns 404 and only the static cards show.

Local check: production build against a mock backend that serves `s3_mirror` with a 6 s delay
(reproduces the 34 MB page). Playwright + Chrome:

| Scenario | Result |
|---|---|
| Landing → 「ダッシュボードを開く」 | overlay 0.1 s after click; dashboard mounted at 7.0 s; overlay held after answering a quiz; 「ダッシュボードへ」 closes it |
| Opt-out set | bar only, no cards; gone on ready |
| 「使い方を見ながら試す」 (`?tour=1`) | overlay during load, not held after ready |
| Direct hit on a phone viewport | overlay 0.1 s; ready 7.6 s; held; Esc closes |
| Back to `/`, forward to `/app` | dashboard from router cache, overlay never shown |

