"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import type { AllParliamentMemberTableData } from "@/app/types";
import { EmptyState } from "@/app/components/shared/EmptyState";

const POPULAR_LIMIT = 10;

type PopularItem = { person_id: string; count: number };

/** Shared, server-side ranking of politicians most often picked from this panel. */
function usePopularPoliticians(enabled: boolean): PopularItem[] {
  const [items, setItems] = useState<PopularItem[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    fetch("/api/popular-politicians", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { items?: PopularItem[] } | null) => {
        if (json?.items) setItems(json.items);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [enabled]);
  return items;
}

function MemberRow({
  member,
  isSelected,
  rank,
  onClick,
}: {
  member: AllParliamentMemberTableData;
  isSelected: boolean;
  rank?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border bg-[#020617] px-2.5 py-2 text-left transition ${
        isSelected
          ? "border-cyan-300/40 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_0_28px_rgba(34,211,238,0.18)]"
          : "border-white/5 hover:border-cyan-300/25 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_22px_rgba(34,211,238,0.12)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {rank !== undefined ? (
            <span className="mt-0.5 w-4 shrink-0 text-right text-[11px] tabular-nums text-cyan-300/70">
              {rank}
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-gray-50">{member.name_kanji}</div>
            <div className="truncate text-[11px] text-gray-400">{member.name_kana}</div>
          </div>
        </div>
        <div className="shrink-0 text-[10px] text-gray-500">{member.person_id}</div>
      </div>
    </button>
  );
}

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

  const popular = usePopularPoliticians(Boolean(allParliamentMemberTable));
  const popularRows = useMemo(() => {
    if (!allParliamentMemberTable || popular.length === 0) return [];
    const byId = new Map(allParliamentMemberTable.map((r) => [r.person_id, r]));
    return popular
      .map((p) => byId.get(p.person_id))
      .filter((r): r is AllParliamentMemberTableData => Boolean(r))
      .slice(0, POPULAR_LIMIT);
  }, [allParliamentMemberTable, popular]);

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
          popularRows.length > 0 ? (
            <div>
              <div className="px-1 pb-1.5 text-[10px] font-medium tracking-wide text-gray-400">
                よく検索されている議員
              </div>
              <div className="grid gap-2">
                {popularRows.map((r, i) => (
                  <MemberRow
                    key={r.person_id}
                    member={r}
                    rank={i + 1}
                    isSelected={Boolean(selectedPersonId && selectedPersonId === r.person_id)}
                    onClick={() => onSelect(r.person_id, { queryLength: 0 })}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2 text-center text-[11px] text-gray-400">
              漢字・かな表記で検索できます。
            </div>
          )
        ) : results && results.length === 0 ? (
          <EmptyState message="該当する議員が見つかりません。" className="py-2" />
        ) : (
          <div className="grid gap-2">
            {results?.map((r) => (
              <MemberRow
                key={r.person_id}
                member={r}
                isSelected={Boolean(selectedPersonId && selectedPersonId === r.person_id)}
                onClick={() => onSelect(r.person_id, { queryLength: normalizedQuery.length })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


