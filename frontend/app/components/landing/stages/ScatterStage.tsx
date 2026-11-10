"use client";

/** §5.5 — replica of the ideology scatter: 1D band → 2D clusters, 現職のみ filter, hover tooltip. */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Cursor, type CursorTarget } from "../Cursor";
import { useIdleTick, useTimeline, type Playback, type StageFrame } from "../useStagePlayback";
import { SCATTER_HOVER_ID, SCATTER_POINTS, TARO, partyColor } from "../sampleData";

const TIMES = [0.6, 1.6, 2.8, 3.4];
export const SCATTER_DURATION_MS = 4200;
const W = 400;
const H = 250;
const PAD = 18;

const f = (v: number) => Math.round(v * 100) / 100;
function pos(p: (typeof SCATTER_POINTS)[number], twoD: boolean) {
  return twoD
    ? { cx: f(PAD + p.x2 * (W - 2 * PAD)), cy: f(PAD + p.y2 * (H - 2 * PAD)) }
    : { cx: f(PAD + p.x1 * (W - 2 * PAD)), cy: f(H / 2 - 28 + p.y2 * 56) };
}

export function ScatterStage({ pb, frame }: { pb: Playback; frame: StageFrame }) {
  const step = useTimeline(TIMES, pb);
  const [flip, setFlip] = useState(false);
  useIdleTick(pb, 8000, () => setFlip((f) => !f));
  const shown = step >= 1;
  const twoD = (step >= 2) !== flip;
  const onlyIncumbent = step >= 3;
  const hover = step >= 4;
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);
  const hovered = SCATTER_POINTS[SCATTER_HOVER_ID];
  const hp = pos(hovered, twoD);
  const cursor: CursorTarget | null = step === 2 ? { id: "toggle-2d" } : step === 3 ? { id: "incumbent-check" } : step >= 4 ? { id: "scatter-svg", ax: hp.cx / W, ay: hp.cy / H } : null;
  const clicks = step >= 3 ? 2 : step >= 2 ? 1 : 0;

  return (
    <div className="absolute inset-0 flex flex-col p-3 sm:p-5">
      <motion.div initial={from({ opacity: 0, y: 10 })} animate={{ opacity: 1, y: 0 }} className="flex h-full w-full flex-col rounded-2xl border border-white/5 bg-[#020617]/85 p-3.5">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-200">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          発言から推定した立場
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400">
          <span className="rounded-lg border border-slate-400/25 bg-slate-950/60 px-2 py-1 text-[11px] text-gray-100">トピック：原発 ▾</span>
          <span className="rounded-lg border border-slate-400/25 bg-slate-950/60 px-2 py-1 text-[11px] text-gray-100">論点：原発の再稼働 ▾</span>
          <span className="ml-auto flex items-center rounded-full border border-slate-400/20 bg-slate-950/30 p-0.5 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 ${!twoD ? "bg-cyan-500/15 text-cyan-100" : "text-gray-400"}`}>1D</span>
            <span data-cursor="toggle-2d" className={`rounded-full px-2 py-0.5 ${twoD ? "bg-cyan-500/15 text-cyan-100" : "text-gray-400"}`}>2D</span>
          </span>
          <label data-cursor="incumbent-check" className="flex items-center gap-1 text-[11px] text-gray-300">
            <span className={`flex h-3 w-3 items-center justify-center rounded border ${onlyIncumbent ? "border-cyan-400/60 bg-cyan-500/30 text-cyan-100" : "border-slate-400/40"}`}>{onlyIncumbent ? "✓" : ""}</span>
            現職のみ
          </label>
        </div>

        <div className="relative mt-2 min-h-0 flex-1">
          <svg data-cursor="scatter-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            <rect x={0} y={0} width={W} height={H} rx={12} fill="rgba(2,6,23,0.5)" stroke="rgba(148,163,184,0.12)" />
            <AnimatePresence>
              {!twoD && (
                <motion.line key="axis" x1={PAD} x2={W - PAD} y1={H / 2} y2={H / 2} stroke="rgba(148,163,184,0.25)" strokeDasharray="3 4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
              )}
            </AnimatePresence>
            <g className={pb.idle && !pb.reduced ? "landing-breathe" : undefined}>
              {shown &&
                SCATTER_POINTS.map((p, i) => {
                  const { cx, cy } = pos(p, twoD);
                  const dim = onlyIncumbent && !p.incumbent;
                  return (
                    <motion.circle
                      key={p.id}
                      initial={from({ r: 0, cx, cy, opacity: 0 })}
                      animate={{ r: 4, cx, cy, opacity: dim ? 0.15 : 0.9 }}
                      transition={{ cx: { type: "spring", stiffness: 80, damping: 16 }, cy: { type: "spring", stiffness: 80, damping: 16 }, r: { delay: i * 0.01 }, opacity: { duration: 0.4 } }}
                      fill={partyColor(p.party)}
                    />
                  );
                })}
              {hover && (
                <motion.circle initial={from({ r: 0, opacity: 0 })} animate={{ r: 9, opacity: 1 }} cx={hp.cx} cy={hp.cy} fill="none" stroke="rgba(34,211,238,0.9)" strokeWidth={1.5} />
              )}
            </g>
          </svg>
          <AnimatePresence>
            {!twoD && (
              <motion.div key="labels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-3 bottom-2 flex justify-between text-[10px] text-gray-400">
                <span>反対（左）</span>
                <span>賛成（右）</span>
              </motion.div>
            )}
          </AnimatePresence>
          {hover && (
            <motion.div
              initial={from({ opacity: 0, y: 4 })}
              animate={{ opacity: 1, y: 0 }}
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-400/25 bg-[#0b1220] px-2 py-1 text-[10px] text-gray-100 shadow-xl"
              style={{ left: `${(hp.cx / W) * 100}%`, top: `calc(${(hp.cy / H) * 100}% - 34px)` }}
            >
              {TARO.name} ／ {TARO.party}
            </motion.div>
          )}
        </div>
      </motion.div>
      <Cursor container={frame} target={cursor} click={clicks} hidden={pb.reduced || !pb.playing} />
    </div>
  );
}
