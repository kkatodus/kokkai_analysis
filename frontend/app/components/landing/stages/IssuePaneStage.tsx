"use client";

/** §5.3 — replica of the meeting pane: title, dial, speech list with contribution bands and 判定理由 notes. */

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiExternalLink } from "react-icons/fi";
import { CONTRIBUTION_STYLE } from "@/app/lib/quality";
import { useIdleTick, useTimeline, type Playback } from "../useStagePlayback";
import { ISSUE_GROUPS, ISSUE_TITLE } from "../sampleData";

const TIMES = [0.6, 1.2, 2.0, 3.4];
export const ISSUE_DURATION_MS = 4000;

const DIAL = 104;
const CX = DIAL / 2;
const R_OUTER = 46;
const R_KNOB = 38;
const END_ANGLE = 120;
const TICKS = 40;
const ROWS = ISSUE_GROUPS.flatMap((g) => g.rows);
const N_ROWS = ROWS.length;

export function IssuePaneStage({ pb }: { pb: Playback }) {
  const step = useTimeline(TIMES, pb);
  const ringDrawn = step >= 1;
  const listShown = step >= 2;
  const dragged = step >= 3;
  const linkLit = step >= 4;
  const from = (v: Record<string, number | string>) => (pb.playing ? v : false);

  const angle = useMotionValue(0);
  const kx = useTransform(angle, (a) => CX + R_KNOB * Math.sin((a * Math.PI) / 180));
  const ky = useTransform(angle, (a) => CX - R_KNOB * Math.cos((a * Math.PI) / 180));
  // how far the list can scroll: measured, so the focused last row is always in view whatever the stage size
  const maxScroll = useMotionValue(150);
  const listY = useTransform([angle, maxScroll], ([a, m]: number[]) => -(Math.max(0, Math.min(END_ANGLE, a)) / END_ANGLE) * m);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const list = listRef.current;
    if (!vp || !list) return;
    const measure = () => maxScroll.set(Math.max(0, list.scrollHeight - vp.clientHeight + 8));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    ro.observe(list);
    return () => ro.disconnect();
  }, [listShown, maxScroll]);
  const [focus, setFocus] = useState(0);
  useMotionValueEvent(angle, "change", (a) => setFocus(Math.max(0, Math.min(N_ROWS - 1, Math.round((a / END_ANGLE) * (N_ROWS - 1))))));

  useEffect(() => {
    if (!dragged) {
      angle.set(0);
      return;
    }
    const ctrl = animate(angle, END_ANGLE, { duration: pb.playing ? 1.2 : 0, ease: "easeInOut" });
    return () => ctrl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragged, pb.runId]);

  const dir = useRef(1);
  useIdleTick(pb, 4000, () => {
    dir.current = -dir.current;
    animate(angle, END_ANGLE + 10 * dir.current, { duration: 1.4, ease: "easeInOut" });
  });

  let rowIndex = -1;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        initial={from({ x: "-100%", opacity: 0.6 })}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 22 }}
        className="absolute bottom-3 left-3 top-3 w-[420px] max-w-[calc(100%-24px)]"
      >
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface p-3.5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-title-sm text-ink-strong">{ISSUE_TITLE}</div>
              <div className="text-caption text-ink-muted">発言 {N_ROWS} 件・やり取り {ISSUE_GROUPS.length} 件</div>
            </div>
            <span className="flex size-5 items-center justify-center rounded-full bg-surface-raised text-caption text-ink-muted">×</span>
          </div>

          <div className="mt-2 flex items-center gap-3">
            <div className="relative shrink-0" style={{ width: DIAL, height: DIAL }}>
              <svg width={DIAL} height={DIAL} className="block">
                <circle cx={CX} cy={CX} r={R_OUTER} fill="rgba(2,6,23,0.55)" stroke="rgba(148,163,184,0.12)" />
                <motion.circle
                  cx={CX}
                  cy={CX}
                  r={R_OUTER}
                  fill="none"
                  stroke="rgba(34,211,238,0.45)"
                  strokeWidth={1.5}
                  initial={from({ pathLength: 0 })}
                  animate={{ pathLength: ringDrawn ? 1 : 0 }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  style={{ rotate: -90, transformOrigin: "50% 50%" }}
                />
                {Array.from({ length: TICKS }, (_, i) => {
                  const a = (i / TICKS) * 2 * Math.PI;
                  const r1 = R_KNOB - 6;
                  const r2 = i % 5 === 0 ? R_KNOB - 1 : R_KNOB - 3;
                  // rounded so the SSR string and the client number serialise identically (no hydration warning)
                  const f = (v: number) => Math.round(v * 100) / 100;
                  return (
                    <line
                      key={i}
                      x1={f(CX + r1 * Math.sin(a))}
                      y1={f(CX - r1 * Math.cos(a))}
                      x2={f(CX + r2 * Math.sin(a))}
                      y2={f(CX - r2 * Math.cos(a))}
                      stroke="rgba(148,163,184,0.35)"
                      strokeWidth={1}
                    />
                  );
                })}
                <circle cx={CX} cy={CX} r={R_KNOB - 10} fill="rgba(2,6,23,0.9)" stroke="rgba(148,163,184,0.12)" />
                <motion.circle cx={kx} cy={ky} r={13} fill="rgba(34,211,238,0.12)" />
                <motion.circle cx={kx} cy={ky} r={8} fill="rgba(34,211,238,0.25)" />
                <motion.circle cx={kx} cy={ky} r={6} fill="rgba(34,211,238,0.95)" />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption text-ink-muted">
                {focus + 1}/{N_ROWS}
              </div>
            </div>
            <div className="text-caption leading-relaxed text-ink-muted">
              ドラッグで発言を選択
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" />成果あり</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-warning" />限定的</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-error" />成果なし</span>
              </div>
            </div>
          </div>

          <div ref={viewportRef} className="relative mt-2 min-h-0 flex-1 overflow-hidden">
            {listShown && (
              <motion.div ref={listRef} style={{ y: listY }} className="flex flex-col gap-1.5">
                {ISSUE_GROUPS.map((g, gi) => (
                  <div key={gi} className="flex flex-col gap-1.5">
                    <motion.div
                      initial={from({ opacity: 0, y: 6 })}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.18 }}
                      className={`rounded-lg border px-2 py-1 text-caption text-ink ${CONTRIBUTION_STYLE[g.contribution].note}`}
                    >
                      <span className="mr-1 font-semibold text-ink">判定理由</span>
                      {g.note}
                    </motion.div>
                    {g.rows.map((r) => {
                      rowIndex += 1;
                      const idx = rowIndex;
                      const focused = dragged && idx === focus;
                      return (
                        <motion.div
                          key={idx}
                          initial={from({ opacity: 0, y: 6 })}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: gi * 0.18 + 0.06 * idx }}
                          className={`relative rounded-lg border border-l-[3px] px-2 py-1.5 ${CONTRIBUTION_STYLE[g.contribution].item} ${focused ? "ring-1 ring-primary" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-label-sm text-ink-strong">{r.speaker}</span>
                            {focused && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className={`flex items-center gap-0.5 text-caption ${linkLit ? "text-link" : "text-ink-muted"}`}
                              >
                                原文を開く
                                <motion.span animate={linkLit && pb.playing ? { x: [0, 3, 0] } : undefined} transition={{ duration: 0.5, repeat: 2 }} className="inline-flex">
                                  <FiExternalLink className="h-2.5 w-2.5" />
                                </motion.span>
                              </motion.span>
                            )}
                          </div>
                          <div className="truncate text-caption text-ink">{r.excerpt}</div>
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-surface to-transparent" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
