"use client";

import { useMemo, useState, useDeferredValue } from "react";
import type { AllParliamentMemberTableData } from "@/app/types";
import { EmptyState } from "@/app/components/shared/EmptyState";

type Props = {
  allParliamentMemberTable: AllParliamentMemberTableData[] | null;
  selectedPersonId?: string | null;
  onSelect: (personId: string, meta?: { queryLength?: number | null }) => void;
};

export function HistoricalReprSearch({
  allParliamentMemberTable,
  selectedPersonId,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const results = useMemo(() => {
    if (!allParliamentMemberTable) return null;
    if (!normalizedQuery) return [];

    const matches = allParliamentMemberTable.filter((r) => {
      const hay = [
        r.person_id,
        r.name_kanji,
        r.name_kana,
        r.election_signature,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(normalizedQuery);
    });

    // show best-effort: shortest signature first, then stable
    matches.sort((a, b) => {
      const al = (a.election_signature || "").length;
      const bl = (b.election_signature || "").length;
      return al - bl || a.name_kanji.localeCompare(b.name_kanji);
    });

    return matches.slice(0, 30);
  }, [allParliamentMemberTable, normalizedQuery]);

  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-900/40 p-2">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="歴代議員を検索（例：山田 / やまだ）"
          className="w-full rounded-full border border-slate-400/60 bg-slate-900/95 px-3 py-2 text-[12px] text-gray-100 outline-none placeholder:text-gray-500"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-2 text-[11px] text-gray-300 hover:bg-slate-800 hover:text-gray-100"
          >
            クリア
          </button>
        ) : null}
      </div>

      <div className="mt-2 max-h-[220px] overflow-y-auto overscroll-contain pr-1">
        {!allParliamentMemberTable ? (
          <EmptyState message="歴代議員データが未読み込みです。" className="py-2" />
        ) : !normalizedQuery ? (
          <div className="py-2 text-center text-[11px] text-gray-400">
            漢字・かな表記で検索できます。
          </div>
        ) : results && results.length === 0 ? (
          <EmptyState message="該当する議員が見つかりません。" className="py-2" />
        ) : (
          <div className="grid gap-2">
            {results?.map((r) => {
              const isSelected = Boolean(selectedPersonId && selectedPersonId === r.person_id);
              return (
                <button
                  key={r.person_id}
                  type="button"
                  onClick={() => {
                    onSelect(r.person_id, { queryLength: normalizedQuery.length });
                  }}
                  className={`w-full rounded-xl border bg-[#020617] px-2.5 py-2 text-left transition ${
                    isSelected
                      ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_28px_rgba(34,211,238,0.18)]"
                      : "border-white/5 hover:border-cyan-300/25 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_22px_rgba(34,211,238,0.12)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-gray-50">
                        {r.name_kanji}
                      </div>
                      <div className="truncate text-[11px] text-gray-400">
                        {r.name_kana}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-gray-500">
                      {r.person_id}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


