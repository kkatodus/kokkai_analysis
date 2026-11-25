# Topic keyword highlighting in 発言（トピック別）

Status: done (built 2026-11-11). `topics/topics.json` goes live with the first nightly run after the merge (or `python -m speech_update publish-topics`).

Implementation notes: the mobile "popover" is a small label line under the speech text (no floating box, so nothing can overflow the card). Short speeches (≤220 chars) are shown in full with highlights rather than as an excerpt. Frontend unit tests run with Node's built-in runner (`npm test`).

## 1. Goal

In the 発言（トピック別） card (`frontend/app/components/features/SpeechRecordCard.tsx`), highlight the words that caused each speech to be filed under the selected topic, so readers can see why it is there and spot misfiled speeches.

## 2. How speeches get a topic today

`data/utils/speech_topics.py::identify_topic_for_speech` files a speech under every topic whose `search_words` (from `data/resource/experiment_config.json`) occur as **exact substrings** of the speech text. There is no score and no record of which word matched. Each topic becomes `repr_speeches_id_organized/{person_id}/{TopicNameEn}.jsonl`; `all_speeches.jsonl` holds everything.

So "the responsible keywords" = the topic's current `search_words` found in the text. They can be recomputed at display time; no per-speech data changes.

## 3. Decisions (grilling session 2026-11-11)

| # | Question | Decision |
|---|---|---|
| 1 | Where do keywords come from? | Backend serves the topic list from the config (single source of truth). Not hard-coded in the frontend; not stored per speech. Speeches filed under an older word list may show no highlight. Accepted. |
| 2 | 全発言 tab | Highlight every topic's keywords, colour-coded per topic, with the topic named on hover or tap. |
| 3 | Collapsed cards (`line-clamp-6`, >220 chars) | Show a keyword-in-context excerpt (±80 chars around the first match, `…` at cuts) plus `一致 N件`; 全文を表示 shows the full text with every match highlighted. |
| 4 | Matching rules | Same as the classifier: exact substring, every occurrence, incidental hits included (経済 in 経済産業省). Overlaps: longest match at a position wins, no nested marks, and the hover label lists every keyword the span contains. A word shared by two topics (インフレ) gets a neutral style on 全発言 and lists both topics. No width or case normalisation. |
| 5 | Scope | Only this card in v1. The matcher and component are reusable; the meeting view and landing replica are follow-ups. |
| 6 | Visual style | Topic tab: amber tint (`bg-amber-400/20 text-amber-100`, rounded, small padding). 全発言: fixed 12-colour palette keyed by `topic_name_en` at about 20% background tint, with matching colour dots on topic tabs as the legend; shared words get a slate tint and dashed underline. Native `title` on desktop, tap popover on mobile. |

## 4. Data: `kokkai-doc/topics/topics.json`

The backend reads only S3 (or `s3_mirror/`), and `experiment_config.json` is not mirrored. Add a small published file:

```
{ version: 1, generated_at,
  topics: [ { topic_name_en: "Defence", topic_name: "防衛", search_words: ["防衛", "自衛隊", …] } ] }
```

- Written by the nightly `speech_update` job (it already loads the config via `load_topics`) to `s3_mirror/kokkai-doc/topics/topics.json`, and uploaded through the existing changed-path uploader **only when the content changed** (compare without `generated_at`).
- Order follows the config. Only these three fields are published (no prompts or generated references).
- A one-off `python -m speech_update publish-topics` (or equivalent) writes and uploads it the first time.
- Check that the `kokkai-speech-update` IAM prefix policy covers `kokkai-doc/topics/*`; extend it if not.

## 5. Backend: `GET /speeches/topics`

In `backend/app/routers/speeches.py`: `storage.read_json("kokkai-doc/topics/topics.json")`, returned as-is; 404 if missing. Add the Next.js proxy `frontend/app/api/speeches/topics/route.ts`, following the existing `speeches/get` proxy, with a long revalidate (for example 1 hour).

## 6. Frontend

- `speechesService.ts`: `fetchSpeechTopics()`, fetched once per session and cached in module scope or context. If it fails, show no highlights; the card still renders.
- `TOPIC_NAME_JA_BY_EN` in `SpeechRecordCard.tsx` is replaced by `topic_name` from the endpoint, keeping the hard-coded map only as a fallback until the endpoint loads.
- `frontend/app/lib/highlightKeywords.ts` (pure, unit-tested):
  `findKeywordSpans(text, topics) → { start, end, keywords: {word, topic}[] }[]`
  - every occurrence of every word, then resolved left to right: at each position take the longest match; drop matches overlapping an earlier kept span, but fold their `{word, topic}` into that span's `keywords` when contained in it.
  - `kwicExcerpt(text, spans, radius = 80)` → `{ text, offset, truncatedStart, truncatedEnd }`.
- `frontend/app/components/features/HighlightedSpeech.tsx`: renders text plus `<mark>` spans with the style from §3 #6; props `text`, `spans`, `mode: "topic" | "all"`, `collapsed`.
  - Topic tab: spans from that topic's words only.
  - 全発言: spans from all topics; colour by topic, neutral when a span's keywords cover more than one topic.
  - Collapsed with at least one span: KWIC excerpt and the `一致 N件` counter (N = spans in the full text). Collapsed with no span: current first-six-lines behaviour.
  - Mobile: tapping a mark opens a small popover (`防衛: 自衛隊`); tap elsewhere closes it.
- Topic tabs get a colour dot from the same palette (legend for 全発言).
- Palette: one constant map `TOPIC_HIGHLIGHT_COLORS` keyed by `topic_name_en`. Topics added later without an entry use a hashed pick from the palette.

## 7. Tests and checks

- Unit tests for `findKeywordSpans`: longest-match (原発 vs 福島第一原発), shared word (インフレ → two topics), repeated words, no match, incidental match (経済産業省).
- Unit tests for `kwicExcerpt` at the text start and end.
- Manual: a long Defence speech whose first match is past six lines; a 全発言 speech covering several topics; mobile width (tap popover, no horizontal scroll).

## 8. Out of scope / follow-ups

- Highlights in the meeting view opened via 会議を閲覧する (pass the topic through `onSelectIssueId`).
- The landing-page chapter 1 replica of this card.
- Re-filing old speeches when `search_words` change (handled by topic-scaling-refresh onboarding, if at all).
- A short note in 注意事項 explaining that highlights are the topic's search words.
