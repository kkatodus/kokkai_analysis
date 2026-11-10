# Landing page with motion-graphics feature tour

**Status:** built 2026-11-10 on `landing-page` (see §14 for what differs from the plan); awaiting review → PR to `dev`
**Branch / worktree:** `landing-page` in `../kokkai_analysis-landing` (off `origin/dev`)
**Related guides:** [FRONTEND.md](../../docs/agents/FRONTEND.md), [CONTRACTS.md](../../docs/agents/CONTRACTS.md)
**Related code:** `frontend/app/page.tsx`, `frontend/app/components/ParliamentExplorerClient.tsx`, `frontend/app/components/tutorial/tutorialSteps.ts`, `frontend/app/lib/quality.ts`, `frontend/app/lib/config/parties.ts`

## 1. Goal

Give first-time visitors (target: Japanese adults 18–30s) a page that answers
「このサイトで何ができるの？」 in under two minutes, using animated replicas of the
real dashboard rather than text, and sends them into the dashboard with a clear next action.

Today `kokkaidoc.com/` drops visitors straight into the dense explorer dashboard. The guided
tour (「使い方」) helps, but only after they have already landed in the middle of it.

## 2. Decisions (agreed in the grilling session)

| Topic | Decision | Why |
|---|---|---|
| Route | Landing page at `/`; dashboard moves to `/app` | First visit and crawlers see the intro. Old root links keep working via redirects (§4). |
| Motion tech | Code-driven: lightweight React replicas of the real cards, animated with Framer Motion (`motion` package) | Crisp at any DPR, dark-theme native, no video assets, stays in sync with the real UI's labels because it imports the same label maps. |
| Audience / tone | Young Japanese adults, casual but trustworthy (です・ます, short lines, no slang) | Politics site: personality without losing credibility. Disclaimers stay but move to a calm section near the end. |
| Hero promise | 「その議員、国会で何してる？」 accountability angle | The exchange-quality labels are the differentiator; the page is sequenced to pay this question off. |
| Sample data | Fictional member 「国会 太郎」, party 「サンプル党」, fictional exchanges, small 「サンプル」 badge | No real politician carries an AI verdict on a marketing page; data never goes stale. |
| Playback | Each section plays once on entering the viewport, then idles; 「もう一度見る」 replay; reduced-motion shows the final frame | Works on phones, predictable to build, accessible. |
| Sections | Eight, in the order of §5 | Thorough as requested; seat charts are mentioned inside the map section rather than getting their own. |
| Return visits | Always show the landing; sticky 「ダッシュボードへ」 button | No cookie logic, SEO-stable, one click for regulars. |
| Map replica | Inline simplified SVG of Japan with ~10 highlighted districts | Avoids pulling deck.gl + maplibre + multi-MB GeoJSON into the landing bundle. |
| Visual style | Same dark navy (#111827 → #020617) + neon party palette + cyan/indigo accents + Geist; bigger type, more whitespace | Replicas look identical to what the visitor lands on in `/app`. |

Resolved from the codebase (no decision needed):

- Cognito admin login returns to `/` with `code` + `state`; payment pages link to `/?open=donate`; shares use `/?person_id=`. One redirect rule covers all of them (§4) so neither Cognito callback URLs nor payment flows change.
- The tutorial is started through `TutorialContext.start()` with no URL trigger. Add `?tour=1` support on `/app` so the landing CTA can deep-link into the tour.
- Japanese only, like the rest of the site. `<html lang>` on the landing route is `ja`.

## 3. Non-goals

- No redesign of the dashboard itself.
- No English version.
- No scroll-scrubbed animation, no video files, no Lottie.
- No A/B testing infrastructure; analytics events only (§9).
- No change to the About page content (it is linked, not merged).

## 4. Routes and redirects

```
/            landing page (new)            static, revalidate never (pure UI + bundled sample data)
/app         dashboard (moved from /)      ISR revalidate = 600 as today, same ParliamentExplorerClient
/about, /privacy, /terms, /payment-*       unchanged
```

Redirects in `next.config.ts` (`redirects()`), all `permanent: false` (307) so they can be revisited:

| Match | → | Reason |
|---|---|---|
| `/` with query `person_id` | `/app?person_id=…` | existing shareable links |
| `/` with query `open` | `/app?open=…` | payment-cancel / payment-success return links |
| `/` with query `code` and `state` | `/app?code=…&state=…` | Cognito OIDC callback (`NEXT_PUBLIC_COGNITO_REDIRECT_URI` stays as the root) |
| `/` with query `tour` | `/app?tour=1` | convenience |

Next.js `has: [{ type: "query", key: "person_id" }]` matching preserves the full query string on the destination automatically.

Links that change from `/` to `/app`:

- `app/about/page.tsx` 「トップへ戻る」 → split into 「トップへ」 (`/`) and 「ダッシュボードへ」 (`/app`).
- `app/payment-success/page.tsx` and `app/payment-cancel/page.tsx`: the plain `/` link becomes `/app`; the `/?open=donate` links become `/app?open=donate` (the redirect would also catch them, but direct is cleaner).
- `app/lib/config/auth.ts`: no change. The root receives the callback and the redirect forwards it; `react-oidc-context` reads `code`/`state` from the URL on `/app`.

Dashboard header gains a small 「トップ」 text link beside the logo so users can get back to the landing (currently the logo is not a link).

`/app?tour=1`: `ParliamentExplorerClient` reads the param on mount, calls `tutorial.start()`, strips the param (same pattern as the existing `open=donate` handling at `ParliamentExplorerClient.tsx:224–233`).

## 5. Page structure and storyboards

Page width: `max-w-6xl`, 16 px side gutter on phones. Each feature section is a two-column layout on ≥1024 px (copy 5/12, animated replica 7/12, alternating sides) and stacked on phones (copy first, replica below, replica height capped at 70 vh).

Every replica sits inside a `Stage` frame: `rounded-2xl border border-white/5 bg-gradient-to-br from-gray-800 to-[#020617] shadow-2xl`, the same as a dashboard card, with a 「サンプル」 pill (top-right, `text-[10px] text-gray-400 border-slate-400/25`) on any stage that shows member data.

Timings below are for the one-shot play; "idle" is what loops afterwards. All durations are design targets, not contracts.

### 5.1 Hero — 「その議員、国会で何してる？」

Layout: full viewport height on desktop, centred.

Copy:

- Eyebrow: `KOKKAI DOC` with the cyan→indigo dot (same as the dashboard header).
- H1: 「その議員、国会で何してる？」
- Sub: 「国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。」
- Primary CTA: 「ダッシュボードを開く」 → `/app`
- Secondary CTA: 「使い方を見ながら試す」 → `/app?tour=1`

Stage (below the copy on phones, right of it on desktop): replica of the 歴代議員検索 card.

| t | Beat |
|---|---|
| 0.0 s | Card fades in. Input shows placeholder 「議員名（漢字・かな）」. |
| 0.6 s | Caret appears; types 「こっか」 one character every 120 ms. |
| 1.2 s | Dropdown slides down with 3 rows: 「国会 太郎 ／ サンプル党 ／ 衆議院」, 「国会 花子 ／ サンプル党 ／ 参議院」, 「国会 次郎 ／ 無所属 ／ 元議員」. |
| 2.0 s | Cursor dot moves to row 1; row highlights (`bg-slate-900/65`). |
| 2.4 s | Click ripple; row 1 pins as the selected chip; the stage's right edge shows a sliver of the detail pane sliding in (teaser for §5.2). |
| idle | Caret blinks; every 6 s the dropdown subtly re-pulses. |

Background: slow radial gradient drift (cyan/indigo at 8 % opacity) over the navy, 20 s loop, disabled under reduced motion.

### 5.2 発言を読む — detail pane, topics, labels

Copy:

- H2: 「発言を、トピック別に読む。」
- Body: 「議員をクリックすると詳細パネルが開きます。防衛・経済対策・少子化など、気になるトピックだけ読めます。AIが判定した発言には 種類／成果／問題点 のラベルが付きます。」
- Small caption: 「ラベルは推定です。気になったら原文へ。」

Stage: replica of the right-hand detail pane (`DetailPane`), 360 px wide on desktop.

| t | Beat |
|---|---|
| 0.0 s | Pane slides in from the right (as in the real app). Header: 「国会 太郎」, 「サンプル党・衆議院」, below it the compact 「やり取りの評価（AI判定）」 summary row: 「質問 42 件 ／ 実質的な成果あり 48 % ／ 限定的 38 % ／ 成果なし 14 %」 with a three-colour bar (emerald / amber / red). |
| 0.8 s | Three tabs appear: 発言 ｜ やり取り ｜ 選挙履歴; 発言 underlined. |
| 1.2 s | Topic chips row: 全発言, 防衛, 経済対策, 少子化, 社会保障全般（医療・介護）. The cursor clicks 「経済対策」; chip fills cyan. |
| 1.8 s | Two speech cards stagger in (80 ms apart). Each: date 「2026-05-14」, meeting 「予算委員会」, 2-line excerpt, then the chips. |
| 2.6 s | Chips animate in one at a time on card 1: 「種類：政策論議」(slate), 「成果：実質的」(emerald), 「成果の内訳：新事実」(emerald outline). Card 2: 「種類：行政監視」, 「成果：限定的」(amber), 「問題点：答弁のはぐらかし 答弁」(red). |
| 3.4 s | A 「会議を閲覧する」 button on card 1 gets a cyan glow pulse (hand-off to §5.3). |
| idle | Pagination arrows (top right) tick between 1/3 and 2/3 every 5 s, swapping the excerpts. |

Label strings and colours come from `app/lib/quality.ts` (`FUNCTION_LABEL`, `CONTRIBUTION_SHORT`, `ISSUE_LABEL`, `OUTCOME_SHORT`, colour tokens), imported directly so they cannot drift.

### 5.3 会議をまるごと — issue pane, dial, bands

Copy:

- H2: 「その場面を、会議まるごと読む。」
- Body: 「「会議を閲覧する」で、その日の会議全体が開きます。ダイヤルを回すと発言をすばやく移動。色の帯は、AIが区切った「やり取り」とその成果（緑＝実質的、橙＝限定的、赤＝成果なし）。」
- Caption: 「「原文を開く」で国会会議録検索システムの該当ページへ飛べます。」

Stage: replica of `IssuePane` on the left (dial + list), 420 px wide.

| t | Beat |
|---|---|
| 0.0 s | Pane slides in from the left. Title 「予算委員会 第3号 2026-05-14」. |
| 0.6 s | Circular dial (`DialSelector` look: ring with ~40 ticks, a knob at 12 o'clock) draws its ring clockwise. |
| 1.2 s | Speech list below: 8 rows, speaker name + 1-line excerpt; left edge of each row has a 3 px band. Rows 1–3 emerald, 4–5 amber, 6–8 red, with a 「判定理由」 note card above each group: e.g. 「新事実が出た：担当省庁が未公表の数字を答弁で示した。」 |
| 2.0 s | Knob drags from 12 o'clock to ~4 o'clock over 1.2 s; the list scrolls in sync and the focused row gets a cyan ring. |
| 3.4 s | 「原文を開く」 link on the focused row highlights; a tiny external-link icon nudges right. |
| idle | Knob drifts ±10° every 4 s with the list following. |

### 5.4 比べる — exchange ranking

Copy:

- H2: 「ほかの議員と、比べる。」
- Body: 「委員会での質疑を「やり取り」単位でAIが判定し、議員ごとに集計。並び替えは、実質的な成果・お膳立て質問・答弁のはぐらかしなど28の指標から選べます。白い縦線は全議員の平均です。」
- Caption: 「「最低やり取り数」で件数の少ない人を除けます。」

Stage: replica of `SpeechQualityBarList` (the 「やり取りの評価（AI判定）」 card).

| t | Beat |
|---|---|
| 0.0 s | Card header + a 「並び替え」 select showing 「実質的な成果の割合」. 8 bar rows grow from 0 to their widths (staggered 60 ms). Names: 国会 太郎, 国会 花子, … 8 fictional names, party-coloured dots. A thin white vertical baseline at ~43 % labelled 「全体 43.0%」. |
| 1.6 s | Cursor opens the select; options list shows 4 visible rows: 実質的な成果の割合 ／ お膳立て質問の割合 ／ 答弁のはぐらかしの割合（答弁者として） ／ 新事実が出た割合（答弁者として）. |
| 2.2 s | Clicks 「お膳立て質問の割合」. Rows re-sort with layout animation (Framer `layout`), bar colours switch to the amber issue tone, baseline moves. |
| 3.4 s | A 「最低やり取り数 20」 stepper ticks to 50; two rows fade out and the list compacts. |
| idle | Every 6 s the sort flips between the two metrics. |

Metric labels come from `QUALITY_METRICS` in `app/lib/quality.ts` (`label` field).

### 5.5 立場を見る — ideology scatter

Copy:

- H2: 「どこに立っているかを、見る。」
- Body: 「国会での発言から、論点ごとの立場を推定した図です。1D は「反対 ↔ 賛成」の軸、2D は近い人ほど似た語り方をしていることを示します。点をクリックするとその議員の詳細が開きます。」
- Caption: 「投票行動や公約ではなく、国会での発言だけが材料です。推定には誤差があります。」

Stage: replica of `IdeologicalScatterPlot` (SVG, ~60 points with fictional party colours from `PARTY2RGBCOLOR`).

| t | Beat |
|---|---|
| 0.0 s | Two selects at top: 「トピック：原発」「論点：原発の再稼働」. Toggle 1D ｜ 2D with 1D active; 「現職のみ」 checkbox. |
| 0.6 s | 60 points pop in along a horizontal band; labels 「反対（左）」 and 「賛成（右）」 at the bottom corners. |
| 1.6 s | Cursor clicks 2D; points glide (1 s, spring) to 2D positions forming 3 loose clusters. Axis labels fade out. |
| 2.8 s | Cursor clicks 「現職のみ」; ~20 points fade to 15 % opacity. |
| 3.4 s | Cursor hovers one point; tooltip 「国会 太郎 ／ サンプル党」 and a cyan ring. |
| idle | Points breathe (±1 px drift, 3 s loop). Every 8 s 1D↔2D flips. |

### 5.6 地元を見る — district map and election history

Copy:

- H2: 「地元の議員を、地図から。」
- Body: 「地図の選挙区をクリックすると、その選挙区の衆議院・参議院議員が並びます。「比例」に切り替えると比例代表の名簿から探せます。議員の「選挙履歴」タブで、これまでの当落・選挙区・所属政党も見られます。」
- Caption: 「参議院・衆議院の現職の党派別議席数もダッシュボードで確認できます。」

Stage: simplified Japan SVG (prefecture outlines, ~47 paths, hand-simplified to < 30 KB) with ~10 districts filled in neon party colours, rest at `#1e293b`. A small 選挙区 ｜ 比例 toggle at the top.

| t | Beat |
|---|---|
| 0.0 s | Outline draws (stroke-dashoffset, 1.2 s). Coloured districts fade in. |
| 1.4 s | One Kantō district pulses; cursor clicks it. |
| 1.8 s | Side list slides up: 「東京 1区」 with 2 fictional members (衆・参), party dots. |
| 2.6 s | Click on a member; a mini 「選挙履歴」 table appears: 3 rows 「2024 衆院選 ／ 東京1区 ／ サンプル党 ／ 当選」, 「2021 … ／ 落選（比例復活）」, 「2017 … ／ 当選」. |
| 3.6 s | Toggle flips to 「比例」; list changes to 「比例 東京ブロック」 with 3 names. |
| idle | A different district pulses every 5 s. |

### 5.7 どうやって？ — method and limits

Calm section, single column, `max-w-3xl`, no stage. Three short cards:

1. **データ** 「国会会議録検索システム（国立国会図書館）の全会議録、衆参の議員名簿、選挙区ポリゴン。詳しくは「このプロジェクトについて」へ。」 → link `/about`
2. **AIの判定** 「委員会の質疑を「やり取り」単位で読み、何のための議論か・成果があったか・問題点があったかをラベル付けしています。党派によって基準を変えません。迷ったら本人に有利に判定します。」
3. **限界** 「表示される数値や図は、すべて会議録からの推定・参考情報です。誤りも含まれます。気になったら必ず原文を確認してください。」 → link to the dashboard's 注意事項 (`/app` then the 注意事項 button; no deep link needed).

Each card has a 24 px line icon (react-icons, already a dependency) that draws in on entry (stroke animation, 0.6 s).

### 5.8 一人で運営 — support and final CTA

Copy (adapted from the tour's 「このサイトは一人で運営しています」 step and the donate modal):

- H2: 「このサイトは、一人で運営しています。」
- Body: 「KOKKAI DOC は個人が趣味として開発・運営している非営利プロジェクトです。会議録の取得、AIによる分類、サーバー代は自己負担です。続けていくために、ご寄付はいつでも歓迎です。金額にかかわらず、大きな励みになります。」
- Buttons: 「募金について見る」 → `/app?open=donate`; 「ダッシュボードを開く」 → `/app`
- Footer: links to このプロジェクトについて, プライバシーポリシー, 利用規約, X `@kokkaidoc`, YouTube `@kokkaidoc_no_naka`, mail `kokkai.doc[アット]gmail.com`.

Stage: none. A soft cyan→indigo glow behind the buttons (static).

### Sticky header

`LandingHeader`: logo + dot, 「このプロジェクトについて」, 「ダッシュボードへ」 (cyan, same style as the dashboard's donate button). Transparent over the hero; gains `bg-[#020617]/80 backdrop-blur` after 80 px scroll. On phones the two links collapse to the single 「ダッシュボードへ」 button.

## 6. Component architecture

```
frontend/app/
  page.tsx                        → landing (server component, static)
  app/page.tsx                    → today's page.tsx moved here (ISR 600)
  components/landing/
    LandingHeader.tsx
    Hero.tsx
    FeatureSection.tsx            copy + Stage + replay; IntersectionObserver trigger
    Stage.tsx                     card frame, サンプル badge, reduced-motion handling
    stages/
      SearchStage.tsx             §5.1
      DetailPaneStage.tsx         §5.2
      IssuePaneStage.tsx          §5.3
      RankingStage.tsx            §5.4
      ScatterStage.tsx            §5.5
      MapStage.tsx                §5.6  (japan-simplified.svg inlined as a TSX const)
    MethodSection.tsx             §5.7
    SupportSection.tsx            §5.8
    Cursor.tsx                    fake pointer that moves between targets (motion.div, spring)
    useStagePlayback.ts           play-once / idle / replay state machine
    sampleData.ts                 国会 太郎 et al., exchanges, ranking rows, scatter points
```

Rules:

- Stages import label maps and colour tokens from `app/lib/quality.ts` and `app/lib/config/parties.ts`. They do **not** import the real visualisation components (which pull d3/deck.gl/maplibre).
- Animation library: `motion` (Framer Motion v12 package name). Add to `package.json`. Use `useReducedMotion()` to short-circuit every stage to its final frame.
- `useStagePlayback`: states `idle-before` → `playing` → `idle-after`; entering `playing` on first `IntersectionObserver` hit at 40 % visibility; `replay()` resets to `playing`. Idle loops are CSS keyframes or `repeat: Infinity` with low amplitude.
- `Cursor` is a single shared component per stage: a 14 px circle with a 1 px white ring and a 25 % cyan fill; moves with `animate={{ x, y }}` spring; "click" = scale 0.8 → 1 in 150 ms plus a 24 px expanding ring.
- All text in stages is real DOM text (not SVG where avoidable) so it scales with the phone root font size (globals.css sets 10 px on ≤ 480 px).

## 7. Sample data (`sampleData.ts`)

- Members: 国会 太郎（サンプル党・衆）, 国会 花子（サンプル党・参）, 国会 次郎（無所属・元）, plus 5 more for the ranking: 議会 三郎, 議会 四子, 審議 五郎, 会議 六子, 答弁 七郎. Parties restricted to サンプル党 (rendered with the 自民 neon periwinkle), 無所属 (bright slate), and 議論党 (rendered with the 立憲 neon orange) so no real party name appears.
- Exchanges: 4 fictional excerpts, ≤ 60 chars each, about generic policy (e.g. 「中小企業向けの価格転嫁支援について、実施状況と今後の予算規模を伺います。」). No real bill names, ministries, or people.
- Ranking: 8 rows, two metric vectors (実質的な成果の割合, お膳立て質問の割合), baseline values.
- Scatter: 60 points with 1D x and 2D (x, y), 3 clusters, `incumbent` flag on 40.
- Map: 10 district ids → party key; 東京1区 member list; 比例 東京ブロック list; 3-row election history.

## 8. Performance and accessibility budget

- Landing JS (route-level, gz): ≤ 120 KB on top of the Next runtime. `motion` ≈ 35 KB gz; no d3, deck.gl, maplibre, mapbox on this route (verify with `next build` output).
- LCP target < 1.5 s on a mid-range phone; the hero's LCP element is the H1 text, not an image.
- No layout shift from stages: every Stage has a fixed aspect ratio (`aspect-[4/3]` desktop, `aspect-[3/4]` phone) and renders its final frame as the SSR output.
- `prefers-reduced-motion`: final frames only, replay buttons hidden, cursor hidden.
- Every stage has `aria-hidden="true"` and a visually-hidden one-sentence description of what it shows, since the copy already explains it.
- Contrast: body text `text-gray-300` on `#020617` passes AA; captions `text-gray-400` at ≥ 13 px.
- Keyboard: header links, CTAs, replay buttons reachable; stages are not focusable.

## 9. Analytics (Vercel Analytics, existing `track` helper)

| Event | Props | Where |
|---|---|---|
| `LandingView` | — | once per page load |
| `LandingSectionView` | `{ section }` | first time each section reaches 40 % |
| `LandingReplay` | `{ section }` | replay button |
| `LandingCTA` | `{ cta: "open_app" \| "tour" \| "donate" \| "about", location }` | every CTA / header link |
| `Navigate` (existing) | `{ destination: "/", location: "dashboard_header" }` | dashboard → landing link |

## 10. SEO and metadata

- `app/page.tsx` exports `metadata`: title 「KOKKAI DOC ｜ その議員、国会で何してる？」, the existing description, OpenGraph image `public/og-landing.png` (1200×630, dark navy, logo + H1, generated once by hand), `alternates.canonical = https://kokkaidoc.com/`.
- `/app` keeps title 「KOKKAI DOC」 and gets `robots: { index: true }`; nothing is noindexed.
- Add `app/sitemap.ts` listing `/`, `/app`, `/about`, `/privacy`, `/terms`. (None exists today.)
- Lighthouse SEO/accessibility ≥ 95 before merge.

## 11. Rollout

1. Build on `landing-page` branch in `../kokkai_analysis-landing`; PR → `dev`; verify on `staging.kokkaidoc.com` including the four redirect cases in §4 and the Cognito admin login round-trip.
2. PR `dev` → `prd`.
3. After release: update the X / YouTube profile links to point at `/` (they already do), and change any ad creative links to `/`.

## 12. Task list

- [x] Move dashboard to `/app`; add redirects; fix about/payment links; dashboard header 「トップ」 link; `?tour=1`.
- [x] Add `motion`; `Stage`, `useStagePlayback`, `Cursor`, `FeatureSection`.
- [x] `sampleData.ts`.
- [x] Stages 5.1–5.6.
- [x] Hero, Method, Support, LandingHeader, footer.
- [x] `sitemap.ts`, metadata, OG image (`public/og-landing.png`, rendered from an HTML template in headless Chrome).
- [x] Reduced-motion pass (stages render their final frame, replay button and cursor hidden), keyboard pass (only header links, CTAs and replay buttons are focusable), bundle check (landing HTML references ≈ 260 KB gz of JS including the Next/React runtime; no deck.gl, maplibre or d3 chunk).
- [x] Analytics events (§9).
- [x] `docs/agents/FRONTEND.md` routes updated.
- [ ] Lighthouse SEO/accessibility ≥ 95 (run on staging before merge).
- [ ] Verify the four redirect cases and the Cognito admin login round-trip on `staging.kokkaidoc.com` (§11).

## 13. Open questions (not blocking)

- Should the X/YouTube icons in the footer use brand SVGs from react-icons or plain text? Default: react-icons.
- OG image: hand-made PNG now, or a `opengraph-image.tsx` route later? Default: PNG now.
- Does 「サンプル党」 need an explicit footnote 「架空のデータです」 beyond the badge? Default: add one line under §5.2's caption on first use.

## 14. As built (deviations from the plan)

- **Map outlines** come from `@svg-maps/japan` 2.0.0 (CC BY 4.0), Douglas–Peucker-simplified to ≈ 14 KB in `stages/japanPrefectures.ts`; the footer credits the source. Hand-tracing 47 prefectures was not worth it.
- **Method-section icons** fade and spring in rather than stroke-draw; `react-icons` glyphs are filled paths, not strokes.
- **Playback** is step-based: each stage has a `TIMES` array and `useTimeline` returns the number of beats elapsed, so the final frame is simply "every beat done". That frame is also the SSR output (`initial={false}` when not playing), which avoids both layout shift and hydration warnings.
- **Cursor** targets `data-cursor="…"` elements and measures them at each beat instead of using hand-tuned coordinates, so it survives responsive layouts.
- **Sample counts** were nudged so the 最低やり取り数 step (20 → 50) removes exactly two rows: 国会 太郎 has 58 exchanges everywhere, not 42.
- **`<html lang>`** is `ja` site-wide (the whole site is Japanese), not only on the landing route.
- The hero's detail-pane sliver and §5.2's first speech card reuse the real `QualityChips` components, so chip text and colours cannot drift.

