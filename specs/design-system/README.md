# Design system: DESIGN.md, tokens and shared components

Status: phases 0–1 built (2026-11-11/12); later phases in progress. Type scale, fonts, the header button and the party palette were confirmed on 2026-11-11 (§9). `frontend/DESIGN.md` is written; this spec is the plan for making the code match it.

## 1. Goal

Give the frontend one written design system and make the code follow it, so that pages and panels stop drifting apart and new UI can be built from named parts.

Deliverables:

1. [`frontend/DESIGN.md`](../../frontend/DESIGN.md) — the target system in the [DESIGN.md format](https://github.com/google-labs-code/design.md) (YAML tokens plus prose). Done in this branch.
2. A token layer in `frontend/app/globals.css` (`@theme`), so every token is a Tailwind utility.
3. Shared components in `frontend/app/components/shared/` that carry the recipes.
4. Migration of existing UI, area by area.
5. A check that stops new off-system classes.

## 2. Why: audit baseline

From the design audit of 2026-11-11 (class inventory of `frontend/app`, live measurements on kokkaidoc.com at 1440px and 390px, and a read of every component).

| Attribute | DESIGN.md target | Today |
|---|---|---|
| Design tokens | all values | `--background` and `--foreground` only, and neither is used by the UI |
| Type sizes | 8 sizes, 13 roles | 16 sizes, 8 of them arbitrary (`text-[11px]` ×119, `text-[10px]` ×87) |
| Smallest text | 12px | 9px; about 82% of visible characters on `/app` are 11px or smaller |
| Root font size | 16px everywhere | 10px at ≤480px (`globals.css`), which makes `text-sm` 8.75px |
| Font | Geist + Japanese gothic stack | Arial: the `body` rule overrides the loaded Geist; no Japanese stack |
| Text colours | 4 inks + accent | 50, mixing `gray-*` and `slate-*` |
| Backgrounds | 5 surfaces | 116 |
| Border colours | 3 lines | 53 |
| Radii | 5 | 12 |
| Selected state | one recipe (cyan) | five recipes, chart toggles in `blue-600` |
| Focus style | one global ring | 0 `focus-visible`, 11 `outline-none` |
| Buttons | 4 variants, 3 sizes, one component | no component; 4 primary, 4 secondary, 3 pill, 3 ghost recipes |
| Chips / badges | 2 components | 6 recipes; shared `Badge` bypassed |
| Loading / empty / error | one component each | 5 recipes each; errors leak English and have no retry |
| Section headings | `h1`–`h3` via one component | 9 recipes, mostly `div` |

Counts of off-system patterns on `dev` (`93fc03fb`), used as the ratchet baseline in §7:

| Pattern | Regex (over `frontend/app/**/*.ts{,x}`) | Count |
|---|---|---|
| Arbitrary text size | `text-\[[0-9.]+(px\|rem)\]` | 256 |
| `gray-*` utilities | `(text\|bg\|border\|fill\|stroke\|ring\|placeholder:text\|decoration)-gray-[0-9]+` | 442 |
| `blue-*` utilities | `(text\|bg\|border\|ring\|shadow)-blue-[0-9]+` | 58 |
| Hex literal in a class | `(bg\|text\|border\|from\|to\|via)-\[#[0-9a-fA-F]+\]` | 81 |
| Opacity-suffixed slate | `(bg\|border\|text\|ring)-slate-[0-9]+/[0-9]+` | 323 |
| White / black alpha | `(bg\|border\|text)-(white\|black)/[0-9]+` | 52 |
| Arbitrary or off-scale radius | `rounded(-[a-z]+)?-\[…\]`, `rounded-(md\|3xl)` | 12 |
| Arbitrary shadow | `shadow-\[…\]` | 11 |
| Arbitrary z-index | `z-\[[0-9]+\]` | 4 |
| `outline-none` | | 11 |
| English `aria-label` | `aria-label="[A-Za-z]…"` | 10 |

## 3. Decisions taken in the draft

These are built into `DESIGN.md`. Each was chosen to stay close to what the site already looks like, so the migration is mostly a renaming. The ones marked "open" in §9 need a yes or no before work starts.

| # | Question | Decision in the draft |
|---|---|---|
| 1 | Theme | Dark only. Remove the unused light/dark `--background` pair; declare `color-scheme: dark`. |
| 2 | Neutral ramp | Slate for surfaces, ink and lines. `gray-*` goes away. The shift from gray to slate ink is barely visible. |
| 3 | Accent | Cyan stays. `blue-*` is removed: chart toggles take the cyan selected recipe, long-form links take `link`. |
| 4 | Solid values, not alpha | Tokens are the flattened colour of today's most common alpha recipe over `#020617` (for example `slate-900/65` → `surface-raised #0b1220`). Contrast is then fixed and checkable. |
| 5 | Type floor | 12px floor, 14px body. This is the biggest visible change: most dashboard text is 11px today. |
| 6 | Root font size | 16px at every width. The `max-width: 480px` and `360px` rules are deleted. |
| 7 | Font | Geist for Latin and digits (already loaded), then system Japanese fonts. No Japanese web font. |
| 8 | Radii | Tailwind's own names, restricted to `sm lg xl 2xl full`, each tied to an element type. |
| 9 | Primary button | Keeps the cyan → indigo gradient tint the site already uses, with a working hover. |
| 10 | Component home | The existing `components/shared/`, not a new directory. |
| 11 | Party colour | `PARTY2RGBCOLOR` is the single palette, re-spaced as in §7 "Party palette". The scatter stops using the `color` field in the ideology data. |

## 4. Token layer

Draft for `frontend/app/globals.css`. Token names equal the `DESIGN.md` names, so `colors.surface-raised` is `bg-surface-raised`, `typography.body-md` is `text-body-md`.

```css
@import "tailwindcss";

@theme inline {
  /* font: the Geist variable must be set on <html>, see below */
  --font-sans: var(--font-geist-sans), "Hiragino Sans", "Hiragino Kaku Gothic ProN",
    "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
  --font-mono: var(--font-geist-mono), ui-monospace, monospace;
}

@theme {
  /* accent */
  --color-primary: #22d3ee;
  --color-on-primary: #020617;
  --color-primary-soft: #03293d;
  --color-primary-soft-hover: #033b50;
  --color-on-primary-soft: #cffafe;
  --color-primary-line: #0f586d;
  --color-link: #67e8f9;
  --color-secondary: #4f46e5;
  --color-secondary-soft: #111340;
  --color-secondary-soft-hover: #191955;

  /* surfaces */
  --color-page: #111827;
  --color-surface: #020617;
  --color-surface-raised: #0b1220;
  --color-surface-control: #0f172a;
  --color-surface-hover: #1e293b;
  --color-scrim: rgb(0 0 0 / 0.6);

  /* ink and lines */
  --color-ink-strong: #f8fafc;
  --color-ink: #e2e8f0;
  --color-ink-muted: #94a3b8;
  --color-ink-disabled: #64748b;
  --color-line-subtle: #181e2f;
  --color-line: #262d3f;
  --color-line-strong: #64748b;

  /* semantic */
  --color-success: #10b981;
  --color-success-soft: #042127;
  --color-on-success-soft: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-soft: #261d15;
  --color-on-warning-soft: #fef3c7;
  --color-error: #f43f5e;
  --color-error-soft: #260f22;
  --color-on-error-soft: #ffe4e6;
  --color-info: #0ea5e9;
  --color-info-soft: #041e36;
  --color-on-info-soft: #e0f2fe;

  /* type: size, line height, weight */
  --text-display: 3rem;         --text-display--line-height: 1.2;      --text-display--font-weight: 700;
  --text-headline-lg: 1.875rem; --text-headline-lg--line-height: 1.35; --text-headline-lg--font-weight: 600;
  --text-headline-md: 1.5rem;   --text-headline-md--line-height: 1.4;  --text-headline-md--font-weight: 600;
  --text-headline-sm: 1.25rem;  --text-headline-sm--line-height: 1.4;  --text-headline-sm--font-weight: 600;
  --text-title-md: 1rem;        --text-title-md--line-height: 1.5;     --text-title-md--font-weight: 600;
  --text-title-sm: 0.875rem;    --text-title-sm--line-height: 1.5;     --text-title-sm--font-weight: 600;
  --text-body-lg: 1rem;         --text-body-lg--line-height: 1.8;
  --text-body-md: 0.875rem;     --text-body-md--line-height: 1.7;
  --text-body-sm: 0.8125rem;    --text-body-sm--line-height: 1.6;
  --text-label-md: 0.8125rem;   --text-label-md--line-height: 1.4;     --text-label-md--font-weight: 600;
  --text-label-sm: 0.75rem;     --text-label-sm--line-height: 1.4;     --text-label-sm--font-weight: 600;
  --text-caption: 0.75rem;      --text-caption--line-height: 1.5;
  --text-data: 0.75rem;         --text-data--line-height: 1.4;

  /* the one glow */
  --shadow-spotlight: 0 0 0 1px rgb(34 211 238 / 0.25), 0 0 18px rgb(34 211 238 / 0.18);
}

:root {
  color-scheme: dark;
  --z-sticky: 10;
  --z-pane: 40;
  --z-modal: 50;
  --z-tour: 60;
  --z-notice: 70;
  --z-tooltip: 80;
  --z-loading: 100;
}

body {
  background: var(--color-surface);
  color: var(--color-ink);
  line-break: strict;
}

h1, h2, h3 {
  text-wrap: balance;
  word-break: auto-phrase;
}

:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.text-data {
  font-variant-numeric: tabular-nums;
}
```

Changes that go with it:

- `app/layout.tsx`: move `geistSans.variable` and `geistMono.variable` from `<body>` to `<html>` (the `--font-sans` stack is resolved on `html`), and delete the `font-family: Arial…` rule.
- Delete both `html { font-size: 10px }` media queries.
- Use `z-(--z-modal)` and friends instead of `z-50`, `z-[60]`, `z-[90]`, `z-[100]`. Tooltip moves above the tour (today it renders under the tour's dim layer); the bottom notice moves above the tour card.
- Radii and spacing need no theme entries: the allowed set is a subset of Tailwind's defaults and is enforced by the check in §7. Resetting the default palette (`--color-*: initial`) is not done, because the topic, quality and party palettes still use Tailwind hues.

To verify before relying on it: that `--text-*--font-weight` is honoured by the installed Tailwind v4 minor, and that `word-break: auto-phrase` degrades cleanly in Safari and Firefox (it should be ignored).

## 5. Mapping from today's classes

"Uses" are regex matches over `frontend/app/**/*.ts{,x}` on `dev` (`93fc03fb`), counting variant-prefixed uses (`hover:`, `sm:`) too, so they run a little higher than the base-class inventory in §2.

### Type

| Today | Uses | Becomes |
|---|---|---|
| `text-[9px]`, `text-[10px]`, `text-[11px]` | 214 | `text-caption`; `text-label-sm` on chips and badges; `text-body-sm` where it is a sentence; `text-data` for figures |
| `text-xs`, `text-[12px]` | 90 | same split as above |
| `text-[13px]` | 9 | `text-body-sm` or `text-label-md` |
| `text-sm`, `text-[14px]`, `text-[15px]` | 58 | `text-body-md`; `text-title-sm` when semibold |
| `text-base`, `text-[16px]` | 17 | `text-body-lg`; `text-title-md` when semibold |
| `text-lg` | 17 | `text-title-md`, or `text-headline-sm` for pane and page titles |
| `text-xl` | 5 | `text-headline-sm`; `text-headline-md` for page `h1` |
| `text-2xl`, `text-3xl` | 8 | `text-headline-md`, `text-headline-lg` |
| `text-5xl` | 1 | `text-display` |

`font-semibold` (×134) is dropped wherever the role token already carries weight 600. `font-medium` and `font-bold` go away.

### Colour

| Today | Uses | Becomes |
|---|---|---|
| `text-gray-50`, `text-gray-100`, `text-slate-100`, `text-white` | 116 | `text-ink-strong` |
| `text-gray-200`, `text-gray-300`, `text-slate-200` | 162 | `text-ink` |
| `text-gray-400`, `text-slate-400` | 126 | `text-ink-muted` |
| `text-gray-500`, `text-gray-600`, `text-slate-500` | 55 | `text-ink-muted`; `text-ink-disabled` only on disabled controls |
| `text-cyan-50`, `-100`, `-200` | 57 | `text-on-primary-soft` |
| `text-cyan-300`, `-400`, `text-blue-200`, `-300` | 38 | `text-link` |
| `bg-[#020617]`, `bg-slate-950/*` | 90 | `bg-surface` |
| `bg-slate-900/30…70`, `bg-[#0b1220]`, `bg-white/5` | 91 | `bg-surface-raised` |
| `bg-slate-900/90`, `/95` | 17 | `bg-surface-control` |
| `bg-slate-800*`, `bg-slate-700` | 30 | `bg-surface-hover` |
| `bg-cyan-500/10…25` | 44 | `bg-primary-soft` (`/30` → `bg-primary-soft-hover`) |
| `bg-blue-600/*`, `bg-blue-700/*` | 16 | `bg-primary-soft` for selected; `bg-surface-hover` for the close button hover |
| `bg-black/60…70` | 6 | `bg-scrim` |
| `border-slate-400/10`, `/15`, `border-white/5`, `/10` | 75 | `border-line-subtle` |
| `border-slate-400/20`, `/25`, `/30` | 62 | `border-line` |
| `border-slate-400/35…60` | 40 | `border-line-strong` |
| `border-cyan-400/20…60`, `border-blue-500/60` | 57 | `border-primary-line` |
| `from-[#111827] to-[#020617]` | per page | `from-page to-surface`, set once in a page shell |
| emerald / amber / rose / sky `-500/10…15` with `-100` text | 24 | `bg-*-soft` + `text-on-*-soft` |

### Radius

| Today | Uses | Becomes |
|---|---|---|
| `rounded-full` | 126 | unchanged |
| `rounded-2xl`, `rounded-[18px]`, `rounded-3xl` | 24 | `rounded-2xl` |
| `rounded-xl` | 60 | `rounded-xl` for panels; `rounded-lg` where it is a list row |
| `rounded-lg`, `rounded-md` | 44 | `rounded-lg` |
| `rounded`, `rounded-sm`, `rounded-[3px]` | 14 | `rounded-sm` |

## 6. Shared components

All in `frontend/app/components/shared/`. "Replaces" lists what the audit found in use today.

| Component | API sketch | Replaces |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost`, `size: sm \| md \| lg`, `href?` (renders a link), `busy?` | 4 primary recipes (`LandingHeader`, `FeatureTour`/`SupportSection`, `about` + `layout/Header`, payment pages), 4 bordered-secondary, 3 pill and 3 ghost recipes; the two 会議を閲覧する styles |
| `IconButton` | `label` (required, Japanese), `size` | pane close buttons (22px, `aria-label="Close"`), `ZoomControls`, pager arrows, `MobileNotice` ✕ |
| `Tabs` | `items`, `value`, `onChange`; full tablist semantics | `DetailPane` tabs, `DonateModal` tabs |
| `SegmentedControl` | same shape, `aria-pressed` group | 1D/2D, 全議員/現職のみ, 地図/比例, stance run selector, quality sort toggle |
| `Chip` | `selected?`, `dot?`, `onClick` | topic chips, filter chips |
| `Badge` | `tone: neutral \| success \| warning \| error \| info`, `label?` | the six chip recipes in `QualityChips`, `VisualizationDisclaimer`, `SpeechRecordCard`, `PersonStancePanel`, `DetailPane`, `ElectionHistoryCard`; today's `Badge` variants `trust/fact/major/minor` are deleted |
| `TextInput`, `SearchInput`, `Select` | `label` or `aria-label` required | search field (no focus style, no label), scatter selects, four unlabelled filter selects, `#sq-threshold` |
| `Pager` | `page`, `pageCount`, `onChange` | icon pager in `SpeechRecordCard` ("Page 1 / N"), 前へ/次へ pager in `PersonQualityPanel` |
| `Card`, `CardHeader` | existing; header becomes a real heading and wraps its actions | fixes the squeezed 注意事項 pill; removes the no-op gradient |
| `Panel` | padding and outline only | the inner body string copied six times in `ParliamentExplorerClient`, and three other inner-panel recipes |
| `Heading` | `level: 1 \| 2 \| 3`, `size?` | nine heading recipes built from `div` |
| `Loading`, `Empty`, `ErrorState` | `ErrorState` takes `onRetry` | five recipes each; folds in `LoadingIndicator` and `EmptyState` |
| `ExpandableText` | `lines` | three clamp-and-toggle patterns (`line-clamp-6`, `-4`, `-2`) |
| `Legend` | `items: {label, color, count?}` | `PartyLegend`, the pie legend, the quality-list legend, `IssueLegend` |
| `Dialog`, `SidePane` | focus handling, Esc, labelled by heading, inert background | `ModalManager` shell, `DetailPane` and `IssuePane` shells |
| `PageShell`, `SiteHeader`, `SiteFooter`, `ProseSection` | static-page frame | five "way home" patterns; the `Section` card duplicated in `about`, `privacy`, `terms`; missing landmarks |

Deleted as dead code: `shared/ScoreBar.tsx`, `modals/DisclaimerModal.tsx`, `PARTY_COLORS` and `PARTY2COLORLIST` in `lib/config/parties.ts`.

A development-only gallery route (`app/dev/ui/page.tsx`, `notFound()` outside development) shows every component in every state. It is the reference for screenshots and review.

## 7. Phases

Each phase is one or more PRs to `dev`, each with before/after screenshots at 1440px and 390px of `/`, `/app` (top, detail pane on each tab, meeting pane), `/about` and `/privacy`.

| Phase | Work | Visible change | Done when |
|---|---|---|---|
| 0. Foundation | §4 token layer; font variables on `<html>`; delete the Arial rule and the 10px root rules; global focus ring; `--z-*`; add the ratchet check (below) | Latin text switches to Geist; focus rings appear; phone text grows 1.6× | computed `font-family` on `body` starts with Geist; root is 16px at 390px; Tab shows a ring on every control |
| 1. Components | Build §6 with token classes and the gallery route. Only `Card`, `CardHeader`, `Badge` internals change in place | card headers | every component in the gallery has hover, focus, selected, disabled |
| 2a. Static pages and landing chrome | `PageShell`, `SiteHeader`, `SiteFooter`, `ProseSection`, `Button` | one header and footer; 16px prose at `prose-max` | no duplicated `Section`; landmarks present on every page |
| 2b. Dashboard cards and header | `Panel`, `Heading`, `SegmentedControl`, `SearchInput`, `Select`, `Legend`, states | 13–14px text in cards; cyan toggles | no raw button, select or heading recipe left in `ParliamentExplorerClient` and `visualizations/` |
| 2c. Detail pane | `SidePane`, `Tabs`, `Chip`, `Badge`, `Pager`, `ExpandableText`, states | larger tabs and text; one pager | same for `features/` person panels |
| 2d. Meeting pane | `SidePane`, list rows, states | header without raw URL and ID | same for `features/issue/` |
| 2e. Overlays | `Dialog` for modals; tour, loading screen and bottom notice on the z ladder | none intended | Esc and focus behave per `DESIGN.md` |
| 3. Sweep | Remaining raw classes per §5, including SVG text sizes in charts | small | every ratchet count is 0 |
| 4. Data colour | New party palette and short-name aliases (below); scatter and landing replicas read `PARTY2RGBCOLOR`; その他 fallback; cyan selection ring; amber freed from tour, quiz and keyword marks | most party colours shift; 自民 no longer black on the scatter; 公明 no longer cyan | each party has one colour and one short name on every chart, in both houses |

Phase 0 will make the phone dashboard overflow in places, because everything on it is currently drawn at 62.5% scale. It ships together with a pass over `/app` at 390px.

**Phase 0 as built (2026-11-11).** Token layer, font variables on `<html>`, Arial and 10px-root rules deleted, global `:focus-visible` ring, overlays on the `--z-*` ladder (local stacking inside landing stages and pane resize handles left as is; `LandingHeader` keeps `z-50` until phase 2a). All 11 `outline-none` removed, together with the `focus:ring-*` stand-ins next to them, so every control shows the one global ring. 390px pass: dashboard header buttons wrap to a second row; `CardHeader` actions no longer shrink (注意事項 and 地図/比例 had wrapped one character per line, the former also at 1440px on prod); the detail pane's name row wraps so the four tabs fit; `/about` media cards get `min-w-0` (a truncated URL set their minimum width). Checked with headless Chrome at 390px and 1440px: root 16px, `body` font starts with Geist, no horizontal scroll on `/`, `/app`, `/about`, `/privacy`. Data-filled `/app` was checked by applying the same changes to production in the browser, because the local backend returned 500s. Known leftover: the scatter's 賛成 axis label is clipped at 390px.

**Phase 1 as built (2026-11-12).** In `components/shared/`: `Button`, `ButtonLink`, `IconButton` (`Button.tsx`); `Tabs`, `TabPanel`, `SegmentedControl` (`Tabs.tsx`); `Chip`; `Badge` (tones `neutral success warning error info accent`, optional `label` and `dot`; the old `trust/fact/major/minor` variants are gone); `Field`, `TextInput`, `SearchInput`, `Select` (`inputs.tsx`); `Pager`; `Card`, `CardHeader` (now an `h2`, actions wrap), `Panel`, `Heading` (`Card.tsx`); `Loading`, `Empty`, `ErrorState`, `Spinner` (`states.tsx`); `ExpandableText`; `Legend`; `Dialog`, `SidePane`, `useFocusOnOpen` (`Dialog.tsx`); `cx`. `Tooltip` restyled to tokens and clamped to the viewport. Two utilities added to `globals.css`: `.hit-target` (44px hit area on coarse pointers) and `edge-primary` (selected row edge). Gallery at `/dev/ui` (development only). Deleted: `ScoreBar`, `DisclaimerModal` (never opened), `PARTY_COLORS`, `PARTY2COLORLIST`, `PARTY2COLOR`. `EmptyState` and `LoadingIndicator` stay until their callers move in phase 2. `PageShell`, `SiteHeader`, `SiteFooter`, `ProseSection` are built in phase 2a with the pages that use them.

**Ratchet check.** A script (`frontend/scripts/check-design-tokens.mjs`, run by `npm run lint`) counts the patterns in the §2 table and fails if any count is higher than the number recorded in `frontend/design-baseline.json`. Each migration PR lowers the baseline. At the end of phase 3 the baseline is all zeros and the check becomes a plain ban. `npx @google/design.md lint frontend/DESIGN.md` can be run by hand to validate the token file.

### Party palette (phase 4)

Three palettes exist today: `PARTY2RGBCOLOR` (map, seat charts, legends), the `color` field in the ideology data (scatter: 自民 `black`, 参政 `cyan`, 無所属 `purple`), and two unused lists in `parties.ts`. Within `PARTY2RGBCOLOR`:

- 自民, 無所属, 志士 and the fallback are four light greys and whites.
- 公明 (`#00ffff`) is the accent colour; 沖縄 and みらい are close to it.
- One party has two colours because the two houses' lists abbreviate it differently: 国民 `#006eff` in the 衆議院 and 民主 `#00a0ff` in the 参議院. Independents likewise: 無 is purple, 無所属 is grey.
- `い党` (5 seats in the 2026-10-15 参議院 list) has no entry and is drawn white as その他. The five members are the ones listed as れ新 in the 2025-09-11 list.
- 立憲 and 参政 are both orange (OKLab distance 0.066); 中道 and 参政 are nearly the same colour with red-green colour blindness (0.014).

Measured over parties that sit in the same house (OKLab distance; colour blindness simulated with the Machado 2009 matrices at full severity):

| | Today | Proposed |
|---|---|---|
| Pairs under 0.10 in normal vision, 衆議院 / 参議院 (of 45 / 91) | 1 / 5 | 0 / 0 |
| Pairs under 0.06 when colour-blind, 衆議院 / 参議院 | 3 / 7 | 1 / 2 |
| Closest pair, normal vision | 0 (い党 = その他), then 0.066 (立憲–参政) | 0.121 (無所属–その他) |
| Closest pair, colour-blind, both parties ≥10 seats | 0.012 (国民–無) | 0.071 (無所属–みらい) |
| Closest pair, colour-blind, any | 0.012 | 0.044 (共産–保守) |
| Lowest contrast on `surface` | 4.12 (無) | 4.24 (その他); parties ≥ 4.9 |

The proposal keeps each party in the colour family it has on the site today, except the three that had to move: 公明 (cyan → pink, out of the accent's range), 中道 (olive → violet, the colour the unused `PARTY2COLORLIST` already gave it) and 志士 (grey → light green). The values came from a search over lightness, chroma and hue inside each family that maximised the smallest distance.

| Party | Today | Proposed | Change |
|---|---|---|---|
| 自民 | `#e0e7ff` | `#e0e7ff` | none |
| 維新 | `#ffe600` | `#ffe600` | none |
| 国民 / 民主 | `#006eff` / `#00a0ff` | `#3d87f5` | one blue for both short names |
| 中道 | `#bed228` | `#ae9bfb` | olive → violet |
| 立憲 | `#ff8c00` | `#ee8857` | redder, softer orange |
| 参政 | `#ffaa3c` | `#f3b30e` | amber → gold, away from 立憲 |
| 公明 | `#00ffff` | `#f4a9cc` | cyan → light pink |
| みらい / みら | `#00d2b4` | `#0bbe8b` | greener teal, away from the accent |
| 共産 | `#ff2d55` | `#f72849` | barely |
| 無所属 / 無 | `#b4bed2` / `#b000ff` | `#8e97a9` | one mid grey for both short names |
| れ新 / い党 | `#00ff8c` / white | `#2ce675` | い党 takes the same green |
| 沖縄 | `#00ffc8` | `#5dfed1` | lighter mint |
| 社民 | `#ff69b4` | `#e048d8` | pink → orchid, away from 公明 |
| 保守 | `#aa6e3c` | `#ac702f` | barely |
| 志士 | `#c8c8c8` | `#95f97d` | grey → light green |
| 女子, Ｎ党, 維教 | | | none (past sessions only) |
| その他 | `#ffffff` | `#64748b` | white → dark grey |

Three pairs stay under 0.06 when colour-blind: 維新–志士 (0.054), 自民–沖縄 (0.054) and 共産–保守 (0.044). Each involves a party with two seats. With 15 parties on screen, colour alone cannot cover colour blindness; labels and tooltips carry it.

Work: replace the values in `PARTY2RGBCOLOR`, add the alias map (民主 → 国民, 無 → 無所属, みら → みらい, い党 → れ新) in one place used by colour and label lookups, change `PARTY_FALLBACK_RGB`, switch the scatter (`IdeologicalScatterPlot.tsx:211,346`) and the landing replicas (`landing/sampleData.ts`, `stages/*`) to the palette, and check the result on the map, seat charts, scatter and landing with real data.

## 8. Not covered here

The audit found problems that are behaviour, content or data-viz work, not tokens or components. `DESIGN.md` states the rule for each; fixing them needs its own change:

- First visit: loading screen that waits for a click, auto-opened donation modal (again after 24 hours), auto-started 15-step tour.
- Tour key handler on `window` (arrow keys and Esc act while typing in search).
- Map auto-rotation and landing stage loops without a pause control.
- Scatter: mouse-only, thin-evidence points drawn like the rest, scroll capture, 注意事項 replacing the chart and contradicting its label.
- No `not-found.tsx`, `error.tsx`, per-page metadata, `robots`; apex vs `www` canonicals.
- Privacy policy says no analytics tools are installed.
- Landing: only the active chapter in the DOM; captions hidden below 1024px; "3つのタブ" in the replica and tour.
- Copy: English leftovers, four date formats, mixed terms.

## 9. Decisions and open questions

Decided on 2026-11-11:

| Question | Decision |
|---|---|
| 12px floor with 14px body on the dashboard | Yes |
| Japanese font | System fonts; no web font |
| 募金する in the dashboard header | Stays the primary button |
| Party palette | Clean it up; the colours in §7 "Party palette" are approved |

Still open:

| # | Question | Draft assumes |
|---|---|---|
| 1 | Is `い党` the same group as れ新 under a new short name, and which label should the site show? | Same group; show れ新 |
| 2 | Keep the cyan → indigo gradient on the primary button, or make it a flat cyan tint? | Keep |
| 3 | Should the ideology publish job stop writing `color`, or does the frontend just ignore it? | Frontend ignores it |
| 4 | Wording: 募金 or 寄付 for the reader's action; 議員 everywhere in place of 政治家? | 議員; 募金 left as is |
| 5 | Phone: keep "desktop recommended" and make the dashboard merely usable at 390px, or design a real phone layout? | Usable, not redesigned |

## 10. Related

- [`frontend/DESIGN.md`](../../frontend/DESIGN.md)
- [`docs/agents/FRONTEND.md`](../../docs/agents/FRONTEND.md)
- Format and references: [google-labs-code/design.md](https://github.com/google-labs-code/design.md), [kzhrknt/awesome-design-md-jp](https://github.com/kzhrknt/awesome-design-md-jp) (Japanese sites, including the Digital Agency design system), [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
