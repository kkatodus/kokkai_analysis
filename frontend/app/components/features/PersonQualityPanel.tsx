"use client";

import { useId, useMemo, useState } from "react";
import type {
  QualityAggregate,
  QualityContribution,
  QualityExchange,
  QualityFunction,
  QualityIssueType,
  QualityPerson,
} from "@/app/types";
import { Button } from "@/app/components/shared/Button";
import { Heading, Panel } from "@/app/components/shared/Card";
import { ExpandableText } from "@/app/components/shared/ExpandableText";
import { Select } from "@/app/components/shared/inputs";
import { Pager } from "@/app/components/shared/Pager";
import { Empty, ErrorState, Loading } from "@/app/components/shared/states";
import { formatJaDate } from "@/app/components/features/SpeechRecordCard";
import { ExchangeChips } from "@/app/components/features/QualityChips";
import {
  ANSWERER_ISSUE_TYPES,
  CONTRIBUTION_JA,
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

/** Semantic fills for the quality bars (DESIGN.md "Data colours": success / warning / error, info for outcomes). */
const BAR_PART = "bg-warning";
const BAR_MOST = "bg-error";
const BAR_OUTCOME = "bg-info";
const CONTRIBUTION_BAR: Record<QualityContribution, string> = {
  substantive: "bg-success",
  limited: "bg-warning",
  none: "bg-error",
};
/** Leading edge of an exchange row, by contribution. */
const CONTRIBUTION_EDGE: Record<QualityContribution, string> = {
  substantive: "border-l-success",
  limited: "border-l-warning",
  none: "border-l-error",
};

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <Panel>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <Heading level={3} size="title-sm">
          {title}
        </Heading>
        {aside && <div className="text-caption text-ink-muted">{aside}</div>}
      </div>
      {children}
    </Panel>
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
    <div className={"grid grid-cols-[minmax(0,7.5rem)_minmax(2.5rem,1fr)_auto] items-center gap-2 text-caption " + (dim ? "text-ink-muted" : "")}>
      <div className={"truncate " + (dim ? "text-ink-muted" : "text-ink")} title={label}>
        {label}
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-raised ring-1 ring-line">
        <div className="flex h-full">
          {segments
            ? segments.map((sg, i) => <div key={i} className={`h-full ${sg.color}`} style={{ width: w(sg.share) }} title={sg.title} />)
            : <div className={`h-full ${color}`} style={{ width: w(share) }} />}
        </div>
        {baseline !== undefined && baseline !== null && (
          <div className="absolute inset-y-0 w-px bg-ink-strong" style={{ left: w(baseline) }} title={`全体：${pct(baseline, 1)}`} />
        )}
      </div>
      <div className="min-w-24 text-right text-data text-ink-strong">
        {pct(share, 1)} <span className="text-ink-muted">（{n.toLocaleString()}件）</span>
      </div>
    </div>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2">
        <h4 className="text-label-md text-ink">{title}</h4>
        {note && <div className="text-caption text-ink-muted">{note}</div>}
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
  const listHeadingId = useId();

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
    return <Loading rows={4} label="やり取りの評価を読み込み中…" />;
  }
  if (error) {
    return <ErrorState message="やり取りの評価データを読み込めませんでした。時間をおいて開き直してください。" />;
  }
  if (!person && !(exchanges && exchanges.length)) {
    return (
      <Empty message="この議員のやり取りはまだAI判定されていません（対象は2015年9月以降の委員会での質疑で、順次さかのぼって追加しています）。" />
    );
  }

  const answererFirst = (a?.n ?? 0) > (q?.n ?? 0);
  const q_section = (
    <>
      {q && q.n > 0 && (
        <Section title="質問者として" aside={`${q.n.toLocaleString()}件・${yearMonth(q.first)}〜${yearMonth(q.last)}`}>
          <p className="mb-2 text-caption text-ink-muted">棒はこの人の割合、白い縦線は全議員の平均です。</p>

          <Group title="成果（やり取り全体として）">
            {CONTRIBUTIONS.map((c) => (
              <MetricRow
                key={c}
                label={CONTRIBUTION_JA[c]}
                n={q.contribution[c]}
                share={rate(q.contribution[c], q.n)}
                baseline={tq ? rate(tq.contribution[c], tq.n) : null}
                color={CONTRIBUTION_BAR[c]}
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
              <Group title="成果の内訳" note={max < 1 ? `目盛：0〜${pct(max)}` : undefined}>
                {OUTCOMES.map((o) => (
                  <MetricRow
                    key={o}
                    label={OUTCOME_JA[o]}
                    n={q.outcomes[o]}
                    share={rate(q.outcomes[o], q.n)}
                    baseline={tq ? rate(tq.outcomes[o], tq.n) : null}
                    color={BAR_OUTCOME}
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
              <Group title="指摘された問題点（質問者側）" note={`${max < 1 ? `目盛：0〜${pct(max)}・` : ""}濃い色は大半を占めたもの`}>
                <MetricRow
                  label="問題点が一つ以上"
                  n={q.flagged?.any ?? 0}
                  share={rate(q.flagged?.any, q.n)}
                  baseline={tq ? rate(tq.flagged?.any, tq.n) : null}
                  color={BAR_PART}
                  segments={[
                    { share: rate((q.flagged?.any ?? 0) - (q.flagged?.most ?? 0), q.n), color: BAR_PART, title: "一部に問題" },
                    { share: rate(q.flagged?.most, q.n), color: BAR_MOST, title: "大半が問題" },
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
                    color={BAR_PART}
                    segments={[
                      { share: rate(q.issues[t].part, q.n), color: BAR_PART, title: `一部：${q.issues[t].part}件` },
                      { share: rate(q.issues[t].most, q.n), color: BAR_MOST, title: `大半：${q.issues[t].most}件` },
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
        <Section title="答弁者として" aside={`${a.n.toLocaleString()}件・${yearMonth(a.first)}〜${yearMonth(a.last)}`}>
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
                <p className="mb-2 text-caption text-ink-muted">
                  棒はこの人の割合、白い縦線は全答弁者の平均です。{max < 1 ? `目盛：0〜${pct(max)}。` : ""}
                </p>
                <Group title="指摘された問題点（答弁者側）" note="濃い色は大半を占めたもの">
                <MetricRow
                  label="問題点が一つ以上"
                  n={a.flagged?.any ?? 0}
                  share={rate(a.flagged?.any, a.n)}
                  baseline={ta ? rate(ta.flagged?.any, ta.n) : null}
                  color={BAR_PART}
                  segments={[
                    { share: rate((a.flagged?.any ?? 0) - (a.flagged?.most ?? 0), a.n), color: BAR_PART, title: "一部に問題" },
                    { share: rate(a.flagged?.most, a.n), color: BAR_MOST, title: "大半が問題" },
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
                    color={BAR_PART}
                    segments={[
                      { share: rate(a.issues[t].part, a.n), color: BAR_PART, title: `一部：${a.issues[t].part}件` },
                      { share: rate(a.issues[t].most, a.n), color: BAR_MOST, title: `大半：${a.issues[t].most}件` },
                    ]}
                    max={max}
                    dim={issueTotal(a.issues[t]) === 0}
                  />
                ))}
                </Group>
                <Group title="答弁がもたらしたもの">
                  <MetricRow label="新事実が出た" n={a.outcomes.new_information} share={rate(a.outcomes.new_information, a.n)} baseline={ta ? rate(ta.outcomes.new_information, ta.n) : null} color={BAR_OUTCOME} max={max} />
                  <MetricRow label="具体的な約束" n={a.outcomes.commitment} share={rate(a.outcomes.commitment, a.n)} baseline={ta ? rate(ta.outcomes.commitment, ta.n) : null} color={BAR_OUTCOME} max={max} />
                </Group>
              </>
            );
          })()}
        </Section>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 pb-3">
      {answererFirst ? a_section : q_section}
      {answererFirst ? q_section : a_section}

      <section aria-labelledby={listHeadingId} className="pt-1">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2">
          <Heading level={3} size="title-sm" id={listHeadingId}>
            やり取り一覧
          </Heading>
          {exchanges && (
            <div className="text-data text-ink-muted">
              {filtered.length.toLocaleString()} / {exchanges.length.toLocaleString()}件
            </div>
          )}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <Select size="sm" aria-label="質問と答弁で絞り込む" className="max-w-full" value={role} onChange={(e) => { setRole(e.target.value as typeof role); resetPage(); }}>
            <option value="all">質問・答弁すべて</option>
            <option value="questioner">質問者として</option>
            <option value="answerer">答弁者として</option>
          </Select>
          <Select size="sm" aria-label="種類で絞り込む" className="max-w-full" value={fn} onChange={(e) => { setFn(e.target.value as typeof fn); resetPage(); }}>
            <option value="all">種類すべて</option>
            {FUNCTIONS.map((f) => (
              <option key={f} value={f}>{FUNCTION_JA[f]}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="成果で絞り込む" className="max-w-full" value={contribution} onChange={(e) => { setContribution(e.target.value as typeof contribution); resetPage(); }}>
            <option value="all">成果すべて</option>
            {CONTRIBUTIONS.map((c) => (
              <option key={c} value={c}>{CONTRIBUTION_JA[c]}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="問題点で絞り込む" className="max-w-full" value={issue} onChange={(e) => { setIssue(e.target.value as typeof issue); resetPage(); }}>
            <option value="all">問題点で絞り込む</option>
            {[...QUESTIONER_ISSUE_TYPES, "evasive" as const].map((t) => (
              <option key={t} value={t}>{ISSUE_JA[t]}</option>
            ))}
          </Select>
        </div>

        {loading && <Loading label="やり取りを読み込み中…" />}
        {!loading && filtered.length === 0 && <Empty message="この条件に該当するやり取りはありません。絞り込みを変えてください。" />}

        <ul className="grid gap-2">
          {pageRows.map((ex) => (
            <li
              key={ex.start_speech_id}
              className={"rounded-lg border border-l-2 border-line bg-surface-raised p-3 " + CONTRIBUTION_EDGE[ex.contribution]}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 text-caption text-ink-muted">
                  <span className="text-ink">{formatJaDate(ex.date)}</span>
                  {ex.meeting ? `・${ex.house ?? ""}${ex.meeting}` : ""}
                  {ex.role !== "questioner" && (
                    <span className="ml-1">
                      {ex.role === "answerer" ? `（${ex.questioner}の質問に答弁）` : "（質問と答弁）"}
                    </span>
                  )}
                </div>
                <Button size="sm" onClick={() => onSelectIssueId(ex.issue_id, ex.start_speech_id)} title="このやり取りの位置で会議を開く">
                  会議を閲覧する
                </Button>
              </div>
              <div className="mt-2">
                <ExchangeChips fn={ex.function} contribution={ex.contribution} issues={ex.issues} outcomes={ex.outcomes} prefixed />
              </div>
              <ExpandableText lines={2} className="mt-2 text-body-md text-ink">
                {ex.reason}
              </ExpandableText>
            </li>
          ))}
        </ul>

        <Pager className="mt-3" page={pageSafe + 1} pageCount={pageCount} onChange={(p) => setPage(p - 1)} />
      </section>
    </div>
  );
}
