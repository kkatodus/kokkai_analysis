"use client";

/**
 * The detail pane's 立場 tab (specs/stance-summaries-panel §6.2–6.3): one card per topic with the AI stance
 * summary (three runs), the person's percentile on each sub-topic axis, the evidence counts and a link back
 * to the speeches the summary was built from.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { IoChevronForward } from "react-icons/io5";
import type { IdeologyData, PersonStances, PersonStanceTopic } from "@/app/types";
import { Badge } from "@/app/components/shared/Badge";
import { Button } from "@/app/components/shared/Button";
import { Heading, Panel } from "@/app/components/shared/Card";
import { SegmentedControl } from "@/app/components/shared/Tabs";
import { Empty, ErrorState, Loading } from "@/app/components/shared/states";
import {
  THIN_EVIDENCE_OPINIONS,
  modelDisplayName,
  parseSummary,
  personPositions,
  yearMonth,
  type SubTopicPosition,
} from "@/app/lib/stances";

interface PersonStancePanelProps {
  personId: string;
  stances: PersonStances | null;
  loading: boolean;
  error: string | null;
  ideologyData: IdeologyData | null;
  /** scroll to (and open) this topic slug's card once loaded; `nonce` re-triggers for the same topic */
  focus?: { topic: string | null; nonce: number } | null;
  onShowSpeeches: (topic: PersonStanceTopic) => void;
  onOpenMethodology?: () => void;
}

/** "2016-01-05" → "2016年1月5日", "2016-01" → "2016年1月". */
function jaDate(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!m) return d;
  return `${Number(m[1])}年${m[2] ? `${Number(m[2])}月` : ""}${m[2] && m[3] ? `${Number(m[3])}日` : ""}`;
}

function formatWindow(w: PersonStanceTopic["window"]): string {
  const f = jaDate;
  return `${f(w?.from) ?? "—"}〜${f(w?.to) ?? "現在"}`;
}

function SummaryText({ text }: { text: string }) {
  const items = useMemo(() => parseSummary(text), [text]);
  const points = items.filter((i) => i.kind === "point");
  return (
    <div className="space-y-2 text-body-md text-ink">
      {points.length ? (
        <ol className="ml-5 list-decimal space-y-2 marker:text-ink-muted">
          {points.map((p, i) => (
            <li key={i}>
              <div className="text-title-sm text-ink-strong">{p.head}</div>
              {p.body.map((b, j) => (
                <div key={j} className="text-ink">
                  {b}
                </div>
              ))}
            </li>
          ))}
        </ol>
      ) : null}
      {items
        .filter((i) => i.kind === "para")
        .map((p, i) => (
          <p key={i} className="text-ink">
            {p.head}
          </p>
        ))}
    </div>
  );
}

function PositionBar({ pos }: { pos: SubTopicPosition }) {
  const right = pos.side ? pos.side === "pro" : pos.percentile >= pos.cut;
  const share = Math.max(1, Math.round((right ? 1 - pos.percentile : pos.percentile) * 100));
  const caption =
    pos.side === "neutral"
      ? "中立付近"
      : pos.side
        ? `${right ? "賛成寄り" : "反対寄り"}（${right ? "賛成" : "反対"}側の端から${share}%）`
        : `${right ? "賛成側" : "反対側"}の上位${share}%`;
  const left = `${(pos.percentile * 100).toFixed(1)}%`;
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-caption text-ink" title={pos.label}>
          {pos.label}
        </div>
        <span className="shrink-0 text-data text-ink-muted">{caption}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-caption text-ink-muted" title={`反対側の基準文：${pos.con}`}>
          反対側
        </span>
        <div
          className="relative h-3.5 min-w-0 flex-1 rounded-full bg-surface-raised ring-1 ring-line"
          role="img"
          aria-label={`${pos.label}：${caption}（${pos.n.toLocaleString()}人中）`}
        >
          {pos.band && pos.band[1] > pos.band[0] && (
            <div
              className="absolute inset-y-0.5 bg-surface-hover"
              style={{ left: `${(pos.band[0] * 100).toFixed(1)}%`, width: `${((pos.band[1] - pos.band[0]) * 100).toFixed(1)}%` }}
              title="中立帯（賛否が混在する範囲）"
            />
          )}
          <div
            className="absolute inset-y-0.5 w-px bg-line-strong"
            style={{ left: `${(pos.cut * 100).toFixed(1)}%` }}
            title={pos.side ? "賛否の分かれ目（発言の要約から推定）" : "中央値"}
          />
          <div
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface"
            style={{ left }}
          />
        </div>
        <span className="shrink-0 text-caption text-ink-muted" title={`賛成側の基準文：${pos.pro}`}>
          賛成側
        </span>
      </div>
    </div>
  );
}

function StanceCard({
  topic,
  positions,
  open,
  onToggle,
  onShowSpeeches,
  cardRef,
}: {
  topic: PersonStanceTopic;
  positions: SubTopicPosition[];
  open: boolean;
  onToggle: () => void;
  onShowSpeeches: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const [run, setRun] = useState(0);
  const runs = topic.summaries ?? [];
  const thin = topic.n_opinions != null && topic.n_opinions < THIN_EVIDENCE_OPINIONS;
  return (
    // Panel does not forward a ref, so the scroll target is a plain wrapper.
    <div ref={cardRef} className="scroll-mt-1">
    <Panel className="p-0">
      <Heading level={3} size="title-sm">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 rounded-xl p-3 text-left transition-colors duration-150 hover:bg-surface-raised"
        >
          <span className="block min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span>{topic.topic_jp}</span>
              <span className="text-caption text-ink-muted">{formatWindow(topic.window)}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-muted">
              <span>
                発言{topic.n_speeches?.toLocaleString() ?? "—"}件・意見文{topic.n_opinions?.toLocaleString() ?? "—"}件
              </span>
              {thin ? (
                <Badge tone="warning" title={`意見文が${THIN_EVIDENCE_OPINIONS}件未満のため、要約と位置の信頼性は低めです`}>
                  根拠が少ない
                </Badge>
              ) : null}
            </span>
          </span>
          <IoChevronForward
            aria-hidden
            className={"size-4 shrink-0 text-ink-muted transition-transform duration-200 motion-reduce:transition-none " + (open ? "rotate-90" : "")}
          />
        </button>
      </Heading>

      {open ? (
        <div className="space-y-3 px-3 pb-3">
          {runs.length ? <SummaryText text={runs[Math.min(run, runs.length - 1)]} /> : null}

          {runs.length > 1 ? (
            <div className="flex items-center gap-2 text-caption text-ink-muted">
              <span>別の要約を見る</span>
              <SegmentedControl
                label="要約の実行回"
                value={String(run)}
                onChange={(v) => setRun(Number(v))}
                items={runs.map((_, i) => ({ value: String(i), label: <span className="tabular-nums">{i + 1}</span> }))}
              />
            </div>
          ) : null}

          {positions.length ? (
            <div className="space-y-2 border-t border-line-subtle pt-3">
              <h4 className="text-label-md text-ink">論点ごとの位置</h4>
              {positions.map((p) => (
                <PositionBar key={p.subTopic} pos={p} />
              ))}
              <p className="text-caption text-ink-muted">
                要約はトピック全体、位置は論点ごとの推定です。位置は推定された議員の中での順位（中央の線が中央値）です。
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle pt-3">
            {topic.speech_ids?.length ? (
              <Button size="sm" onClick={onShowSpeeches}>
                元になった発言を見る
              </Button>
            ) : (
              <span />
            )}
            <span className="text-caption text-ink-muted">
              要約：{modelDisplayName(topic.model)}
              {topic.summarised_at ? `・${yearMonth(topic.summarised_at)}` : ""}
            </span>
          </div>
        </div>
      ) : null}
    </Panel>
    </div>
  );
}

export function PersonStancePanel({
  personId,
  stances,
  loading,
  error,
  ideologyData,
  focus,
  onShowSpeeches,
  onOpenMethodology,
}: PersonStancePanelProps) {
  const positions = useMemo(() => personPositions(ideologyData, Number(personId)), [ideologyData, personId]);

  // Stale-file guard: a topic shows only when the loaded ideology file plots this person on it.
  const topics = useMemo(
    () => (stances?.topics ?? []).filter((t) => positions.has(t.topic) && (t.summaries?.length ?? 0) > 0),
    [stances, positions]
  );

  // Open state: the first card and the card the scatter plot asked for are open unless the reader toggled
  // them. The parent keys this component by person, so toggles reset per person.
  const [toggled, setToggled] = useState<Map<string, boolean>>(() => new Map());
  const focusTopic = focus?.topic ?? null;
  const isOpen = (slug: string) => toggled.get(slug) ?? (slug === topics[0]?.topic || slug === focusTopic);
  const toggle = (slug: string) => setToggled((prev) => new Map(prev).set(slug, !isOpen(slug)));

  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollRef = useRef<HTMLDivElement>(null);

  // opened from the scatter plot: bring that topic's card to the top of the panel once it is rendered
  useEffect(() => {
    if (!focusTopic || !topics.some((t) => t.topic === focusTopic)) return;
    const id = requestAnimationFrame(() => {
      const el = cardRefs.current.get(focusTopic);
      const box = scrollRef.current;
      if (el && box) box.scrollTop = el.offsetTop - box.offsetTop;
    });
    return () => cancelAnimationFrame(id);
  }, [focusTopic, focus?.nonce, topics]);

  return (
    <div ref={scrollRef} className="relative flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1 pb-3">
      <div className="rounded-xl bg-info-soft p-3 text-body-sm text-on-info-soft">
        国会での発言から抽出した意見文をAIが論点ごとに要約したものです。氏名は除いて要約しており、
        言い回しが実際の発言と異なることがあります。
        {onOpenMethodology ? (
          <Button variant="ghost" size="sm" onClick={onOpenMethodology} className="ml-1 align-middle">
            手法と限界
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState message="立場の要約を読み込めませんでした。時間をおいて開き直してください。" />
      ) : loading || !stances ? (
        <Loading rows={3} label="立場の要約を読み込み中…" />
      ) : topics.length === 0 ? (
        <Empty message="この議員の立場の推定はまだありません。対象トピックでの発言が少ないためです。" />
      ) : (
        topics.map((t) => (
          <StanceCard
            key={`${personId}:${t.topic}`}
            topic={t}
            positions={positions.get(t.topic) ?? []}
            open={isOpen(t.topic)}
            onToggle={() => toggle(t.topic)}
            onShowSpeeches={() => onShowSpeeches(t)}
            cardRef={(el) => {
              if (el) cardRefs.current.set(t.topic, el);
              else cardRefs.current.delete(t.topic);
            }}
          />
        ))
      )}
    </div>
  );
}
