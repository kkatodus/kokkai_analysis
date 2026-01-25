"use client";

import { useMemo, useState } from "react";
import type { AllParliamentMemberTableData, RelevanceAndProductivityData } from "@/app/types";

type SortKey = "prop_R_True_P_True" | "prop_R_True_P_False" | "prop_R_False_P_False";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeProp(raw: number): number {
  // Data should be 0..1, but tolerate 0..100.
  if (!Number.isFinite(raw)) return 0;
  const n = raw > 1.00001 ? raw / 100 : raw;
  return clamp01(n);
}

function percentLabel(n01: number): string {
  return `${Math.round(clamp01(n01) * 1000) / 10}%`;
}

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "prop_R_True_P_True", label: "関連 × 生産性あり（割合）" },
  { key: "prop_R_True_P_False", label: "関連 × 生産性なし（割合）" },
  { key: "prop_R_False_P_False", label: "非関連 × 生産性なし（割合）" },
];

export function RelevanceProductivityBarList({
  relevanceAndProductivityData,
  allParliamentMemberTable,
  selectedPersonId,
  onSelectPersonId,
}: {
  relevanceAndProductivityData: RelevanceAndProductivityData[] | null;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
  selectedPersonId?: string | null;
  onSelectPersonId: (personId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("prop_R_True_P_True");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [minSpeechCount, setMinSpeechCount] = useState<number>(20);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const personIndex = useMemo(() => {
    const map = new Map<number, AllParliamentMemberTableData>();
    for (const row of allParliamentMemberTable ?? []) {
      if (row?.person_id) map.set(Number(row.person_id), row);
    }
    return map;
  }, [allParliamentMemberTable]);

  const sortedRows = useMemo(() => {
    const data = relevanceAndProductivityData ?? [];
    const get = (d: RelevanceAndProductivityData, k: SortKey) => normalizeProp((d as any)?.[k] as number);
    const dir = sortDir === "desc" ? -1 : 1;
    const threshold = Number.isFinite(minSpeechCount) ? Math.max(0, Math.floor(minSpeechCount)) : 0;
    const filtered = data.filter((d) => {
      const c = Number.isFinite(d.Total_Count) ? d.Total_Count : 0;
      return c >= threshold;
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = get(a, sortKey);
      const bv = get(b, sortKey);
      if (av !== bv) return (av < bv ? -1 : 1) * dir;
      const ac = Number.isFinite(a.Total_Count) ? a.Total_Count : 0;
      const bc = Number.isFinite(b.Total_Count) ? b.Total_Count : 0;
      if (ac !== bc) return (ac < bc ? 1 : -1); // tie-breaker: higher count first
      return String(a.person_id).localeCompare(String(b.person_id));
    });
    return sorted;
  }, [relevanceAndProductivityData, sortKey, sortDir, minSpeechCount]);

  const pagination = useMemo(() => {
    const size = Number.isFinite(pageSize) ? Math.max(5, Math.min(200, Math.floor(pageSize))) : 25;
    const total = sortedRows.length;
    const pageCount = Math.max(1, Math.ceil(total / size));
    const idx = Math.max(0, Math.min(pageIndex, pageCount - 1));
    const start = idx * size;
    const end = Math.min(total, start + size);
    return { size, total, pageCount, idx, start, end };
  }, [sortedRows.length, pageSize, pageIndex]);

  const pageRows = useMemo(() => {
    return sortedRows.slice(pagination.start, pagination.end);
  }, [sortedRows, pagination.start, pagination.end]);

  if (!relevanceAndProductivityData) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        関連度・生産性データを読み込み中…
      </div>
    );
  }

  if (!relevanceAndProductivityData.length) {
    return <div className="py-6 text-center text-sm text-gray-400">関連度・生産性データがありません。</div>;
  }

  const thresholdSafe = Number.isFinite(minSpeechCount) ? Math.max(0, Math.floor(minSpeechCount)) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-gray-300">
          <div>
            議員別（{pagination.total} 件 / 全 {relevanceAndProductivityData.length} 件）
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400" htmlFor="rp-threshold">
              最低発言数
            </label>
            <input
              id="rp-threshold"
              type="number"
              min={0}
              step={1}
              value={thresholdSafe}
              onChange={(e) => {
                const next = Math.max(0, Math.floor(Number(e.target.value)));
                setMinSpeechCount(Number.isFinite(next) ? next : 0);
                setPageIndex(0);
              }}
              className="h-8 w-24 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 outline-none focus:border-cyan-400/60"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-400" htmlFor="rp-sort">
            並び替え
          </label>
          <select
            id="rp-sort"
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setPageIndex(0);
            }}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 outline-none focus:border-cyan-400/60"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSortDir((d) => (d === "desc" ? "asc" : "desc"));
              setPageIndex(0);
            }}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 hover:bg-white/5"
            aria-label="Toggle sort direction"
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>

          <label className="ml-2 text-[11px] text-gray-400" htmlFor="rp-page-size">
            表示件数
          </label>
          <select
            id="rp-page-size"
            value={pagination.size}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 outline-none focus:border-cyan-400/60"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
          関連 × 生産性あり
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
          関連 × 生産性なし
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500/80" />
          非関連 × 生産性なし
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-400/15 bg-slate-950/20 p-2">
        <div className="text-[11px] text-gray-400">
          {pagination.total === 0 ? (
            <>条件に一致する議員がいません（最低発言数: {thresholdSafe}）</>
          ) : (
            <>
              {pagination.start + 1}–{pagination.end} / {pagination.total}（ページ {pagination.idx + 1} /{" "}
              {pagination.pageCount}）
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPageIndex(0)}
            disabled={pagination.idx === 0}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
          >
            最初
          </button>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={pagination.idx === 0}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
          >
            前へ
          </button>
          <button
            type="button"
            onClick={() => setPageIndex((p) => Math.min(pagination.pageCount - 1, p + 1))}
            disabled={pagination.idx >= pagination.pageCount - 1}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
          >
            次へ
          </button>
          <button
            type="button"
            onClick={() => setPageIndex(pagination.pageCount - 1)}
            disabled={pagination.idx >= pagination.pageCount - 1}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
          >
            最後
          </button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto pr-1">
        <div className="flex flex-col gap-1.5">
          {pageRows.map((d) => {
            const personId = String(d.person_id);
            const meta = personIndex.get(Number(d.person_id)) ?? null;
            const name = meta?.name_kanji ?? d.speakerID ?? `person_id=${personId}`;
            const group = meta?.election_signature ?? d.speakerGroup ?? "";

            const tt = normalizeProp(d.prop_R_True_P_True);
            const tf = normalizeProp(d.prop_R_True_P_False);
            const ff = normalizeProp(d.prop_R_False_P_False);

            const isSelected = selectedPersonId != null && String(selectedPersonId) === personId;
            const sortValue = normalizeProp((d as any)[sortKey] as number);

            return (
              <button
                key={personId}
                type="button"
                onClick={() => onSelectPersonId(personId)}
                className={
                  "group w-full rounded-xl border p-2 text-left transition-colors " +
                  (isSelected
                    ? "border-cyan-400/60 bg-cyan-500/10"
                    : "border-slate-400/15 bg-slate-950/20 hover:bg-white/5")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-100">{name}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-gray-300" title="選択中の並び替え指標">
                    {percentLabel(sortValue)}
                  </div>
                </div>

                <div className="mt-2">
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-emerald-500/80"
                        style={{ width: `${Math.round(tt * 10000) / 100}%` }}
                        title={`関連×生産性あり: ${percentLabel(tt)}`}
                      />
                      <div
                        className="h-full bg-amber-500/80"
                        style={{ width: `${Math.round(tf * 10000) / 100}%` }}
                        title={`関連×生産性なし: ${percentLabel(tf)}`}
                      />
                      <div
                        className="h-full bg-rose-500/80"
                        style={{ width: `${Math.round(ff * 10000) / 100}%` }}
                        title={`非関連×生産性なし: ${percentLabel(ff)}`}
                      />
                      {/* remainder stays as background (fixed total width) */}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                    <div className="truncate">
                      分類された発言数: {Number.isFinite(d.Total_Count) ? d.Total_Count : "-"}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

