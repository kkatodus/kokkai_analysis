"use client";

/** §5.4 — replica of the やり取りの評価 ranking card: bars grow, the sort metric switches, the min-count filter drops rows. */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { metricByKey } from "@/app/lib/quality";
import { Cursor, type CursorTarget } from "../Cursor";
import { useIdleTick, useTimeline, type Playback, type StageFrame } from "../useStagePlayback";
import { RANKING_BASELINE, RANKING_ROWS, partyColor } from "../sampleData";

const TIMES = [1.6, 2.2, 3.4];
export const RANKING_DURATION_MS = 4200;

type Metric = "substantive" | "softball";
const METRIC_KEY: Record<Metric, string> = { substantive: "contribution_substantive", softball: "issue_softball" };
const OPTION_KEYS = ["contribution_substantive", "issue_softball", "a_issue_evasive", "a_outcome_new_information"];
const BAR: Record<Metric, string> = { substantive: "bg-emerald-500/80", softball: "bg-amber-500/80" };

export function RankingStage({ pb, frame }: { pb: Playback; frame: StageFrame }) {
  const step = useTimeline(TIMES, pb);
  const selectOpen = step === 1;
  const [flip, setFlip] = useState(false);
  useIdleTick(pb, 6000, () => setFlip((f) => !f));
  const metric: Metric = (step >= 2) !== flip ? "softball" : "substantive";
  const minCount = step >= 3 ? 50 : 20;
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);

  const rows = RANKING_ROWS.filter((r) => r.n >= minCount).sort((a, b) => b[metric] - a[metric]);
  const baseline = RANKING_BASELINE[metric];
  const label = metricByKey(METRIC_KEY[metric]).label;
  const cursor: CursorTarget | null = step === 1 ? { id: "sort-select" } : step === 2 ? { id: "sort-option-issue_softball" } : step >= 3 ? { id: "min-plus" } : null;
  const clicks = step >= 3 ? 3 : step >= 2 ? 2 : step >= 1 ? 1 : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-5">
      <motion.div initial={from({ opacity: 0, y: 10 })} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative flex h-full w-full max-w-md flex-col rounded-2xl border border-white/5 bg-[#020617]/85 p-3.5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              やり取りの評価（AI判定）
            </div>
            <div className="text-xs text-gray-400">議員ごとの集計・質問者として</div>
          </div>
        </div>

        <div className="relative z-20 flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
          <span>並び替え</span>
          <div data-cursor="sort-select" className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] text-gray-100 ${selectOpen ? "border-cyan-400/50" : "border-slate-400/25"} bg-slate-950/60`}>
            {label}
            <span className="text-gray-500">▾</span>
            <AnimatePresence>
              {selectOpen && (
                <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute left-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-slate-400/25 bg-[#0b1220] shadow-xl">
                  {OPTION_KEYS.map((k) => (
                    <li key={k} data-cursor={`sort-option-${k}`} className={`px-2 py-1.5 ${k === METRIC_KEY.softball ? "bg-slate-900/65 text-gray-100" : "text-gray-300"}`}>
                      {metricByKey(k).label}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <span className="ml-auto">最低やり取り数</span>
          <div className="flex items-center gap-1 rounded-lg border border-slate-400/25 bg-slate-950/60 px-1 py-0.5 text-[11px] text-gray-100">
            <span className="px-1 text-gray-500">−</span>
            <motion.span key={minCount} initial={from({ y: -4, opacity: 0 })} animate={{ y: 0, opacity: 1 }} className="w-5 text-center">
              {minCount}
            </motion.span>
            <span data-cursor="min-plus" className="px-1 text-gray-500">+</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-gray-400">
          <span>{metric === "substantive" ? "質問者側の成果" : "質問者側の問題点"}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-px bg-white/80" />
            全体 {(baseline * 100).toFixed(1)}%
          </span>
        </div>

        <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.div
                key={r.name}
                layout
                initial={from({ opacity: 0 })}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0, marginTop: -6 }}
                transition={{ layout: { type: "spring", stiffness: 220, damping: 26 }, opacity: { delay: pb.playing && step === 0 ? i * 0.06 : 0 } }}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: partyColor(r.party) }} />
                <span className="w-16 shrink-0 truncate text-gray-200">{r.name}</span>
                <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
                  <motion.div
                    className={`h-full rounded-full ${BAR[metric]}`}
                    initial={from({ width: 0 })}
                    animate={{ width: `${r[metric] * 100}%` }}
                    transition={{ duration: 0.6, delay: pb.playing && step === 0 ? i * 0.06 : 0, ease: "easeOut" }}
                  />
                  <motion.div className="absolute top-0 h-full w-px bg-white/80" initial={false} animate={{ left: `${baseline * 100}%` }} transition={{ duration: 0.5 }} />
                </div>
                <span className="w-9 shrink-0 text-right tabular-nums text-gray-300">{(r[metric] * 100).toFixed(0)}%</span>
                <span className="w-7 shrink-0 text-right text-[10px] text-gray-500">{r.n}件</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      <Cursor container={frame} target={cursor} click={clicks} hidden={pb.reduced || !pb.playing} />
    </div>
  );
}
