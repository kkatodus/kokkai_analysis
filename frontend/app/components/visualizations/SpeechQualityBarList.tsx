"use client";

import { useMemo, useState } from "react";
import type { AllParliamentMemberTableData, QualityAggregate, QualityAnswerCounts, QualityPerson } from "@/app/types";
import {
  CONTRIBUTION_JA,
  CONTRIBUTION_STYLE,
  CONTRIBUTIONS,
  DEFAULT_METRIC_KEY,
  ISSUE_JA,
  metricByKey,
  metricGroups,
  metricValue,
  pct,
  rate,
  topAnswererIssues,
  topIssues,
  yearMonth,
  type QualityMetricKey,
} from "@/app/lib/quality";

export function ContributionBar({
  counts,
  className = "h-3",
}: {
  counts: { substantive: number; limited: number; none: number } | null | undefined;
  className?: string;
}) {
  const n = counts ? counts.substantive + counts.limited + counts.none : 0;
  return (
    <div className={`${className} w-full overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10`}>
      <div className="flex h-full w-full">
        {CONTRIBUTIONS.map((c) => {
          const r = rate(counts?.[c], n);
          return (
            <div
              key={c}
              className={`h-full ${CONTRIBUTION_STYLE[c].bar}`}
              style={{ width: `${Math.round(r * 10000) / 100}%` }}
              title={`${CONTRIBUTION_JA[c]}: ${pct(r, 1)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Answers with no issue on the answerer's side (emerald) vs answers with one (amber). */
export function AnswerBar({ counts, className = "h-3" }: { counts: QualityAnswerCounts | null | undefined; className?: string }) {
  const n = counts?.n ?? 0;
  const flagged = rate(counts?.flagged?.any, n);
  return (
    <div className={`${className} w-full overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10`}>
      <div className="flex h-full w-full">
        <div className="h-full bg-emerald-500/80" style={{ width: `${Math.round((1 - flagged) * 10000) / 100}%` }} title={`問題点なしの答弁: ${pct(1 - flagged, 1)}`} />
        <div className="h-full bg-amber-500/80" style={{ width: `${Math.round(flagged * 10000) / 100}%` }} title={`問題点が指摘された答弁: ${pct(flagged, 1)}`} />
      </div>
    </div>
  );
}

export function SpeechQualityBarList({
  aggregate,
  allParliamentMemberTable,
  selectedPersonId,
  onSelectPersonId,
}: {
  aggregate: QualityAggregate | null;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
  selectedPersonId?: string | null;
  onSelectPersonId: (personId: string) => void;
}) {
  const [metricKey, setMetricKey] = useState<QualityMetricKey>(DEFAULT_METRIC_KEY);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [minCount, setMinCount] = useState<number>(20);
  const [pageSize, setPageSize] = useState<number>(25);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const metric = metricByKey(metricKey);
  const fmt = (v: number) => (metric.kind === "count" ? `${v.toLocaleString()} 件` : pct(v, 1));

  const personIndex = useMemo(() => {
    const map = new Map<number, AllParliamentMemberTableData>();
    for (const row of allParliamentMemberTable ?? []) {
      if (row?.person_id) map.set(Number(row.person_id), row);
    }
    return map;
  }, [allParliamentMemberTable]);

  const rows = useMemo(() => {
    const threshold = Number.isFinite(minCount) ? Math.max(0, Math.floor(minCount)) : 0;
    const dir = sortDir === "desc" ? -1 : 1;
    const out: Array<{ p: QualityPerson; value: number; n: number }> = [];
    for (const p of aggregate?.persons ?? []) {
      const m = metricValue(p, metricKey);
      if (!m || m.n < Math.max(1, threshold)) continue;
      out.push({ p, value: m.value, n: m.n });
    }
    out.sort((a, b) => {
      if (a.value !== b.value) return (a.value < b.value ? -1 : 1) * dir;
      if (a.n !== b.n) return a.n < b.n ? 1 : -1;
      return a.p.person_id - b.p.person_id;
    });
    return out;
  }, [aggregate, metricKey, sortDir, minCount]);

  const pagination = useMemo(() => {
    const size = Number.isFinite(pageSize) ? Math.max(5, Math.min(200, Math.floor(pageSize))) : 25;
    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / size));
    const idx = Math.max(0, Math.min(pageIndex, pageCount - 1));
    const start = idx * size;
    return { size, total, pageCount, idx, start, end: Math.min(total, start + size) };
  }, [rows.length, pageSize, pageIndex]);

  const pageRows = rows.slice(pagination.start, pagination.end);

  if (!aggregate) {
    return <div className="py-6 text-center text-sm text-gray-400">やり取りの評価データを読み込めませんでした。</div>;
  }
  if (!aggregate.persons.length) {
    return <div className="py-6 text-center text-sm text-gray-400">やり取りの評価データがありません。</div>;
  }

  const thresholdSafe = Number.isFinite(minCount) ? Math.max(0, Math.floor(minCount)) : 0;
  const totals = aggregate.totals.as_questioner;
  const baseline = (() => {
    // the same metric over the whole corpus, for context
    const fake: QualityPerson = { person_id: 0, name: null, group: null, as_questioner: totals, as_answerer: aggregate.totals.as_answerer };
    return metricValue(fake, metricKey);
  })();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-gray-300">
          <div>
            議員別（{pagination.total} 人 / 全 {aggregate.persons.length} 人）
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-gray-400" htmlFor="sq-threshold">
              最低やり取り数
            </label>
            <input
              id="sq-threshold"
              type="number"
              min={0}
              step={1}
              value={thresholdSafe}
              onChange={(e) => {
                const next = Math.max(0, Math.floor(Number(e.target.value)));
                setMinCount(Number.isFinite(next) ? next : 0);
                setPageIndex(0);
              }}
              className="h-8 w-24 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 focus:border-cyan-400/60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-gray-400" htmlFor="sq-sort">
            並び替え
          </label>
          <select
            id="sq-sort"
            value={metricKey}
            onChange={(e) => {
              setMetricKey(e.target.value as QualityMetricKey);
              setPageIndex(0);
            }}
            className="h-8 max-w-[260px] rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 focus:border-cyan-400/60"
          >
            {metricGroups().map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.metrics.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
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

          <label className="ml-2 text-[11px] text-gray-400" htmlFor="sq-page-size">
            表示件数
          </label>
          <select
            id="sq-page-size"
            value={pagination.size}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
            className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 focus:border-cyan-400/60"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
        {metric.role === "answerer" ? (
          <>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
              問題点なしの答弁
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
              問題点が指摘された答弁
            </div>
          </>
        ) : (
          CONTRIBUTIONS.map((c) => (
            <div key={c} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${CONTRIBUTION_STYLE[c].dot}`} />
              {CONTRIBUTION_JA[c]}
            </div>
          ))
        )}
        <div className="ml-auto text-gray-500" title={metric.hint}>
          {metric.label}
          {baseline && metric.kind === "share" ? `・全体 ${pct(baseline.value, 1)}` : ""}
          {aggregate.coverage.from ? `・対象 ${yearMonth(aggregate.coverage.from)}〜${yearMonth(aggregate.coverage.to)}` : ""}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-400/15 bg-slate-950/20 p-2">
        <div className="text-[11px] text-gray-400">
          {pagination.total === 0 ? (
            <>条件に一致する議員がいません（最低やり取り数: {thresholdSafe}）</>
          ) : (
            <>
              {pagination.start + 1}–{pagination.end} / {pagination.total}（ページ {pagination.idx + 1} /{" "}
              {pagination.pageCount}）
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { label: "最初", to: 0, disabled: pagination.idx === 0 },
            { label: "前へ", to: Math.max(0, pagination.idx - 1), disabled: pagination.idx === 0 },
            { label: "次へ", to: Math.min(pagination.pageCount - 1, pagination.idx + 1), disabled: pagination.idx >= pagination.pageCount - 1 },
            { label: "最後", to: pagination.pageCount - 1, disabled: pagination.idx >= pagination.pageCount - 1 },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => setPageIndex(b.to)}
              disabled={b.disabled}
              className="h-8 rounded-lg border border-slate-400/30 bg-slate-950/40 px-2 text-[12px] text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto pr-1">
        <div className="flex flex-col gap-1.5">
          {pageRows.map(({ p, value, n }) => {
            const personId = String(p.person_id);
            const meta = personIndex.get(p.person_id) ?? null;
            const name = meta?.name_kanji ?? p.name ?? `person_id=${personId}`;
            const isSelected = selectedPersonId != null && String(selectedPersonId) === personId;
            const asAnswerer = metric.role === "answerer";
            const q = p.as_questioner;
            const a = p.as_answerer;
            const range = asAnswerer ? a : q;
            const issues = asAnswerer ? topAnswererIssues(a) : topIssues(q);

            return (
              <button
                key={personId}
                type="button"
                onClick={() => onSelectPersonId(personId)}
                className={
                  "group w-full rounded-xl border p-2 text-left transition-colors " +
                  (isSelected ? "border-cyan-400/60 bg-cyan-500/10" : "border-slate-400/15 bg-slate-950/20 hover:bg-white/5")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-100">{name}</div>
                    <div className="truncate text-[10px] text-gray-500">{p.group ?? ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-semibold text-gray-100" title={metric.label}>
                      {fmt(value)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {metric.role === "answerer" ? "答弁" : "質問"} {n} 件
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  {asAnswerer ? <AnswerBar counts={a} /> : <ContributionBar counts={q?.contribution ?? null} />}
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[10px] text-gray-500">
                    <div className="truncate">
                      {range ? `${yearMonth(range.first)}〜${yearMonth(range.last)}` : asAnswerer ? "答弁者としての記録なし" : "質問者としての記録なし"}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {issues.map((i) => (
                        <span key={i.type} className="rounded-full border border-amber-400/25 bg-amber-500/10 px-1.5 text-amber-100/90">
                          {ISSUE_JA[i.type]} {pct(i.share)}
                        </span>
                      ))}
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
