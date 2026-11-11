"use client";

import { useEffect, useMemo, useState, useDeferredValue } from "react";
import type { AllParliamentMemberTableData } from "@/app/types";
import { Empty, Loading } from "@/app/components/shared/states";
import { SearchInput } from "@/app/components/shared/inputs";
import { Heading } from "@/app/components/shared/Card";
import { selectedClass } from "@/app/components/shared/Chip";
import { cx } from "@/app/components/shared/cx";

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
      className={cx(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors duration-150",
        isSelected ? cx(selectedClass, "edge-primary") : "border-line bg-surface-raised hover:bg-surface-hover",
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {rank !== undefined ? <span className="mt-0.5 w-5 shrink-0 text-right text-data text-link">{rank}</span> : null}
        <div className="min-w-0">
          <div className={cx("truncate text-title-sm", isSelected ? "text-on-primary-soft" : "text-ink-strong")}>{member.name_kanji}</div>
          <div className="truncate text-caption text-ink-muted">{member.name_kana}</div>
        </div>
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
    <div>
      <SearchInput
        value={query}
        onValueChange={setQuery}
        aria-label="歴代議員を検索"
        placeholder="例：山田／やまだ"
      />

      <div className="mt-3 max-h-[260px] overflow-y-auto overscroll-contain pr-1">
        {!allParliamentMemberTable ? (
          <Loading label="歴代議員データを読み込んでいます…" />
        ) : !normalizedQuery ? (
          popularRows.length > 0 ? (
            <div>
              <Heading level={3} size="label-md" className="pb-2">
                よく検索されている議員
              </Heading>
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
            <p className="py-2 text-center text-body-sm text-ink-muted">漢字・かな表記で検索できます。</p>
          )
        ) : results && results.length === 0 ? (
          <Empty message="該当する議員が見つかりません。別の表記（漢字・かな）でもお試しください。" />
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


