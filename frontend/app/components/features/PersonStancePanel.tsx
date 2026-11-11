"use client";

/**
 * The detail pane's 立場 tab (specs/stance-summaries-panel §6.2–6.3): one card per topic with the AI stance
 * summary (three runs), the person's percentile on each sub-topic axis, the evidence counts and a link back
 * to the speeches the summary was built from.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { IdeologyData, PersonStances, PersonStanceTopic } from "@/app/types";
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

function formatWindow(w: PersonStanceTopic["window"]): string {
  const f = (d: string | null) => (d ? d.replace(/-/g, "/") : null);
  return `${f(w?.from) ?? "—"}〜${f(w?.to) ?? "現在"}`;
}

function SummaryText({ text }: { text: string }) {
  const items = useMemo(() => parseSummary(text), [text]);
  const points = items.filter((i) => i.kind === "point");
  return (
    <div className="space-y-1.5 text-[12px] leading-relaxed text-gray-200">
      {points.length ? (
        <ol className="ml-4 list-decimal space-y-1.5 marker:text-gray-500">
          {points.map((p, i) => (
            <li key={i}>
              <div className="font-semibold text-gray-100">{p.head}</div>
              {p.body.map((b, j) => (
                <div key={j} className="text-gray-300">
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
          <p key={i} className="text-gray-300">
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
        ? `${right ? "賛成寄り" : "反対寄り"}（${right ? "賛成" : "反対"}側の端から ${share} %）`
        : `${right ? "賛成側" : "反対側"}の上位 ${share} %`;
  const left = `${(pos.percentile * 100).toFixed(1)}%`;
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0 truncate text-[11px] text-gray-300" title={pos.label}>
          {pos.label}
        </div>
        <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{caption}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[10px] text-rose-300/80" title={`反対側の基準文：${pos.con}`}>
          反対側
        </span>
        <div
          className="relative h-3.5 min-w-0 flex-1 rounded-full bg-slate-900/70 ring-1 ring-slate-400/15"
          role="img"
          aria-label={`${pos.label}：${caption}（${pos.n.toLocaleString()} 人中）`}
        >
          {pos.band && pos.band[1] > pos.band[0] && (
            <div
              className="absolute inset-y-0.5 bg-white/15"
              style={{ left: `${(pos.band[0] * 100).toFixed(1)}%`, width: `${((pos.band[1] - pos.band[0]) * 100).toFixed(1)}%` }}
              title="中立帯（賛否が混在する範囲）"
            />
          )}
          <div
            className="absolute inset-y-0.5 w-px bg-white/50"
            style={{ left: `${(pos.cut * 100).toFixed(1)}%` }}
            title={pos.side ? "賛否の分かれ目（発言の要約から推定）" : "中央値"}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow ring-2 ring-[#020617]"
            style={{ left }}
          />
        </div>
        <span className="shrink-0 text-[10px] text-sky-300/80" title={`賛成側の基準文：${pos.pro}`}>
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
    <div ref={cardRef} className="scroll-mt-1 rounded-xl border border-slate-400/15 bg-slate-950/30">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5"
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-gray-50">{topic.topic_jp}</span>
            <span className="text-[10px] text-gray-500">{formatWindow(topic.window)}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
            <span>
              発言 {topic.n_speeches?.toLocaleString() ?? "—"}件 ・ 意見文 {topic.n_opinions?.toLocaleString() ?? "—"}件
            </span>
            {thin ? (
              <span
                className="rounded-full border border-amber-400/40 bg-amber-500/15 px-1.5 py-px font-semibold text-amber-200"
                title={`意見文が ${THIN_EVIDENCE_OPINIONS} 件未満のため、要約と位置の信頼性は低めです`}
              >
                根拠が少ない
              </span>
            ) : null}
          </div>
        </div>
        <span className={"shrink-0 text-xs text-gray-400 transition-transform " + (open ? "rotate-90" : "")}>›</span>
      </button>

      {open ? (
        <div className="space-y-2.5 px-2.5 pb-2.5">
          {runs.length ? <SummaryText text={runs[Math.min(run, runs.length - 1)]} /> : null}

          {runs.length > 1 ? (
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span>別の要約を見る</span>
              <div className="flex rounded-full border border-slate-400/20 bg-slate-950/40 p-0.5" role="group" aria-label="要約の実行回">
                {runs.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={run === i}
                    onClick={() => setRun(i)}
                    className={
                      "min-w-6 rounded-full px-1.5 py-0.5 font-semibold tabular-nums transition-colors " +
                      (run === i ? "bg-cyan-500/20 text-cyan-100" : "text-gray-400 hover:bg-slate-900/60")
                    }
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {positions.length ? (
            <div className="space-y-1.5 border-t border-slate-400/10 pt-2">
              <div className="text-[10px] font-semibold tracking-wide text-gray-400">論点ごとの位置</div>
              {positions.map((p) => (
                <PositionBar key={p.subTopic} pos={p} />
              ))}
              <div className="text-[10px] text-gray-500">
                要約はトピック全体、位置は論点ごとの推定です。位置は推定された議員の中での順位（中央の線が中央値）です。
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-400/10 pt-2 text-[10px]">
            {topic.speech_ids?.length ? (
              <button
                type="button"
                onClick={onShowSpeeches}
                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
              >
                元になった発言を見る →
              </button>
            ) : (
              <span />
            )}
            <span className="text-gray-500">
              要約: {modelDisplayName(topic.model)}
              {topic.summarised_at ? ` · ${yearMonth(topic.summarised_at)}` : ""}
            </span>
          </div>
        </div>
      ) : null}
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
    <div ref={scrollRef} className="relative flex h-full min-h-0 flex-col gap-2 overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-400/15 bg-slate-900/40 p-2 text-[11px] leading-relaxed text-gray-300">
        国会での発言から抽出した意見文を AI が論点ごとに要約したものです。氏名は除いて要約しており、
        言い回しが実際の発言と異なることがあります。
        {onOpenMethodology ? (
          <button type="button" onClick={onOpenMethodology} className="ml-1 font-semibold text-cyan-300 hover:underline">
            手法と限界 →
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-2 text-[11px] text-rose-200">
          立場の要約を読み込めませんでした：{error}
        </div>
      ) : loading || !stances ? (
        <div className="p-2 text-[11px] text-gray-400">読み込み中…</div>
      ) : topics.length === 0 ? (
        <div className="p-2 text-[11px] text-gray-400">
          この議員の立場の推定はまだありません（対象トピックでの発言が少ないため）
        </div>
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
