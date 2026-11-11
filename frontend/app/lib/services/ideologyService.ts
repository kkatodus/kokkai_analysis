import type { PersonStances } from "@/app/types";

/** Per-topic stance summaries for one politician (specs/stance-summaries-panel §6.1); empty topics when none. */
export async function fetchPersonStances(personId: string): Promise<PersonStances> {
  const res = await fetch(`/api/ideology/person?person_id=${encodeURIComponent(personId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as Partial<PersonStances>;
  return {
    version: Number(data.version ?? 1),
    person_id: Number(data.person_id ?? personId),
    generated_at: data.generated_at,
    ideology_generated_at: data.ideology_generated_at,
    topics: Array.isArray(data.topics) ? data.topics : [],
  };
}
