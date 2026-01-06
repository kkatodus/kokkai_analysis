import type { ElectionHistoryData } from "@/app/types";

export async function fetchElectionHistory(personId: string): Promise<ElectionHistoryData[]> {
  const res = await fetch(`/api/electionHistory?person_id=${encodeURIComponent(personId)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
  }
  const data = (await res.json()) as { history?: unknown };
  const history = (data as any).history;
  if (!Array.isArray(history)) return [];
  return history as ElectionHistoryData[];
}


