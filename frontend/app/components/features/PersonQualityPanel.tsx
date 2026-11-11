"use client";

import { useMemo, useState } from "react";
import type {
  QualityAggregate,
  QualityContribution,
  QualityExchange,
  QualityFunction,
  QualityIssueType,
  QualityPerson,
} from "@/app/types";
import { EmptyState } from "@/app/components/shared/EmptyState";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";
import { ExchangeChips } from "@/app/components/features/QualityChips";
import {
  ANSWERER_ISSUE_TYPES,
  CONTRIBUTION_JA,
  CONTRIBUTION_STYLE,
  CONTRIBUTIONS,
  FUNCTION_JA,
  FUNCTION_STYLE,
  FUNCTIONS,
  ISSUE_JA,
  OUTCOME_JA,
  OUTCOMES,
  QUESTIONER_ISSUE_TYPES,
  issueTotal,
  pct,
  rate,
  yearMonth,
} from "@/app/lib/quality";

const PAGE = 20;

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-gray-100">{title}</div>
        {aside && <div className="text-[10px] text-gray-400">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * One metric as a row: label, a bar for this person's share with a tick at the corpus baseline, and the count.
 * `segments` splits the bar (e.g. 一部 / 大半 of an issue); otherwise `share` fills it in `color`.
 * `max` is the scale's right edge (1 for compositional groups, a group-wide max for sparse ones).
 */
function MetricRow({
  label,
  n,
  share,
  baseline,
  color,
  segments,
  max = 1,
  dim = false,
}: {
  label: string;
  n: number;
  share: number;
  baseline?: number | null;
  color: string;
  segments?: Array<{ share: number; color: string; title: string }>;
  max?: number;
  dim?: boolean;
}) {
  const w = (x: number) => `${Math.round(Math.min(1, x / max) * 10000) / 100}%`;
  return (
    <div className={"grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-[11px] " + (dim ? "opacity-60" : "")}>
      <div className="truncate text-gray-200" title={label}>
        {label}
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
        <div className="flex h-full">
          {segments
            ? segments.map((sg, i) => <div key={i} className={`h-full ${sg.color}`} style={{ width: w(sg.share) }} title={sg.title} />)
            : <div className={`h-full ${color}`} style={{ width: w(share) }} />}
        </div>
        {baseline !== undefined && baseline !== null && (
          <div className="absolute inset-y-0 w-px bg-white/70" style={{ left: w(baseline) }} title={`全体 ${pct(baseline, 1)}`} />
        )}
      </div>
      <div className="w-[7.5rem] text-right tabular-nums text-gray-100">
        {pct(share, 1)} <span className="text-gray-500">({n} 件)</span>
      </div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold text-gray-200">{title}</div>
        {note && <div className="text-[10px] text-gray-500">{note}</div>}
      </div>
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

/** Right edge for a sparse group: the largest share in view with a little headroom, at least 10%. */
function scaleFor(shares: number[]): number {
  const m = Math.max(0.1, ...shares.filter((x) => Number.isFinite(x)));
  return Math.min(1, Math.ceil(m * 1.25 * 20) / 20);
}

export function PersonQualityPanel({
  person,
  totals,
  exchanges,
  loading,
  error,
  onSelectIssueId,
}: {
  person: QualityPerson | null;
  totals: QualityAggregate["totals"] | null;
  exchanges: QualityExchange[] | null;
  loading: boolean;
  error: string | null;
  onSelectIssueId: (issueId: string, speechId?: string | null) => void;
}) {
  const [role, setRole] = useState<"all" | "questioner" | "answerer">("all");
  const [fn, setFn] = useState<QualityFunction | "all">("all");
  const [contribution, setContribution] = useState<QualityContribution | "all">("all");
  const [issue, setIssue] = useState<QualityIssueType | "all">("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const q = person?.as_questioner ?? null;
  const a = person?.as_answerer ?? null;
  const tq = totals?.as_questioner ?? null;
  const ta = totals?.as_answerer ?? null;

  const filtered = useMemo(() => {
    const list = exchanges ?? [];
    return list.filter((ex) => {
      if (role === "questioner" && ex.role === "answerer") return false;
      if (role === "answerer" && ex.role === "questioner") return false;
      if (fn !== "all" && ex.function !== fn) return false;
      if (contribution !== "all" && ex.contribution !== contribution) return false;
      if (issue !== "all" && !(ex.issues ?? []).some((i) => i.type === issue)) return false;
      return true;
    });
  }, [exchanges, role, fn, contribution, issue]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageSafe = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(pageSafe * PAGE, pageSafe * PAGE + PAGE);

  const resetPage = () => setPage(0);

  if (loading && !exchanges) {
    return (
      <div className="p-2">
        <LoadingIndicator label="読み込み中" size="sm" />
      </div>
    );
  }
  if (error) {
    return <div className="px-2 pb-2 text-xs text-red-300">やり取りの評価データを読み込めませんでした</div>;
  }
  if (!person && !(exchanges && exchanges.length)) {
    return (
      <EmptyState
        message="この議員のやり取りはまだAI判定されていません（対象は2015年9月以降の委員会での質疑で、順次さかのぼって追加しています）。"
        className="py-4"
      />
    );
  }

  const selectCls =
    "h-7 max-w-full rounded-lg border border-slate-400/30 bg-slate-950/40 px-1.5 text-[11px] text-gray-100 focus:border-cyan-400/60";

  const answererFirst = (a?.n ?? 0) > (q?.n ?? 0);
  const q_section = (
    <>
      {q && q.n > 0 && (
        <Section title="質問者として" aside={`${q.n} 件・${yearMonth(q.first)}〜${yearMonth(q.last)}`}>
          <div className="mb-2 text-[10px] text-gray-500">棒はこの人の割合、白い縦線は全議員の平均。</div>

          <Group title="成果（やり取り全体として）">
            {CONTRIBUTIONS.map((c) => (
              <MetricRow
                key={c}
                label={CONTRIBUTION_JA[c]}
                n={q.contribution[c]}
                share={rate(q.contribution[c], q.n)}
                baseline={tq ? rate(tq.contribution[c], tq.n) : null}
                color={CONTRIBUTION_STYLE[c].bar}
              />
            ))}
          </Group>

          <Group title="何のためのやり取りか">
            {FUNCTIONS.filter((f) => q.function[f] > 0 || (tq && rate(tq.function[f], tq.n) >= 0.01)).map((f) => (
              <MetricRow
                key={f}
                label={FUNCTION_JA[f]}
                n={q.function[f]}
                share={rate(q.function[f], q.n)}
                baseline={tq ? rate(tq.function[f], tq.n) : null}
                color={FUNCTION_STYLE[f].bar}
              />
            ))}
          </Group>

          {(() => {
            const max = scaleFor([...OUTCOMES.map((o) => rate(q.outcomes[o], q.n)), ...(tq ? OUTCOMES.map((o) => rate(tq.outcomes[o], tq.n)) : [])]);
            return (
              <Group title="成果の内訳" note={max < 1 ? `目盛 0〜${pct(max)}` : undefined}>
                {OUTCOMES.map((o) => (
                  <MetricRow
                    key={o}
                    label={OUTCOME_JA[o]}
                    n={q.outcomes[o]}
                    share={rate(q.outcomes[o], q.n)}
                    baseline={tq ? rate(tq.outcomes[o], tq.n) : null}
                    color="bg-sky-500/80"
                    max={max}
                  />
                ))}
              </Group>
            );
          })()}

          {(() => {
            const types = QUESTIONER_ISSUE_TYPES;
            const max = scaleFor([
              rate(q.flagged?.any, q.n),
              ...(tq ? [rate(tq.flagged?.any, tq.n)] : []),
              ...types.map((t) => rate(issueTotal(q.issues[t]), q.n)),
              ...(tq ? types.map((t) => rate(issueTotal(tq.issues[t]), tq.n)) : []),
            ]);
            return (
              <Group title="指摘された問題点（質問者側）" note={`${max < 1 ? `目盛 0〜${pct(max)}・` : ""}濃い色は大半を占めたもの`}>
                <MetricRow
                  label="問題点が一つ以上"
                  n={q.flagged?.any ?? 0}
                  share={rate(q.flagged?.any, q.n)}
                  baseline={tq ? rate(tq.flagged?.any, tq.n) : null}
                  color="bg-amber-500/80"
                  segments={[
                    { share: rate((q.flagged?.any ?? 0) - (q.flagged?.most ?? 0), q.n), color: "bg-amber-500/70", title: "一部に問題" },
                    { share: rate(q.flagged?.most, q.n), color: "bg-rose-500/85", title: "大半が問題" },
                  ]}
                  max={max}
                />
                {types.map((t) => (
                  <MetricRow
                    key={t}
                    label={ISSUE_JA[t]}
                    n={issueTotal(q.issues[t])}
                    share={rate(issueTotal(q.issues[t]), q.n)}
                    baseline={tq ? rate(issueTotal(tq.issues[t]), tq.n) : null}
                    color="bg-amber-500/80"
                    segments={[
                      { share: rate(q.issues[t].part, q.n), color: "bg-amber-500/70", title: `一部: ${q.issues[t].part} 件` },
                      { share: rate(q.issues[t].most, q.n), color: "bg-rose-500/85", title: `大半: ${q.issues[t].most} 件` },
                    ]}
                    max={max}
                    dim={issueTotal(q.issues[t]) === 0}
                  />
                ))}
              </Group>
            );
          })()}
        </Section>
      )}
    </>
  );
  const a_section = (
    <>
      {a && a.n > 0 && (
        <Section title="答弁者として" aside={`${a.n} 件・${yearMonth(a.first)}〜${yearMonth(a.last)}`}>
          {(() => {
            const types = ANSWERER_ISSUE_TYPES;
            const max = scaleFor([
              rate(a.flagged?.any, a.n),
              ...types.map((t) => rate(issueTotal(a.issues[t]), a.n)),
              rate(a.outcomes.new_information, a.n),
              rate(a.outcomes.commitment, a.n),
              ...(ta
                ? [rate(ta.flagged?.any, ta.n), ...types.map((t) => rate(issueTotal(ta.issues[t]), ta.n)), rate(ta.outcomes.new_information, ta.n), rate(ta.outcomes.commitment, ta.n)]
                : []),
            ]);
            return (
              <>
                <div className="mb-2 text-[10px] text-gray-500">
                  棒はこの人の割合、白い縦線は全答弁者の平均。{max < 1 ? `目盛 0〜${pct(max)}。` : ""}
                </div>
                <Group title="指摘された問題点（答弁者側）" note="濃い色は大半を占めたもの">
                <MetricRow
                  label="問題点が一つ以上"
                  n={a.flagged?.any ?? 0}
                  share={rate(a.flagged?.any, a.n)}
                  baseline={ta ? rate(ta.flagged?.any, ta.n) : null}
                  color="bg-amber-500/80"
                  segments={[
                    { share: rate((a.flagged?.any ?? 0) - (a.flagged?.most ?? 0), a.n), color: "bg-amber-500/70", title: "一部に問題" },
                    { share: rate(a.flagged?.most, a.n), color: "bg-rose-500/85", title: "大半が問題" },
                  ]}
                  max={max}
                />
                {types.map((t) => (
                  <MetricRow
                    key={t}
                    label={ISSUE_JA[t]}
                    n={issueTotal(a.issues[t])}
                    share={rate(issueTotal(a.issues[t]), a.n)}
                    baseline={ta ? rate(issueTotal(ta.issues[t]), ta.n) : null}
                    color="bg-amber-500/80"
                    segments={[
                      { share: rate(a.issues[t].part, a.n), color: "bg-amber-500/70", title: `一部: ${a.issues[t].part} 件` },
                      { share: rate(a.issues[t].most, a.n), color: "bg-rose-500/85", title: `大半: ${a.issues[t].most} 件` },
                    ]}
                    max={max}
                    dim={issueTotal(a.issues[t]) === 0}
                  />
                ))}
                </Group>
                <Group title="答弁がもたらしたもの">
                  <MetricRow label="新事実が出た" n={a.outcomes.new_information} share={rate(a.outcomes.new_information, a.n)} baseline={ta ? rate(ta.outcomes.new_information, ta.n) : null} color="bg-sky-500/80" max={max} />
                  <MetricRow label="具体的な約束" n={a.outcomes.commitment} share={rate(a.outcomes.commitment, a.n)} baseline={ta ? rate(ta.outcomes.commitment, ta.n) : null} color="bg-sky-500/80" max={max} />
                </Group>
              </>
            );
          })()}
        </Section>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5">
      {answererFirst ? a_section : q_section}
      {answererFirst ? q_section : a_section}

      <Section title="やり取り一覧" aside={exchanges ? `${filtered.length} / ${exchanges.length} 件` : undefined}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <select className={selectCls} value={role} onChange={(e) => { setRole(e.target.value as typeof role); resetPage(); }}>
            <option value="all">質問・答弁すべて</option>
            <option value="questioner">質問者として</option>
            <option value="answerer">答弁者として</option>
          </select>
          <select className={selectCls} value={fn} onChange={(e) => { setFn(e.target.value as typeof fn); resetPage(); }}>
            <option value="all">種類すべて</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>{FUNCTION_JA[f]}</option>
            ))}
          </select>
          <select className={selectCls} value={contribution} onChange={(e) => { setContribution(e.target.value as typeof contribution); resetPage(); }}>
            <option value="all">成果すべて</option>
            {CONTRIBUTIONS.map((c) => (
              <option key={c} value={c}>{CONTRIBUTION_JA[c]}</option>
            ))}
          </select>
          <select className={selectCls} value={issue} onChange={(e) => { setIssue(e.target.value as typeof issue); resetPage(); }}>
            <option value="all">問題点で絞り込む</option>
            {[...QUESTIONER_ISSUE_TYPES, "evasive" as const].map((t) => (
              <option key={t} value={t}>{ISSUE_JA[t]}</option>
            ))}
          </select>
        </div>

        {loading && <LoadingIndicator variant="dots" size="sm" />}
        {!loading && filtered.length === 0 && <div className="text-[11px] text-gray-400">該当するやり取りがありません。</div>}

        <div className="grid gap-1.5">
          {pageRows.map((ex) => {
            const key = ex.start_speech_id;
            const isExpanded = expanded.has(key);
            return (
              <div key={key} className={"rounded-lg border border-l-4 p-2 " + CONTRIBUTION_STYLE[ex.contribution].item}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 text-[11px] text-gray-300">
                    <span className="text-gray-100">{ex.date}</span>
                    {ex.meeting ? ` ・ ${ex.house ?? ""}${ex.meeting}` : ""}
                    {ex.role !== "questioner" && (
                      <span className="ml-1 text-gray-400">
                        {ex.role === "answerer" ? `（${ex.questioner} の質問に答弁）` : "（質問と答弁）"}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectIssueId(ex.issue_id, ex.start_speech_id)}
                    className="shrink-0 cursor-pointer rounded-lg border border-slate-400/20 bg-slate-950/20 px-2 py-1 text-[11px] font-semibold text-gray-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-50"
                    title="このやり取りの位置で会議を開く"
                  >
                    会議を閲覧する
                  </button>
                </div>
                <div className="mt-1">
                  <ExchangeChips fn={ex.function} contribution={ex.contribution} issues={ex.issues} outcomes={ex.outcomes} prefixed />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  className={"mt-1 w-full text-left text-[11px] leading-relaxed text-gray-200 " + (isExpanded ? "" : "line-clamp-2")}
                  title={isExpanded ? "折りたたむ" : "全文を表示"}
                >
                  {ex.reason}
                </button>
              </div>
            );
          })}
        </div>

        {pageCount > 1 && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
            <button
              type="button"
              disabled={pageSafe <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded border border-slate-400/20 bg-slate-950/20 px-2 py-0.5 text-gray-200 disabled:opacity-50"
            >
              前へ
            </button>
            <div>
              {pageSafe + 1} / {pageCount}
            </div>
            <button
              type="button"
              disabled={pageSafe >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded border border-slate-400/20 bg-slate-950/20 px-2 py-0.5 text-gray-200 disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
