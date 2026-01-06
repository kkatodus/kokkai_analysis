import { EmptyState } from "@/app/components/shared/EmptyState";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";
import type { ElectionHistoryData } from "@/app/types";

interface ElectionHistoryCardProps {
  history: ElectionHistoryData[] | null;
  historyError: string | null;
  sorted: ElectionHistoryData[] | null;
}

export function ElectionHistoryCard({ history, historyError, sorted }: ElectionHistoryCardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-400/15 bg-slate-900/40 p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-gray-50">選挙履歴</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {historyError && (
          <div className="text-xs text-red-300">Failed to load election history: {historyError}</div>
        )}
        {!historyError && history === null && (
          <div className="py-2">
            <LoadingIndicator label="読み込み中" size="sm" />
          </div>
        )}
        {!historyError && history !== null && history.length === 0 && (
          <EmptyState message="選挙履歴が見つかりません。" className="py-2" />
        )}
        {!historyError && sorted && sorted.length > 0 && (
          <div className="grid gap-2">
            {sorted.map((h, idx) => (
              <div
                key={`${h.year}-${h.month}-${h.day}-${h.election_name}-${idx}`}
                className="rounded-lg border border-slate-400/15 bg-[#020617] p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-50">{h.election_name}</div>
                    <div className="mt-0.5 text-[11px] text-gray-400">
                      {h.year}/{h.month}/{h.day} ・ {h.election_freq}
                    </div>
                  </div>
                  <div className="shrink-0 rounded-full border border-slate-400/30 px-2 py-0.5 text-[11px] text-gray-200">
                    {h.result}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-gray-300">
                  {h.party} ・ {h.district}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


