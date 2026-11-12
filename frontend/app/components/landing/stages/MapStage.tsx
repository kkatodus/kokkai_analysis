"use client";

/** §5.6 — simplified Japan map with ten coloured districts, a district member list, election history, 比例 toggle. */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Cursor, type CursorTarget } from "../Cursor";
import { useIdleTick, useTimeline, type Playback, type StageFrame } from "../useStagePlayback";
import { DISTRICT_LABEL, DISTRICT_MEMBERS, ELECTION_HISTORY, MAP_DISTRICTS, MAP_FOCUS, PR_LABEL, PR_MEMBERS, partyColor } from "../sampleData";
import { JAPAN_PREFECTURES, JAPAN_VIEWBOX } from "./japanPrefectures";

const TIMES = [1.4, 1.8, 2.6, 3.6];
export const MAP_DURATION_MS = 4400;
const DISTRICT_IDS = Object.keys(MAP_DISTRICTS);

export function MapStage({ pb, frame }: { pb: Playback; frame: StageFrame }) {
  const step = useTimeline(TIMES, pb);
  const [idlePulse, setIdlePulse] = useState(0);
  useIdleTick(pb, 5000, () => setIdlePulse((i) => i + 1));
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);

  const pulsing = step >= 1;
  const listOpen = step >= 2;
  const historyOpen = step >= 3 && step < 4;
  const proportional = step >= 4;
  const pulseId = pb.idle ? DISTRICT_IDS[idlePulse % DISTRICT_IDS.length] : MAP_FOCUS;
  const cursor: CursorTarget | null = step === 1 ? { id: `pref-${MAP_FOCUS}` } : step === 2 ? { id: "member-0" } : step === 3 ? { id: "member-0" } : step >= 4 ? { id: "toggle-pr" } : null;
  const clicks = step >= 4 ? 3 : step >= 3 ? 2 : step >= 2 ? 1 : 0;
  const members = proportional ? PR_MEMBERS : DISTRICT_MEMBERS;

  return (
    <div className="absolute inset-0 overflow-hidden p-3 sm:p-4">
      <div className="absolute left-4 top-4 z-10 flex items-center rounded-full border border-line bg-surface-raised p-0.5 text-caption">
        <span className={`rounded-full px-2.5 py-0.5 ${!proportional ? "bg-primary-soft text-on-primary-soft" : "text-ink-muted"}`}>選挙区</span>
        <span data-cursor="toggle-pr" className={`rounded-full px-2.5 py-0.5 ${proportional ? "bg-primary-soft text-on-primary-soft" : "text-ink-muted"}`}>比例</span>
      </div>

      <svg viewBox={JAPAN_VIEWBOX} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <g transform="translate(0 8)">
          {JAPAN_PREFECTURES.map((p, i) => {
            const party = MAP_DISTRICTS[p.id];
            return (
              <motion.path
                key={p.id}
                data-cursor={`pref-${p.id}`}
                d={p.d}
                initial={from({ pathLength: 0, fillOpacity: 0 })}
                animate={{ pathLength: 1, fillOpacity: 1 }}
                transition={{ pathLength: { duration: 1.2, delay: (i % 8) * 0.03, ease: "easeInOut" }, fillOpacity: { duration: 0.6, delay: 1.2 } }}
                fill={party ? partyColor(party, 0.8) : "var(--color-surface-hover)"}
                stroke={party ? partyColor(party, 1) : "rgba(148,163,184,0.45)"}
                strokeWidth={party ? 1.2 : 0.8}
                strokeLinejoin="round"
              />
            );
          })}
          {pulsing && (
            <motion.path
              key={`pulse-${pulseId}-${idlePulse}`}
              d={JAPAN_PREFECTURES.find((p) => p.id === pulseId)?.d}
              fill="none"
              stroke="rgba(34,211,238,0.9)"
              strokeWidth={2}
              initial={{ opacity: 0.9, scale: 1 }}
              animate={{ opacity: [0.9, 0, 0.9, 0], strokeWidth: [2, 6, 2, 6] }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      </svg>

      <AnimatePresence>
        {listOpen && (
          <motion.div
            key="list"
            initial={from({ y: 40, opacity: 0 })}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22 }}
            className="absolute bottom-4 right-4 z-10 w-[58%] max-w-[240px] rounded-xl border border-line-strong bg-surface p-2.5 shadow-2xl"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={proportional ? "pr" : "district"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <div className="text-title-sm text-ink-strong">{proportional ? PR_LABEL : DISTRICT_LABEL}</div>
                <div className="text-caption text-ink-muted">{proportional ? "名簿から探す" : "この選挙区の議員"}</div>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {members.map((m, i) => (
                    <li key={m.name} data-cursor={`member-${i}`} className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-caption ${historyOpen && i === 0 ? "bg-surface-hover ring-1 ring-primary" : ""}`}>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: partyColor(m.party) }} />
                      <span className="text-ink-strong">{m.name}</span>
                      <span className="ml-auto text-caption text-ink-muted">{m.house === "衆議院" ? "衆" : "参"}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {historyOpen && (
                <motion.div key="history" initial={from({ opacity: 0, height: 0 })} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-2 border-t border-line-subtle pt-1.5 text-label-sm text-ink">選挙履歴</div>
                  <table className="mt-1 w-full text-caption text-ink">
                    <tbody>
                      {ELECTION_HISTORY.map((h) => (
                        <tr key={h.year}>
                          <td className="py-0.5 pr-1 tabular-nums text-ink-muted">{h.year}</td>
                          <td className="py-0.5 pr-1">{h.election}</td>
                          <td className="py-0.5 pr-1">{h.district}</td>
                          <td className={`py-0.5 text-right ${h.won ? "text-success" : "text-warning"}`}>{h.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Cursor container={frame} target={cursor} click={clicks} hidden={pb.reduced || !pb.playing} />
    </div>
  );
}
