/**
 * Find the topic search words in a speech, matched the way the classifier files speeches
 * (data/utils/speech_topics.py): exact substring, every occurrence (specs/topic-keyword-highlight §3 #4).
 * Pure; tests in highlightKeywords.test.ts (`npm test`).
 */

export type KeywordTopic = {
  topic_name_en: string;
  topic_name: string;
  search_words: string[];
};

export type KeywordHit = { word: string; topic: string };

/** [start, end) in the text; `keywords` lists every word the span contains, with its topic_name_en. */
export type KeywordSpan = { start: number; end: number; keywords: KeywordHit[] };

/**
 * Every occurrence of every word, resolved left to right: at each position the longest match wins;
 * matches overlapping a kept span are dropped, and folded into its `keywords` when contained in it.
 */
export function findKeywordSpans(text: string, topics: KeywordTopic[]): KeywordSpan[] {
  const matches: { start: number; end: number; hit: KeywordHit }[] = [];
  for (const topic of topics) {
    for (const word of new Set(topic.search_words)) {
      if (!word) continue;
      for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) {
        matches.push({ start: i, end: i + word.length, hit: { word, topic: topic.topic_name_en } });
      }
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const spans: KeywordSpan[] = [];
  for (const m of matches) {
    const last = spans[spans.length - 1];
    if (!last || m.start >= last.end) {
      spans.push({ start: m.start, end: m.end, keywords: [m.hit] });
    } else if (m.end <= last.end) {
      if (!last.keywords.some((k) => k.word === m.hit.word && k.topic === m.hit.topic)) last.keywords.push(m.hit);
    }
  }
  return spans;
}

/** Distinct topic_name_en values in a span, in first-seen order. */
export function spanTopics(span: KeywordSpan): string[] {
  return [...new Set(span.keywords.map((k) => k.topic))];
}

export type KwicExcerpt = {
  text: string;
  /** index in the full text where `text` starts */
  offset: number;
  truncatedStart: boolean;
  truncatedEnd: boolean;
};

/** Keyword-in-context window: `radius` chars either side of the first span. Null when there is no span. */
export function kwicExcerpt(text: string, spans: KeywordSpan[], radius = 80): KwicExcerpt | null {
  const first = spans[0];
  if (!first) return null;
  const start = Math.max(0, first.start - radius);
  const end = Math.min(text.length, first.end + radius);
  return { text: text.slice(start, end), offset: start, truncatedStart: start > 0, truncatedEnd: end < text.length };
}

/** Spans that fall in [offset, offset + length), shifted to be relative to the excerpt and clipped to it. */
export function spansInWindow(spans: KeywordSpan[], offset: number, length: number): KeywordSpan[] {
  const end = offset + length;
  return spans
    .filter((s) => s.end > offset && s.start < end)
    .map((s) => ({ ...s, start: Math.max(s.start, offset) - offset, end: Math.min(s.end, end) - offset }));
}
