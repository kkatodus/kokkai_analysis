import { test } from "node:test";
import assert from "node:assert/strict";
import { findKeywordSpans, kwicExcerpt, spanTopics, spansInWindow, type KeywordTopic } from "./highlightKeywords.ts";

const TOPICS: KeywordTopic[] = [
  { topic_name_en: "NuclearPower", topic_name: "原発", search_words: ["原発", "福島第一原発"] },
  { topic_name_en: "Economy", topic_name: "経済対策", search_words: ["経済", "インフレ"] },
  { topic_name_en: "LivingCostandTax", topic_name: "物価高対策", search_words: ["インフレ", "物価"] },
];

test("longest match wins and folds the contained word", () => {
  const spans = findKeywordSpans("福島第一原発の処理水", TOPICS);
  assert.equal(spans.length, 1);
  assert.deepEqual([spans[0].start, spans[0].end], [0, 6]);
  assert.deepEqual(spans[0].keywords.map((k) => k.word).sort(), ["原発", "福島第一原発"].sort());
  assert.deepEqual(spanTopics(spans[0]), ["NuclearPower"]);
});

test("a word shared by two topics lists both", () => {
  const [span] = findKeywordSpans("インフレ対策", TOPICS);
  assert.deepEqual(spanTopics(span).sort(), ["Economy", "LivingCostandTax"]);
});

test("every occurrence is matched", () => {
  const spans = findKeywordSpans("原発と原発と原発", TOPICS);
  assert.deepEqual(spans.map((s) => s.start), [0, 3, 6]);
});

test("no match", () => {
  assert.deepEqual(findKeywordSpans("防衛費の議論", TOPICS), []);
});

test("incidental match inside a longer word", () => {
  const spans = findKeywordSpans("経済産業省に伺います", TOPICS);
  assert.equal(spans.length, 1);
  assert.deepEqual([spans[0].start, spans[0].end], [0, 2]);
});

test("kwic at the start of the text", () => {
  const text = "原発" + "あ".repeat(200);
  const ex = kwicExcerpt(text, findKeywordSpans(text, TOPICS), 80)!;
  assert.equal(ex.offset, 0);
  assert.equal(ex.truncatedStart, false);
  assert.equal(ex.truncatedEnd, true);
  assert.equal(ex.text.length, 82);
});

test("kwic at the end of the text", () => {
  const text = "あ".repeat(200) + "原発";
  const spans = findKeywordSpans(text, TOPICS);
  const ex = kwicExcerpt(text, spans, 80)!;
  assert.equal(ex.offset, 120);
  assert.equal(ex.truncatedStart, true);
  assert.equal(ex.truncatedEnd, false);
  assert.deepEqual(spansInWindow(spans, ex.offset, ex.text.length).map((s) => [s.start, s.end]), [[80, 82]]);
});

test("kwic is null without spans", () => {
  assert.equal(kwicExcerpt("なし", []), null);
});
