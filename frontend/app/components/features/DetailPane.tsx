"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "@/app/components/shared/EmptyState";
import type { AllParliamentMemberTableData, ElectionHistoryData } from "@/app/types";
import { fetchElectionHistory } from "@/app/lib/services/electionHistoryService";

interface DetailPaneProps {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
}


export function DetailPane({
  personId,
  isOpen,
  onClose,
  allParliamentMemberTable,
}: DetailPaneProps) {
  const [history, setHistory] = useState<ElectionHistoryData[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const personIndex = useMemo(() => {
    const map = new Map<number, AllParliamentMemberTableData>();
    for (const row of allParliamentMemberTable ?? []) {
      if (row?.person_id) map.set(Number(row.person_id), row);
    }
    return map;
  }, [allParliamentMemberTable]);

  const personMeta = useMemo(() => {
    if (!personId) return null;
    return personIndex.get(Number(personId)) ?? null;
  }, [personIndex, personId]);

  useEffect(() => {
    if (!isOpen || !personId) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError(null);
    (async () => {
      try {
        const data = await fetchElectionHistory(personId);
        if (!cancelled) setHistory(data);
      } catch (e) {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, personId]);

  const sorted = useMemo(() => {
    if (!history) return null;
    const num = (s: string) => {
      const m = String(s ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };
    const toKey = (h: ElectionHistoryData) => {
      const y = num(h.year);
      const m = num(h.month);
      const d = num(h.day);
      return y * 10000 + m * 100 + d;
    };
    // Newest first
    return [...history].sort((a, b) => toKey(b) - toKey(a));
  }, [history]);

  if (!isOpen || !personId) {
    return null;
  }

  return (
      <div className="fixed inset-y-4 right-4 z-40 w-[380px] max-w-[calc(100%-32px)] translate-x-0 opacity-100 transition-all duration-200 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[70%] max-md:w-full max-md:max-w-full max-md:translate-y-0">
      <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-400/35 bg-linear-to-br from-[#020617] to-[#020617] p-3.5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            選挙履歴
          </div>
          <button
            onClick={onClose}
            className="flex h-5.5 w-5.5 items-center justify-center rounded-full border-0 bg-slate-900/90 text-sm text-gray-400 transition-colors hover:bg-blue-700/90 hover:text-gray-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mb-1.5">
          <div className="text-base font-semibold text-gray-50">
            {personMeta?.name_kanji ?? "（氏名不明）"}
          </div>
          <div className="text-[11px] text-gray-400">
            {personMeta?.name_kana ?? "（かな不明）"}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="rounded-xl border border-slate-400/15 bg-slate-900/40 p-2">
            {historyError && (
              <div className="text-xs text-red-300">Failed to load election history: {historyError}</div>
            )}
            {!historyError && history === null && (
              <div className="text-xs text-gray-300">Loading…</div>
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
                        <div className="truncate text-sm font-semibold text-gray-50">
                          {h.election_name}
                        </div>
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
      </div>
    </div>
  );
}

