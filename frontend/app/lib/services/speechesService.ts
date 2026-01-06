import type { FirstPageOfAllTopics, SpeechPageResponse } from "@/app/types";

function normalizeTopicForGetEndpoint(topic: string): string {
  // Backend `/speeches/get` appends `.jsonl`, while `/get_first_page_of_all_topics`
  // likely returns filenames from a directory listing (often ending with `.jsonl`).
  return topic.endsWith(".jsonl") ? topic.slice(0, -".jsonl".length) : topic;
}

export async function fetchFirstPageOfAllTopics(personId: string): Promise<FirstPageOfAllTopics> {
  const res = await fetch(
    `/api/speeches/get_first_page_of_all_topics?person_id=${encodeURIComponent(personId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as unknown;
  const topics = (data as any)?.first_pages_of_all_topics;
  if (!Array.isArray(topics)) {
    return { first_pages_of_all_topics: [] };
  }
  return data as FirstPageOfAllTopics;
}

export async function fetchSpeechPage(
  personId: string,
  topic: string,
  pageNumber: number
): Promise<SpeechPageResponse> {
  const normalizedTopic = normalizeTopicForGetEndpoint(topic);
  const res = await fetch(
    `/api/speeches/get?person_id=${encodeURIComponent(personId)}&topic=${encodeURIComponent(
      normalizedTopic
    )}&page_number=${encodeURIComponent(String(pageNumber))}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as unknown;
  return data as SpeechPageResponse;
}


