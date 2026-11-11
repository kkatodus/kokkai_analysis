"use client";

import { useMemo, useState } from "react";
import type { AllParliamentMemberTableData, QualityAggregate, QualityAnswerCounts, QualityPerson } from "@/app/types";
import { Legend } from "@/app/components/shared/Legend";
import { Empty, ErrorState } from "@/app/components/shared/states";
import { Pager } from "@/app/components/shared/Pager";
import { Badge } from "@/app/components/shared/Badge";
import { Field, Select, TextInput } from "@/app/components/shared/inputs";
import { SegmentedControl } from "@/app/components/shared/Tabs";
import { selectedClass } from "@/app/components/shared/Chip";
import { cx } from "@/app/components/shared/cx";
import type { QualityContribution } from "@/app/types";
import {
  CONTRIBUTION_JA,
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

// Quality scale (DESIGN.md "Data colours"): 成果あり → 成果は限定的 → 成果なし on success / warning / error.
const CONTRIBUTION_FILL: Record<QualityContribution, { bar: string; color: string }> = {
  substantive: { bar: "bg-success", color: "var(--color-success)" },
  limited: { bar: "bg-warning", color: "var(--color-warning)" },
  none: { bar: "bg-error", color: "var(--color-error)" },
};

const barTrack = "w-full overflow-hidden rounded-sm bg-surface-hover";

export function ContributionBar({
  counts,
  className = "h-3",
}: {
  counts: { substantive: number; limited: number; none: number } | null | undefined;
  className?: string;
}) {
  const n = counts ? counts.substantive + counts.limited + counts.none : 0;
  return (
    <div className={cx(className, barTrack)}>
      <div className="flex h-full w-full">
        {CONTRIBUTIONS.map((c) => {
          const r = rate(counts?.[c], n);
          return (
            <div
              key={c}
              className={cx("h-full", CONTRIBUTION_FILL[c].bar)}
              style={{ width: `${Math.round(r * 10000) / 100}%` }}
              title={`${CONTRIBUTION_JA[c]}：${pct(r, 1)}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Answers with no issue on the answerer's side (success) vs answers with one (warning). */
export function AnswerBar({ counts, className = "h-3" }: { counts: QualityAnswerCounts | null | undefined; className?: string }) {
  const n = counts?.n ?? 0;
  const flagged = rate(counts?.flagged?.any, n);
  return (
    <div className={cx(className, barTrack)}>
      <div className="flex h-full w-full">
        <div className="h-full bg-success" style={{ width: `${Math.round((1 - flagged) * 10000) / 100}%` }} title={`問題点なしの答弁：${pct(1 - flagged, 1)}`} />
        <div className="h-full bg-warning" style={{ width: `${Math.round(flagged * 10000) / 100}%` }} title={`問題点が指摘された答弁：${pct(flagged, 1)}`} />
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
  const fmt = (v: number) => (metric.kind === "count" ? `${v.toLocaleString()}件` : pct(v, 1));

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
    return <ErrorState message="やり取りの評価データを読み込めませんでした。時間をおいてページを再読み込みしてください。" />;
  }
  if (!aggregate.persons.length) {
    return <Empty message="やり取りの評価データがありません。" />;
  }

  const thresholdSafe = Number.isFinite(minCount) ? Math.max(0, Math.floor(minCount)) : 0;
  const totals = aggregate.totals.as_questioner;
  const baseline = (() => {
    // the same metric over the whole corpus, for context
    const fake: QualityPerson = { person_id: 0, name: null, group: null, as_questioner: totals, as_answerer: aggregate.totals.as_answerer };
    return metricValue(fake, metricKey);
  })();

  const legendItems =
    metric.role === "answerer"
      ? [
          { label: "問題点なしの答弁", color: "var(--color-success)" },
          { label: "問題点が指摘された答弁", color: "var(--color-warning)" },
        ]
      : CONTRIBUTIONS.map((c) => ({ label: CONTRIBUTION_JA[c], color: CONTRIBUTION_FILL[c].color }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <Field label="並び替え" htmlFor="sq-sort" className="min-w-[10rem] flex-1">
          <Select
            id="sq-sort"
            size="sm"
            value={metricKey}
            onChange={(e) => {
              setMetricKey(e.target.value as QualityMetricKey);
              setPageIndex(0);
            }}
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
          </Select>
        </Field>
        <SegmentedControl<"desc" | "asc">
          label="並び順"
          items={[
            { value: "desc", label: "高い順" },
            { value: "asc", label: "低い順" },
          ]}
          value={sortDir}
          onChange={(d) => {
            setSortDir(d);
            setPageIndex(0);
          }}
        />
        <Field label="最低やり取り数" htmlFor="sq-threshold" className="w-28">
          <TextInput
            id="sq-threshold"
            type="number"
            size="sm"
            min={0}
            step={1}
            value={thresholdSafe}
            onChange={(e) => {
              const next = Math.max(0, Math.floor(Number(e.target.value)));
              setMinCount(Number.isFinite(next) ? next : 0);
              setPageIndex(0);
            }}
          />
        </Field>
        <Field label="表示件数" htmlFor="sq-page-size" className="w-24">
          <Select
            id="sq-page-size"
            size="sm"
            value={pagination.size}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPageIndex(0);
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}件
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Legend items={legendItems} />
        <p className="text-caption text-ink-muted" title={metric.hint}>
          {metric.label}
          {baseline && metric.kind === "share" ? `・全体${pct(baseline.value, 1)}` : ""}
          {aggregate.coverage.from ? `・対象${yearMonth(aggregate.coverage.from)}〜${yearMonth(aggregate.coverage.to)}` : ""}
        </p>
      </div>

      <p className="text-body-sm text-ink" aria-live="polite">
        {pagination.total === 0 ? (
          <>条件に一致する議員がいません（最低やり取り数：{thresholdSafe.toLocaleString()}）</>
        ) : (
          <>
            議員別 {(pagination.start + 1).toLocaleString()}〜{pagination.end.toLocaleString()}人目
            <span className="text-ink-muted">
              （該当{pagination.total.toLocaleString()}人／全{aggregate.persons.length.toLocaleString()}人）
            </span>
          </>
        )}
      </p>

      <div className="max-h-[420px] overflow-auto pr-1">
        <ul className="flex flex-col gap-2">
          {pageRows.map(({ p, value, n }) => {
            const personId = String(p.person_id);
            const meta = personIndex.get(p.person_id) ?? null;
            const name = meta?.name_kanji ?? p.name ?? "氏名不明";
            const isSelected = selectedPersonId != null && String(selectedPersonId) === personId;
            const asAnswerer = metric.role === "answerer";
            const q = p.as_questioner;
            const a = p.as_answerer;
            const range = asAnswerer ? a : q;
            const issues = asAnswerer ? topAnswererIssues(a) : topIssues(q);

            return (
              <li key={personId}>
                <button
                  type="button"
                  onClick={() => onSelectPersonId(personId)}
                  className={cx(
                    "w-full rounded-lg border p-3 text-left transition-colors duration-150",
                    isSelected ? cx(selectedClass, "edge-primary") : "border-line bg-surface-raised hover:bg-surface-hover",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={cx("truncate text-title-sm", isSelected ? "text-on-primary-soft" : "text-ink-strong")}>{name}</div>
                      <div className="truncate text-caption text-ink-muted">{p.group ?? ""}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-title-sm text-ink-strong tabular-nums" title={metric.label}>
                        {fmt(value)}
                      </div>
                      <div className="text-data text-ink-muted">
                        {metric.role === "answerer" ? "答弁" : "質問"}
                        {n.toLocaleString()}件
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    {asAnswerer ? <AnswerBar counts={a} /> : <ContributionBar counts={q?.contribution ?? null} />}
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-caption text-ink-muted">
                      <div className="truncate">
                        {range ? `${yearMonth(range.first)}〜${yearMonth(range.last)}` : asAnswerer ? "答弁者としての記録なし" : "質問者としての記録なし"}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {issues.map((i) => (
                          <Badge key={i.type} tone="warning">
                            {ISSUE_JA[i.type]} {pct(i.share)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Pager page={pagination.idx + 1} pageCount={pagination.pageCount} onChange={(pg) => setPageIndex(pg - 1)} />
    </div>
  );
}
