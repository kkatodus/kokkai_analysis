import { Badge } from "@/app/components/shared/Badge";
import { Heading } from "@/app/components/shared/Card";
import { Empty, ErrorState, Loading } from "@/app/components/shared/states";
import type { ElectionHistoryData } from "@/app/types";

interface ElectionHistoryCardProps {
  history: ElectionHistoryData[] | null;
  historyError: string | null;
  sorted: ElectionHistoryData[] | null;
}

const digits = (s: string) => {
  const m = String(s ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
};

/** "2026年2月8日" from the source's year / month / day fields ("2026年", "2月", "8日"). */
export function electionDate(h: ElectionHistoryData): string {
  const y = digits(h.year);
  const m = digits(h.month);
  const d = digits(h.day);
  if (y === null) return [h.year, h.month, h.day].filter(Boolean).join("");
  return `${y}年${m !== null ? `${m}月` : ""}${m !== null && d !== null ? `${d}日` : ""}`;
}

/** 衆議院 / 参議院 from an election name such as 「第51回衆議院議員総選挙」. */
export function electionHouse(h: ElectionHistoryData): string | null {
  const m = String(h.election_name ?? "").match(/衆議院|参議院/);
  return m ? m[0] : null;
}

export function ElectionHistoryCard({ history, historyError, sorted }: ElectionHistoryCardProps) {
  return (
    <section aria-labelledby="election-history-heading" className="flex min-h-0 flex-1 flex-col">
      <Heading level={3} size="title-sm" id="election-history-heading" className="mb-2">
        選挙履歴
      </Heading>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {historyError && <ErrorState message="選挙履歴を読み込めませんでした。時間をおいて開き直してください。" />}
        {!historyError && history === null && <Loading rows={4} label="選挙履歴を読み込み中…" />}
        {!historyError && history !== null && history.length === 0 && <Empty message="この議員の選挙履歴は見つかりませんでした。" />}
        {!historyError && sorted && sorted.length > 0 && (
          <ul className="grid gap-2">
            {sorted.map((h, idx) => (
              <li
                key={`${h.year}-${h.month}-${h.day}-${h.election_name}-${idx}`}
                className="rounded-lg border border-line bg-surface-raised p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-title-sm text-ink-strong">{h.election_name}</div>
                    <div className="mt-0.5 text-caption text-ink-muted">
                      {electionDate(h)}
                      {h.election_freq ? ` ${h.election_freq}` : ""}
                    </div>
                  </div>
                  {h.result ? <Badge className="shrink-0">{h.result}</Badge> : null}
                </div>
                <div className="mt-1 text-body-sm text-ink">
                  {[h.party, h.district].filter(Boolean).join("・")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
