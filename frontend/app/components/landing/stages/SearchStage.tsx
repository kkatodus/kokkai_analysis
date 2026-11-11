"use client";

/** §5.1 — replica of the 歴代議員検索 card: types 「こっか」, opens the dropdown, picks 国会 太郎. */

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Cursor, type CursorTarget } from "../Cursor";
import { useIdleTick, useTimeline, type Playback, type StageFrame } from "../useStagePlayback";
import { SEARCH_QUERY, SEARCH_ROWS, TARO, partyColor } from "../sampleData";

const TIMES = [0.6, 0.72, 0.84, 1.2, 2.0, 2.4];
export const SEARCH_DURATION_MS = 3600;

export function SearchStage({ pb, frame }: { pb: Playback; frame: StageFrame }) {
  const step = useTimeline(TIMES, pb);
  const typed = SEARCH_QUERY.slice(0, Math.min(SEARCH_QUERY.length, step));
  const dropdown = step >= 4 && step < 6;
  const hover = step >= 5;
  const picked = step >= 6;
  const [pulse, setPulse] = useState(0);
  useIdleTick(pb, 6000, () => setPulse((p) => p + 1));
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);

  const cursor: CursorTarget | null = hover ? { id: "search-row-0", ax: 0.25 } : null;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={from({ opacity: 0, y: 12 })}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm rounded-2xl border border-line-subtle bg-surface p-3.5"
      >
        <div className="mb-2">
          <div className="flex items-center gap-1.5 text-title-sm text-ink-strong">
            <span className="size-1.5 rounded-full bg-primary" />
            歴代議員検索
          </div>
          <div className="text-caption text-ink-muted">名前で探す（現職・元職）</div>
        </div>

        <motion.div
          key={`input-${pulse}`}
          animate={pulse > 0 ? { boxShadow: ["0 0 0 0 rgba(34,211,238,0)", "0 0 0 4px rgba(34,211,238,0.18)", "0 0 0 0 rgba(34,211,238,0)"] } : undefined}
          transition={{ duration: 1.2 }}
          className="flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface-control px-3 text-body-md"
        >
          {picked ? (
            <motion.span
              initial={from({ scale: 0.8, opacity: 0 })}
              animate={{ scale: 1, opacity: 1 }}
              className="flex items-center gap-1.5 rounded-full border border-primary-line bg-primary-soft px-2 py-0.5 text-label-sm text-on-primary-soft"
            >
              <span className="size-2 rounded-full" style={{ background: partyColor(TARO.party) }} />
              {TARO.name}
              <span className="text-link">×</span>
            </motion.span>
          ) : typed ? (
            <span className="text-ink-strong">{typed}</span>
          ) : (
            <span className="text-ink-muted">議員名（漢字・かな）</span>
          )}
          {!picked && step >= 1 && <span className="h-4 w-px animate-pulse bg-primary" />}
        </motion.div>

        <AnimatePresence>
          {dropdown && (
            <motion.ul
              initial={from({ opacity: 0, y: -6, scaleY: 0.9 })}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22 }}
              style={{ transformOrigin: "top" }}
              className="mt-1.5 overflow-hidden rounded-lg border border-line bg-surface-control"
            >
              {SEARCH_ROWS.map((m, i) => (
                <li
                  key={m.name}
                  data-cursor={`search-row-${i}`}
                  className={`flex items-center gap-2 px-3 py-2 text-caption transition-colors ${hover && i === 0 ? "bg-surface-hover" : ""}`}
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ background: partyColor(m.party) }} />
                  <span className="text-ink-strong">{m.name}</span>
                  <span className="text-ink-muted">／ {m.party}</span>
                  <span className="ml-auto text-caption text-ink-muted">{m.house}</span>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        {picked && (
          <motion.div initial={from({ opacity: 0 })} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 text-caption text-ink-muted">
            クリックで詳細パネルが開きます →
          </motion.div>
        )}
      </motion.div>

      {/* sliver of the detail pane sliding in from the right (hand-off to §5.2) */}
      <AnimatePresence>
        {picked && (
          <motion.div
            initial={from({ x: "100%" })}
            animate={{ x: "58%" }}
            transition={{ type: "spring", stiffness: 140, damping: 20 }}
            className="absolute bottom-6 right-0 top-6 w-40 rounded-l-2xl border border-line-strong bg-surface p-3 shadow-2xl"
          >
            <div className="text-title-sm text-ink-strong">{TARO.name}</div>
            <div className="text-caption text-ink-muted">{TARO.party}・{TARO.house}</div>
            <div className="mt-2 h-1.5 w-20 rounded-full bg-surface-hover" />
            <div className="mt-1.5 h-1.5 w-14 rounded-full bg-surface-hover" />
          </motion.div>
        )}
      </AnimatePresence>

      <Cursor container={frame} target={cursor} click={picked ? 1 : 0} hidden={pb.reduced || !pb.playing} />
    </div>
  );
}
