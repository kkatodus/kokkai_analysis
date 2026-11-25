"use client";

import { useEffect, useState } from "react";
import type { KeywordTopic } from "@/app/lib/highlightKeywords";
import { fetchSpeechTopics } from "@/app/lib/services/speechesService";

/** Topic word lists for keyword highlighting; null until loaded or when the request fails (no highlights then). */
export function useSpeechTopics(): KeywordTopic[] | null {
  const [topics, setTopics] = useState<KeywordTopic[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSpeechTopics()
      .then((t) => {
        if (!cancelled) setTopics(t);
      })
      .catch((e) => console.warn("speech topics unavailable; no keyword highlights", e));
    return () => {
      cancelled = true;
    };
  }, []);
  return topics;
}
