---
version: alpha
name: KOKKAI DOC
description: Dark, dense, politically neutral data UI for reading Japanese Diet records. Slate surfaces, one cyan accent, pill controls, Japanese-first typography.
colors:
  # Accent
  primary: "#22d3ee"
  on-primary: "#020617"
  primary-soft: "#03293d"
  primary-soft-hover: "#033b50"
  on-primary-soft: "#cffafe"
  primary-line: "#0f586d"
  link: "#67e8f9"
  # Brand partner (decorative only)
  secondary: "#4f46e5"
  secondary-soft: "#111340"
  secondary-soft-hover: "#191955"
  # Surfaces
  page: "#111827"
  surface: "#020617"
  surface-raised: "#0b1220"
  surface-control: "#0f172a"
  surface-hover: "#1e293b"
  scrim: "#00000099"
  # Ink
  ink-strong: "#f8fafc"
  ink: "#e2e8f0"
  ink-muted: "#94a3b8"
  ink-disabled: "#64748b"
  # Lines
  line-subtle: "#181e2f"
  line: "#262d3f"
  line-strong: "#64748b"
  # Semantic
  success: "#10b981"
  success-soft: "#042127"
  on-success-soft: "#d1fae5"
  warning: "#f59e0b"
  warning-soft: "#261d15"
  on-warning-soft: "#fef3c7"
  error: "#f43f5e"
  error-soft: "#260f22"
  on-error-soft: "#ffe4e6"
  info: "#0ea5e9"
  info-soft: "#041e36"
  on-info-soft: "#e0f2fe"
typography:
  display:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.2
  headline-lg:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.35
  headline-md:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.4
  headline-sm:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.4
  title-md:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
  title-sm:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.5
  body-lg:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.8
  body-md:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
  label-md:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.4
  label-sm:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
  caption:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "Geist, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic UI', Meiryo, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: '"tnum"'
rounded:
  sm: 4px
  lg: 8px
  xl: 12px
  2xl: 16px
  full: 9999px
spacing:
  hairline: 2px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
  gutter: 16px
  content-max: 72rem
  prose-max: 42rem
  target-min: 24px
  target-touch: 44px
components:
  button-primary:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-soft-hover}"
    textColor: "{colors.on-primary-soft}"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 16px
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink-strong}"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.link}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 12px
  button-disabled:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-disabled}"
  icon-button:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    size: 32px
  icon-button-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink-strong}"
  input:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    height: 40px
    padding: 16px
  select:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.ink}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 12px
  tab:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label-md}"
    rounded: "{rounded.full}"
    height: 32px
    padding: 12px
  tab-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
  chip:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 24px
    padding: 8px
  chip-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
  badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.on-success-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.on-warning-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.on-error-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  badge-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.on-info-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: 16px
  card-title:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.title-md}"
  card-subtitle:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: 12px
  list-row:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 12px
  list-row-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink-strong}"
  list-row-selected:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.on-primary-soft}"
  side-pane:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: 16px
    width: 420px
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: 24px
    width: 560px
  tooltip:
    backgroundColor: "{colors.surface-control}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.lg}"
    padding: 8px
  progress-fill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
  quality-bar-success:
    backgroundColor: "{colors.success}"
    rounded: "{rounded.sm}"
  quality-bar-warning:
    backgroundColor: "{colors.warning}"
    rounded: "{rounded.sm}"
  quality-bar-error:
    backgroundColor: "{colors.error}"
    rounded: "{rounded.sm}"
  prose:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
    typography: "{typography.body-lg}"
    width: 42rem
---

# KOKKAI DOC design system

**Status:** target system. The code does not match it yet; the migration is tracked in [`specs/design-system/`](../specs/design-system/README.md). New and changed UI follows this file; untouched UI is brought over phase by phase.

The YAML above is normative. The prose explains how to apply it. Token names map one-to-one to Tailwind utilities through `@theme` in `app/globals.css` (`colors.surface-raised` → `bg-surface-raised`, `typography.body-md` → `text-body-md`, `rounded.xl` → `rounded-xl`).

## Overview

KOKKAI DOC is a public tool for reading what Diet members said and how they are positioned. It is used by citizens, journalists and researchers who arrive with a name or a topic in mind. The interface is a workbench: several data cards side by side, with a detail pane that slides over them.

Four qualities decide every unspecified case:

- **Neutral.** The chrome carries no political colour. Party hues appear only inside charts and legends. The UI never ranks, praises or blames through colour, size or wording beyond what the data label says.
- **Legible before dense.** The dashboard shows a lot at once, but no text is smaller than 12px and body text is 14px. When content does not fit, reduce what is shown, not the type size.
- **Calm.** Dark slate surfaces, hairline borders, one accent. No glow, gradient or animation that does not carry meaning.
- **Japanese first.** Every visible string and every accessible name is Japanese. Typography is tuned for kanji and kana, not for Latin.

The site is dark only. There is no light theme; `color-scheme: dark` is declared on the root.

## Colors

One neutral ramp (slate), one accent (cyan), one decorative partner (indigo), four semantic colours. Everything else is data colour and follows the data-colour rules at the end of this section.

**Surfaces** — the page, four surface steps and a scrim.

| Token | Value | Use |
|---|---|---|
| `page` | `#111827` | Top of the page gradient (`page` → `surface`, top to bottom). Long-form pages sit directly on it. |
| `surface` | `#020617` | Cards, panels, side panes, modals. |
| `surface-raised` | `#0b1220` | Resting fill of buttons, chips, tab tracks, list rows. |
| `surface-control` | `#0f172a` | Text inputs, selects, tooltips. |
| `surface-hover` | `#1e293b` | Hover and pressed fill for anything on `surface-raised`. |
| `scrim` | black at 60% | Behind modals, the tour and the loading screen. |

**Ink** — three readable steps and one disabled step.

| Token | Value | Contrast on `surface` | Use |
|---|---|---|---|
| `ink-strong` | `#f8fafc` | 19.3:1 | Headings, names, input text, numbers that are the point of a row. |
| `ink` | `#e2e8f0` | 16.4:1 | Body text and control labels. |
| `ink-muted` | `#94a3b8` | 7.9:1 | Captions, metadata, placeholders, axis labels. This is the dimmest ink allowed for text a reader needs. |
| `ink-disabled` | `#64748b` | 4.2:1 | Disabled controls only. Never for captions or hints. |

**Lines**

| Token | Value | Use |
|---|---|---|
| `line-subtle` | `#181e2f` | Card and panel outlines, dividers inside a card. |
| `line` | `#262d3f` | Outlines of buttons, chips, tab tracks, list rows. |
| `line-strong` | `#64748b` | Input and select outlines (at least 3:1 against `surface`, `surface-raised` and `surface-control`), side-pane and modal outlines, hover outline of secondary buttons. |

**Accent — cyan.** `primary` (`#22d3ee`) is used for exactly these things: the focus ring, the selected state, the primary button, links, the bullet before a card title, and the progress fill. `primary-soft` with `on-primary-soft` text is the one "selected" recipe for tabs, segmented controls, chips and list rows. `primary-line` (`#0f586d`) is the outline of the primary button and of selected rows. `link` (`#67e8f9`) is link text; links inside running text are also underlined. `on-primary` is the text colour on a solid `primary` fill (the progress label). Blue (`blue-*`) is not part of the system.

**Indigo — decorative.** `secondary` appears only as the second stop of the primary button gradient (`secondary-soft`, `secondary-soft-hover`) and in ambient background glows on the landing page. It never carries text, state or data.

**Semantic colours** have one meaning each, in chrome and in the quality labels:

| Token | Meaning | Where it appears |
|---|---|---|
| `success` | Positive result | 成果あり |
| `warning` | Partial or cautionary | 成果は限定的, 根拠が少ない, the slow-loading notice |
| `error` | Negative result, failure | 成果なし, 問題点, load errors |
| `info` | Neutral notice | 注意事項, tips |

Use the `*-soft` fill with the `on-*-soft` text for badges and notices; use the solid colour for bar fills and dots. A semantic colour is always paired with a text label, an icon or a position, never used alone. Amber is not used for tour hints, quiz cards or keyword marks; those use the accent.

### Data colours

- **Parties.** One palette, `PARTY2RGBCOLOR` in `app/lib/config/parties.ts`, read by every chart, legend and replica. A chart never takes party colour from a data file. The same party has the same colour in both houses, whatever short name the source list uses.

  | Party | Colour | Short names that share it |
  |---|---|---|
  | 自民 | `#e0e7ff` | |
  | 維新 | `#ffe600` | |
  | 国民 | `#3d87f5` | 民主 (参議院) |
  | 中道 | `#ae9bfb` | |
  | 立憲 | `#ee8857` | |
  | 参政 | `#f3b30e` | |
  | 公明 | `#f4a9cc` | |
  | みらい | `#0bbe8b` | みら (参議院) |
  | 共産 | `#f72849` | |
  | 無所属 | `#8e97a9` | 無 (衆議院) |
  | れ新 | `#2ce675` | い党 (参議院) |
  | 沖縄 | `#5dfed1` | |
  | 社民 | `#e048d8` | |
  | 保守 | `#ac702f` | |
  | 志士 | `#95f97d` | |
  | 女子 / Ｎ党 / 維教 | `#ff00c8` / `#ff008c` / `#beff00` | past sessions only |
  | その他 | `#64748b` (`ink-disabled`) | any party without an entry |

  Rules for the palette, and for adding a party to it:
  - Grey means no party: mid grey is 無所属, dark grey is その他. No party is grey, and no party is white.
  - No party sits in the accent's hue range (cyan, OKLCH hue 195°–225°), so a selected control is never read as a party.
  - Two parties that sit in the same house differ by at least 0.10 in OKLab, and parties with ten or more seats stay at least 0.06 apart under simulated red-green colour blindness. Lightness does part of the work, so the palette is not all neon.
  - Every colour reaches 4.5:1 on `surface` (その他 reaches 4.2:1 and is used for marks, not text).
  - Colour is never the only cue: every mark has the party name in a label, legend or tooltip.
- **Party names.** One short-name table for all charts and legends, with the aliases above folded in (民主 → 国民, 無 → 無所属, みら → みらい, い党 → れ新). The same party is never abbreviated two ways on one screen.
- **Quality scale.** `success` / `warning` / `error`, always in the order 成果あり → 成果は限定的 → 成果なし, always with the label visible or one tap away.
- **Topics.** The 12-colour categorical palette in `app/lib/topicHighlightColors.ts`. Keyword marks use the colour at 20% over the surface with `ink-strong` text; the dot beside the topic name is the legend.
- **Selection inside a chart** is a 2px `primary` ring or outline around the mark, never a change of fill, because fill is the party.
- Categorical data never reuses `primary` as a category colour.

## Typography

One family stack for everything: Geist for Latin letters and digits, then the platform's Japanese gothic (`Hiragino Sans` on Apple, `Noto Sans JP` on Android and Linux, `Yu Gothic UI` then `Meiryo` on Windows). No Japanese web font is downloaded.

Three weights: 400 for reading, 600 for labels and headings, 700 for the landing display line only.

| Token | Size / line / weight | Use |
|---|---|---|
| `display` | 48 / 1.2 / 700 | Landing hero. Steps down to `headline-md` below `md`. |
| `headline-lg` | 30 / 1.35 / 600 | Landing section headings. `headline-md` below `md`. |
| `headline-md` | 24 / 1.4 / 600 | Page `h1` on about, privacy, terms; modal titles. |
| `headline-sm` | 20 / 1.4 / 600 | Person name in the detail pane; meeting title; `h2` on long-form pages. |
| `title-md` | 16 / 1.5 / 600 | Card titles; `h3`. |
| `title-sm` | 14 / 1.5 / 600 | Section headings inside a panel; names in list rows. |
| `body-lg` | 16 / 1.8 / 400 | Long-form pages and landing body. |
| `body-md` | 14 / 1.7 / 400 | Default: speech text, summaries, descriptions. |
| `body-sm` | 13 / 1.6 / 400 | Card subtitles, secondary lines in rows. |
| `label-md` | 13 / 1.4 / 600 | Buttons, tabs, selects. |
| `label-sm` | 12 / 1.4 / 600 | Chips, badges. |
| `caption` | 12 / 1.5 / 400 | Dates, counts, sources, axis labels. |
| `data` | 12 / 1.4 / 400, `tnum` | Numbers in columns, pagers, percentages beside bars. |

Rules:

- 12px is the floor, in HTML and in SVG. Arbitrary sizes (`text-[11px]`) are not used.
- The root font size is 16px at every viewport width. Density on phones comes from layout, not from shrinking the root.
- Headings are real `h1`–`h3` elements in document order. One `h1` per page; it contains only the page name.
- Japanese text is never italic and never letter-spaced in body sizes. Headings use `text-wrap: balance` and `word-break: auto-phrase`; body uses `line-break: strict`.
- Lines of running text hold at most about 40 full-width characters (`prose-max`).
- Any number a reader compares down a column uses `tnum`.

## Layout

Spacing uses a 4px base with eight steps: 4, 8, 12, 16, 24, 32, 48, 64 (Tailwind `1 2 3 4 6 8 12 16`). The 2px `hairline` step exists for the inside of chips and segmented tracks only.

| Where | Value |
|---|---|
| Page gutter | 16px |
| Gap between cards | 16px |
| Card padding | 16px |
| Panel padding | 12px |
| Gap between rows in a list | 8px |
| Gap between a label and its control | 8px |
| Section spacing on landing and long-form pages | 64px |

Widths: marketing and dashboard content is capped at `content-max` (72rem). Long-form text is capped at `prose-max` (42rem). A page uses one outer container so left edges line up from header to footer.

Nesting stops at card → panel. A panel does not contain another bordered box; use a divider or spacing instead.

Breakpoints, with one job each:

| Name | Width | Job |
|---|---|---|
| `sm` | 640px | Spacing and type bumps only. |
| `md` | 768px | Layout mode: below it, side panes become bottom sheets, toolbars wrap, the two dashboard columns stack. |
| `lg` | 1024px | Landing copy sits beside its stage; dashboard columns become resizable. |

No other width queries are used.

Target sizes: every interactive element is at least `target-min` (24×24px). On coarse pointers (`@media (pointer: coarse)`) controls are at least `target-touch` (44px) in their smaller dimension, by height or by an invisible hit area.

## Elevation & Depth

Depth comes from surface step and outline, not from shadow. Shadows are reserved for things that float over other content.

| Level | What | Treatment | `z-index` |
|---|---|---|---|
| 0 | Page | `page` → `surface` gradient | — |
| 1 | Card, panel | `surface` + `line-subtle` | — |
| 2 | Controls, rows | `surface-raised` + `line` | — |
| 3 | Sticky headers inside a card | level 1 fill | 10 |
| 4 | Side pane, bottom sheet | `surface` + `line-strong` + `shadow-2xl` | 40 |
| 5 | Modal | `scrim` + `surface` + `line-strong` + `shadow-2xl` | 50 |
| 6 | Guided tour | `scrim` with a cut-out + card | 60 |
| 7 | Bottom notice | level 4 treatment | 70 |
| 8 | Tooltip | `surface-control` + `line` + `shadow-lg` | 80 |
| 9 | Loading screen | opaque | 100 |

The `z-index` values are the only ones in use and are exposed as `--z-*` variables. Two overlays never occupy the same screen region: the bottom notice waits until the tour and modals are closed.

One glow exists: `0 0 0 1px rgb(34 211 238 / 0.25), 0 0 18px rgb(34 211 238 / 0.18)`. It marks the tour's spotlight target and nothing else.

## Shapes

Five radii, each tied to a kind of element.

| Token | Value | Use |
|---|---|---|
| `full` | pill | Everything a user operates: buttons, inputs, selects, tabs, chips, badges, icon buttons. |
| `2xl` | 16px | Cards, side panes, modals, bottom sheets (top corners). |
| `xl` | 12px | Panels inside a card; media frames. |
| `lg` | 8px | List rows, tooltips, menus. |
| `sm` | 4px | Bars, keyword marks. |

Legend swatches and status dots are circles. Borders are 1px; the selected row's leading edge and the focus ring are 2px.

## Components

Each recipe exists once, as a component in `app/components/shared/`. Feature code composes these and does not restate their classes.

### Buttons

| Variant | Looks like | Use |
|---|---|---|
| Primary | `primary-soft` → `secondary-soft` gradient, `primary-line` outline, `on-primary-soft` label | The one main action of a view: ダッシュボードを開く on the landing page, 募金する in the dashboard header and the donation modal. At most one per view. |
| Secondary | `surface-raised`, `line` outline, `ink` label | Every other button. |
| Ghost | No fill or outline, `link` label | Low-emphasis actions inside a row or sentence: 全文を表示, 解除, スキップ. |
| Icon | 32px circle, `surface-raised`, `ink-muted` glyph | Close, zoom, previous/next. Always has a Japanese `aria-label`. |

Sizes: `sm` 28px (toolbars inside a card), `md` 36px (default), `lg` 44px (landing calls to action). Labels are one line.

States, for every variant: hover moves the fill one step (`surface-raised` → `surface-hover`; `primary-soft` → `primary-soft-hover` and `secondary-soft` → `secondary-soft-hover` on the gradient); pressed is the hover fill; disabled is `surface-raised` with `ink-disabled` and `cursor: not-allowed`, with the reason given next to it; busy keeps the label and adds a spinner with `aria-busy`.

A link that looks like a button is still an `<a>`; an action is still a `<button type="button">`. Interactive elements are never nested.

### Focus

One ring for everything, defined globally: `:focus-visible { outline: 2px solid primary; outline-offset: 2px }`. `outline-none` is not used.

### Tabs and segmented controls

A pill track (`surface-raised`, `line`, 2px inner padding) holding pill segments. The selected segment is `primary-soft` / `on-primary-soft`. Views of one object (発言 / やり取り / 選挙履歴 / 立場) are tabs: `role="tablist"`, `aria-selected`, `aria-controls`, arrow-key movement. Display options (1D / 2D, 全議員 / 現職のみ, 地図 / 比例) are segmented controls: a labelled `role="group"` of buttons with `aria-pressed`.

### Inputs and selects

`surface-control` fill, `line-strong` outline, pill shape, 40px tall (selects 36px). Every field has a visible label or an `aria-label`; the placeholder is an example, not the label. Search fields use `type="search"` and show a clear button once text is entered.

### Chips and badges

A chip is operable (filters, topics): 24px tall, `surface-raised`, `line`; selected uses the selected recipe. A badge is a read-only status: `*-soft` fill with `on-*-soft` text, built from "label：value" (種類：政策論議). Topic chips carry their palette dot. Long chip text truncates with the full text in a tooltip that also opens on focus and tap.

### Cards, panels, side panes

- **Card:** `surface`, `line-subtle`, 16px radius, 16px padding. Header is an `h2` in `title-md` with the cyan bullet, an optional `body-sm` subtitle below it, and actions on the right. Actions wrap under the title when the row is too narrow; nothing is squeezed.
- **Panel:** `surface`, `line-subtle`, 12px radius, 12px padding. Groups content inside a card.
- **Side pane:** fixed to the right at 420px (resizable) from `md` up; a bottom sheet below `md`. It is a dialog: labelled by its heading, focus moves into it on open and returns on close, Esc closes it, and the 32px close button reads 閉じる. A second pane replaces or stacks beside the first; it never opens in the same place on top of it.
- **Modal:** centred, at most 560px wide, `scrim` behind. `role="dialog"`, `aria-modal`, focus trapped, background inert, Esc and scrim click close it. A modal opens only in response to a user action.

The header of a pane or modal carries the object's identity. For a person: name, reading, party, house, district. Internal identifiers (`person_id`, 会議ID, raw URLs) are not shown.

### Lists and pagers

A row is `surface-raised`, `line`, 8px radius, 12px padding; the whole row is one button or link. Selected rows use the selected recipe with a `primary-line` outline and a 2px `primary` leading edge. Long text collapses with one pattern: a line clamp and a ghost button reading 全文を表示 / 折りたたむ.

One pager, placed below the list: icon buttons 前へ / 次へ around `1 / 1,248 ページ` in `data` type. A failed page load keeps the current page on screen.

### Loading, empty and error states

One component for each, used in every card, panel and pane.

| State | Content | Semantics |
|---|---|---|
| Loading | Skeleton rows shaped like the content, or 読み込み中… where a skeleton makes no sense | `role="status"` |
| Empty | One sentence saying why it is empty and what to do next, with the action as a button | — |
| Error | A Japanese sentence saying what failed and a 再試行 button. Never an exception message. Data already loaded stays visible. | `role="alert"` |

### Tooltips

`surface-control`, `caption` type, 8px radius, at most 280px wide, kept inside the viewport. Opens on hover and on focus; on touch, on tap. A tooltip adds detail; anything needed to read a chart or use a control is on screen without it.

## Data Visualisation

- Every chart has a heading, a one-line caption saying how to read it, a legend, and the date the data was last updated.
- Marks and legend text follow the data-colour rules above. Text inside SVG is at least 12px, in `ink-muted` or brighter.
- Uncertainty is drawn, not footnoted: points with thin evidence are hollow or at reduced opacity, and the legend says so.
- Reference lines and bands are labelled on the chart in words.
- A chart does not capture page scroll. Zoom is by buttons, by pinch, or by wheel with Ctrl/⌘ held.
- Every chart has a keyboard path to the same information: focusable marks with accessible names, or a list or table next to it.
- Notes and disclaimers sit beside the chart. They do not replace it.
- Counts carry units and thousands separators. Percentages below 1% read 1%未満, not 0%.

## Motion

- Hover and press: 150ms. Panes, sheets and tab changes: 200ms, ease-out. Nothing in the dashboard runs longer than 300ms.
- Anything that moves by itself for more than five seconds (map rotation, landing stages) has a visible pause control and stops when the user interacts with it.
- All non-essential motion is disabled under `prefers-reduced-motion: reduce`, including smooth scrolling, auto-rotation, bouncing loaders and chart zoom transitions. The media query is read live, not once at mount.

## Content

- Polite form (です・ます) in sentences; noun phrases for labels and buttons. No exclamation marks.
- One word per concept: 議員 for a person in the data; やり取り for one question-and-answer exchange; トピック for one of the 12 themes and 論点 for an axis inside a topic; ダッシュボード for `/app`. The primary call to action reads ダッシュボードを開く everywhere.
- Dates read 2025年8月5日, months 2025年8月, ranges 2016年1月〜2025年12月. ISO strings are not shown.
- Numbers use half-width digits and thousands separators, with no space before the unit: 612件, 2.9%.
- Labels use the full-width colon (会議：予算委員会). No manual spaces between Japanese and Latin text (AIが判定).
- Research terms get a plain-language label first and the term second, or a tooltip: 立場の推定 before 埋め込みベクトル.
- AI-generated judgements are marked as such where they appear (AI判定) and link to the 注意事項.
- When unsure about a label that characterises a politician, choose the wording that favours the person.

## Do's and Don'ts

- Do use a token for every colour, type size, radius and spacing value. If a value is missing, add the token here first.
- Do build with the components in `app/components/shared/`. Don't restate a button, chip, tab or state recipe in feature code.
- Do keep one primary button per view.
- Do give every control visible hover, focus, selected and disabled states.
- Do write every string and accessible name in Japanese.
- Do pair colour with text, an icon or position whenever it carries meaning.
- Don't set text below 12px, and don't change the root font size.
- Don't use `blue-*`, `gray-*`, hex literals or opacity-suffixed neutrals (`slate-900/40`) in class names.
- Don't use party hues, or the semantic colours, as decoration.
- Don't use `primary` as a data colour.
- Don't open a modal, a tour or a notice without a user action, and don't stack two overlays.
- Don't put information only in a `title` attribute or a hover tooltip.
- Don't show internal identifiers, raw URLs or exception messages.
- Don't nest a bordered box inside a panel, or an interactive element inside another.
- Don't animate anything that cannot be paused or that ignores reduced-motion.
