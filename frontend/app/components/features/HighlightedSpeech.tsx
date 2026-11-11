"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  findKeywordSpans,
  kwicExcerpt,
  spanTopics,
  spansInWindow,
  type KeywordSpan,
  type KeywordTopic,
} from "@/app/lib/highlightKeywords";
import { SHARED_MARK, TOPIC_TAB_MARK, topicHighlightColor } from "@/app/lib/topicHighlightColors";

interface HighlightedSpeechProps {
  text: string;
  /** topics whose words to mark: the selected topic on a topic tab, every topic on 全発言 */
  topics: KeywordTopic[];
  mode: "topic" | "all";
  /** collapsed card: keyword-in-context excerpt when there is a match, else the first six lines */
  collapsed: boolean;
  className?: string;
}

/** 「防衛: 自衛隊 / 原発: 原発」 — every keyword in the span, grouped by topic */
function spanLabel(span: KeywordSpan, nameJa: Map<string, string>): string {
  return spanTopics(span)
    .map((t) => {
      const words = span.keywords.filter((k) => k.topic === t).map((k) => k.word);
      return `${nameJa.get(t) ?? t}: ${words.join("、")}`;
    })
    .join(" / ");
}

function markClass(span: KeywordSpan, mode: "topic" | "all"): string {
  if (mode === "topic") return TOPIC_TAB_MARK;
  const topics = spanTopics(span);
  return topics.length > 1 ? SHARED_MARK : topicHighlightColor(topics[0]).mark;
}

/** Speech text with the topic search words marked (specs/topic-keyword-highlight §6). */
export function HighlightedSpeech({ text, topics, mode, collapsed, className = "" }: HighlightedSpeechProps) {
  const spans = useMemo(() => findKeywordSpans(text, topics), [text, topics]);
  const nameJa = useMemo(() => new Map(topics.map((t) => [t.topic_name_en, t.topic_name])), [topics]);
  const [tapped, setTapped] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tapped === null) return;
    const close = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest("mark[data-kw]") || !rootRef.current?.contains(e.target)) {
        setTapped(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [tapped]);

  const excerpt = collapsed ? kwicExcerpt(text, spans) : null;
  const shownText = excerpt ? excerpt.text : text;
  const shownSpans = excerpt ? spansInWindow(spans, excerpt.offset, excerpt.text.length) : spans;

  const parts: ReactNode[] = [];
  let pos = 0;
  shownSpans.forEach((span, i) => {
    if (span.start > pos) parts.push(shownText.slice(pos, span.start));
    const label = spanLabel(span, nameJa);
    parts.push(
      <mark
        key={i}
        data-kw
        title={label}
        onPointerUp={(e) => {
          if (e.pointerType === "mouse") return;
          setTapped((cur) => (cur === label ? null : label));
        }}
        className={"rounded px-0.5 " + markClass(span, mode)}
      >
        {shownText.slice(span.start, span.end)}
      </mark>
    );
    pos = span.end;
  });
  if (pos < shownText.length) parts.push(shownText.slice(pos));

  return (
    <div ref={rootRef} className={className}>
      <div className={"whitespace-pre-wrap break-words " + (collapsed && !excerpt ? "line-clamp-6" : "")}>
        {excerpt?.truncatedStart ? "…" : ""}
        {parts}
        {excerpt?.truncatedEnd ? "…" : ""}
      </div>
      {excerpt ? <div className="mt-1 text-[10px] text-gray-400">一致 {spans.length.toLocaleString()}件</div> : null}
      {tapped ? (
        <div className="mt-1 inline-block max-w-full rounded border border-slate-400/30 bg-slate-800 px-1.5 py-0.5 text-[10px] text-gray-100">
          {tapped}
        </div>
      ) : null}
    </div>
  );
}
