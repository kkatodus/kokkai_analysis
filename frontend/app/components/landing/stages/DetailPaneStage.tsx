"use client";

/** §5.2 — replica of the detail pane: quality summary, tabs, topic chips, two labelled speech cards. */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ContributionChip, FunctionChip, IssueChip, OutcomeChip } from "@/app/components/features/QualityChips";
import { CONTRIBUTION_SHORT_JA, CONTRIBUTION_STYLE, pct } from "@/app/lib/quality";
import { Cursor, type CursorTarget } from "../Cursor";
import { useIdleTick, useTimeline, type Playback, type StageFrame } from "../useStagePlayback";
import { ACTIVE_TOPIC, QUALITY_SUMMARY, SPEECH_PAGES, TARO, TOPIC_CHIPS } from "../sampleData";

const TIMES = [0.8, 1.2, 1.5, 1.8, 2.0, 2.6, 3.1, 3.4];
export const DETAIL_DURATION_MS = 4200;

export function DetailPaneStage({ pb, frame }: { pb: Playback; frame: StageFrame }) {
  const step = useTimeline(TIMES, pb);
  const [page, setPage] = useState(0);
  useIdleTick(pb, 5000, () => setPage((p) => (p + 1) % SPEECH_PAGES.length));
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);

  const tabs = step >= 1;
  const chips = step >= 2;
  const cursorOnChip = step >= 3;
  const topicPicked = step >= 4;
  const cards = step >= 5;
  const chips1 = step >= 6;
  const chips2 = step >= 7;
  const glow = step >= 8;

  const q = QUALITY_SUMMARY;
  const shares = {
    substantive: q.substantive / q.n,
    limited: q.limited / q.n,
    none: q.none / q.n,
  };
  const cursor: CursorTarget | null = cursorOnChip ? { id: "topic-経済対策" } : null;
  const speeches = SPEECH_PAGES[page];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        initial={from({ x: "100%", opacity: 0.6 })}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 22 }}
        className="absolute bottom-3 right-3 top-3 w-[360px] max-w-[calc(100%-24px)]"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-400/35 bg-[#020617] p-3.5 shadow-2xl">
          <div className="mb-1 flex items-center justify-end">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/90 text-xs text-gray-400">×</span>
          </div>
          <div className="text-base font-semibold text-gray-50">{TARO.name}</div>
          <div className="text-[11px] text-gray-400">
            {TARO.party}・{TARO.house}
          </div>

          <div className="mt-2 rounded-xl border border-slate-400/15 bg-slate-950/20 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-gray-200">やり取りの評価（AI判定）</div>
              <div className="text-[11px] text-gray-400">質問 {q.n} 件</div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
              <div className="flex h-full w-full">
                <motion.div className={`h-full ${CONTRIBUTION_STYLE.substantive.bar}`} initial={from({ width: 0 })} animate={{ width: `${shares.substantive * 100}%` }} transition={{ duration: 0.6, delay: 0.3 }} />
                <motion.div className={`h-full ${CONTRIBUTION_STYLE.limited.bar}`} initial={from({ width: 0 })} animate={{ width: `${shares.limited * 100}%` }} transition={{ duration: 0.6, delay: 0.3 }} />
                <motion.div className={`h-full ${CONTRIBUTION_STYLE.none.bar}`} initial={from({ width: 0 })} animate={{ width: `${shares.none * 100}%` }} transition={{ duration: 0.6, delay: 0.3 }} />
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
              {(["substantive", "limited", "none"] as const).map((c) => (
                <div key={c} className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${CONTRIBUTION_STYLE[c].dot}`} />
                  {CONTRIBUTION_SHORT_JA[c]} {pct(shares[c])}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-2 h-7">
            {tabs && (
              <motion.div initial={from({ opacity: 0, y: 4 })} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 rounded-full border border-slate-400/20 bg-slate-950/30 p-0.5 text-[11px]">
                {["発言", "やり取り", "選挙履歴"].map((t, i) => (
                  <span key={t} className={`flex-1 rounded-full px-2 py-0.5 text-center ${i === 0 ? "bg-cyan-500/15 text-cyan-100" : "text-gray-400"}`}>
                    {t}
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          <div className="mt-2 flex min-h-7 flex-wrap gap-1">
            {chips &&
              TOPIC_CHIPS.map((t, i) => {
                const active = topicPicked ? t === ACTIVE_TOPIC : t === "全発言";
                return (
                  <motion.span
                    key={t}
                    data-cursor={`topic-${t}`}
                    initial={from({ opacity: 0, scale: 0.9 })}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${active ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : "border-slate-400/25 text-gray-300"}`}
                  >
                    {t}
                  </motion.span>
                );
              })}
          </div>

          <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500">
            <span>{topicPicked ? `${ACTIVE_TOPIC}の発言` : "すべての発言"}</span>
            <span className="flex items-center gap-1.5">
              <span>‹</span>
              {page + 1}/{SPEECH_PAGES.length}
              <span>›</span>
            </span>
          </div>

          <div className="relative mt-1.5 min-h-0 flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {cards && (
                <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="flex flex-col gap-2">
                  {speeches.map((s, i) => (
                    <motion.div
                      key={s.date}
                      initial={from({ opacity: 0, y: 10 })}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.3 }}
                      className="rounded-xl border border-slate-400/15 bg-slate-950/30 p-2.5"
                    >
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span>{s.date}</span>
                        <span>{s.meeting}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-200">{s.excerpt}</p>
                      <div className="mt-1.5 flex min-h-5 flex-wrap gap-1">
                        {i === 0 && chips1 && (
                          <>
                            <Pop d={0}><FunctionChip value="policy" prefixed /></Pop>
                            <Pop d={0.15}><ContributionChip value="substantive" prefixed /></Pop>
                            <Pop d={0.3}><OutcomeChip value="new_information" prefixed /></Pop>
                          </>
                        )}
                        {i === 1 && chips2 && (
                          <>
                            <Pop d={0}><FunctionChip value="oversight" prefixed /></Pop>
                            <Pop d={0.15}><ContributionChip value="limited" prefixed /></Pop>
                            <Pop d={0.3}><IssueChip issue={{ type: "evasive", by: "answerer", extent: "most" }} prefixed /></Pop>
                          </>
                        )}
                      </div>
                      {i === 0 && (
                        <motion.div
                          animate={glow && pb.playing ? { boxShadow: ["0 0 0 0 rgba(34,211,238,0)", "0 0 0 5px rgba(34,211,238,0.35)", "0 0 0 0 rgba(34,211,238,0)"] } : undefined}
                          transition={{ duration: 1.1, repeat: 1 }}
                          className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${glow ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-slate-400/25 text-gray-300"}`}
                        >
                          会議を閲覧する
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <Cursor container={frame} target={cursor} click={topicPicked ? 1 : 0} hidden={pb.reduced || !pb.playing} />
    </div>
  );

  function Pop({ d, children }: { d: number; children: React.ReactNode }) {
    return (
      <motion.span initial={from({ opacity: 0, scale: 0.7 })} animate={{ opacity: 1, scale: 1 }} transition={{ delay: d, type: "spring", stiffness: 300, damping: 20 }}>
        {children}
      </motion.span>
    );
  }
}
