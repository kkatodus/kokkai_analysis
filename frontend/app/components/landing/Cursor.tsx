"use client";

/**
 * Fake pointer shared by every stage (specs/landing-page §6): a 14 px ring that springs between
 * `[data-cursor="<id>"]` elements inside the stage; a click is a 0.8 → 1 scale dip plus an expanding ring.
 */

import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useLayoutEffect, useRef, type RefObject } from "react";

export interface CursorTarget {
  id: string;
  /** anchor inside the target, 0..1 (default centre) */
  ax?: number;
  ay?: number;
  /** pixel offset from the anchor */
  dx?: number;
  dy?: number;
}

export function Cursor({
  container,
  target,
  click = 0,
  hidden = false,
}: {
  container: RefObject<HTMLElement | null>;
  target: CursorTarget | null;
  /** increment to play a click at the current position */
  click?: number;
  hidden?: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(0);
  const placed = useRef(false);
  const id = target?.id ?? null;
  const ax = target?.ax ?? 0.5;
  const ay = target?.ay ?? 0.5;
  const dx = target?.dx ?? 0;
  const dy = target?.dy ?? 0;

  useLayoutEffect(() => {
    const root = container.current;
    if (!root || hidden) return;
    if (!id) {
      animate(opacity, 0, { duration: 0.2 });
      return;
    }
    const el = root.querySelector<HTMLElement>(`[data-cursor="${id}"]`);
    if (!el) return;
    const c = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const px = r.left - c.left + r.width * ax + dx;
    const py = r.top - c.top + r.height * ay + dy;
    const spring = { type: "spring" as const, stiffness: 160, damping: 22, mass: 0.7 };
    if (!placed.current) {
      placed.current = true;
      x.set(px);
      y.set(py + 24);
    }
    const ax1 = animate(x, px, spring);
    const ay1 = animate(y, py, spring);
    const ao = animate(opacity, 1, { duration: 0.25 });
    return () => {
      ax1.stop();
      ay1.stop();
      ao.stop();
    };
  }, [container, id, ax, ay, dx, dy, click, hidden, x, y, opacity]);

  if (hidden) return null;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-30"
      style={{ x, y, opacity }}
    >
      <motion.div
        key={click}
        className="-ml-[7px] -mt-[7px] h-3.5 w-3.5 rounded-full border border-white bg-cyan-400/25 shadow-[0_0_14px_rgba(34,211,238,0.55)]"
        animate={click > 0 ? { scale: [1, 0.8, 1] } : { scale: 1 }}
        transition={{ duration: 0.15 }}
      />
      <AnimatePresence>
        {click > 0 && (
          <motion.div
            key={`ring-${click}`}
            className="absolute left-0 top-0 -ml-3 -mt-3 h-6 w-6 rounded-full border border-cyan-300/70"
            initial={{ scale: 0.3, opacity: 0.9 }}
            animate={{ scale: 1.7, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
