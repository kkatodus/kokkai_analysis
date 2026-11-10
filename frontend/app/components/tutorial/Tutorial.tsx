"use client";

/**
 * Guided tour: dims the page, cuts a hole around the current step's target, and shows a card with
 * 戻る / 次へ / スキップ. Action steps watch the app state (TourState) and advance once the user has
 * done the thing, with a fallback button for people who would rather not.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TourActions, TourState, TourStep } from "@/app/components/tutorial/tutorialSteps";

const PAD = 8; // spotlight padding around the target
const CARD_W = 340;
const CARD_H_GUESS = 280;
const GAP = 14;

type Rect = { x: number; y: number; w: number; h: number };

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;
}

export function Tutorial({
  steps,
  stepIndex,
  state,
  actions,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: {
  steps: TourStep[];
  stepIndex: number;
  state: TourState;
  actions: TourActions;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [doneFlash, setDoneFlash] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardH, setCardH] = useState(CARD_H_GUESS);
  const enteredRef = useRef<string | null>(null);
  const autoAdvanceRef = useRef<number | null>(null);

  // run the step's onEnter once, then scroll its target into view once it exists
  useEffect(() => {
    if (enteredRef.current === step.id) return;
    enteredRef.current = step.id;
    setDoneFlash(false);
    step.onEnter?.(actions, state);
    let tries = 0;
    const tick = () => {
      const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
      if (el) {
        el.scrollIntoView({ block: step.scrollBlock ?? "center", behavior: "smooth" });
        return;
      }
      if (tries++ < 20) window.setTimeout(tick, 100);
    };
    window.setTimeout(tick, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // track the target's rectangle (layout shifts, panes sliding in, scrolling)
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 120) {
        last = t;
        const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
        const r = el ? el.getBoundingClientRect() : null;
        const next = r && r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
        setRect((prev) => (sameRect(prev, next) ? prev : next));
        setViewport((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
        if (cardRef.current) {
          const h = cardRef.current.offsetHeight;
          setCardH((prev) => (Math.abs(prev - h) > 2 ? h : prev));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  // action steps: advance on their own once the user has done it
  const done = step.action ? step.action.isDone(state) : false;
  useEffect(() => {
    if (!step.action || !done || autoAdvanceRef.current !== null) return;
    setDoneFlash(true);
    autoAdvanceRef.current = window.setTimeout(() => {
      autoAdvanceRef.current = null;
      onNext();
    }, 900);
    return () => {
      if (autoAdvanceRef.current !== null) {
        window.clearTimeout(autoAdvanceRef.current);
        autoAdvanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, step.id]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
      else if (e.key === "ArrowRight") (isLast ? onFinish : onNext)();
      else if (e.key === "ArrowLeft" && stepIndex > 0) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip, onNext, onBack, onFinish, isLast, stepIndex]);

  const hole: Rect | null = useMemo(() => {
    if (!rect) return null;
    return { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 };
  }, [rect]);

  const narrow = viewport.w > 0 && viewport.w < 768;

  // card placement: below the hole, else above, else beside; clamped to the viewport
  const cardStyle = useMemo<React.CSSProperties>(() => {
    const vw = viewport.w || 1440;
    const vh = viewport.h || 900;
    const w = Math.min(CARD_W, vw - 24);
    if (narrow) return { left: 12, right: 12, bottom: 12, width: "auto" };
    if (!hole) return { left: (vw - w) / 2, top: Math.max(24, (vh - cardH) / 2), width: w };
    const below = hole.y + hole.h + GAP;
    const above = hole.y - GAP - cardH;
    const prefer = step.placement ?? "auto";
    let top: number;
    let left = hole.x + hole.w / 2 - w / 2;
    if ((prefer === "bottom" || prefer === "auto") && below + cardH <= vh - 12) top = below;
    else if ((prefer === "top" || prefer === "auto") && above >= 12) top = above;
    else if (hole.x + hole.w + GAP + w <= vw - 12 || prefer === "right") {
      left = hole.x + hole.w + GAP;
      top = Math.max(12, Math.min(hole.y, vh - cardH - 12));
    } else if (hole.x - GAP - w >= 12 || prefer === "left") {
      left = hole.x - GAP - w;
      top = Math.max(12, Math.min(hole.y, vh - cardH - 12));
    } else {
      top = Math.max(12, Math.min(below, vh - cardH - 12));
    }
    left = Math.max(12, Math.min(left, vw - w - 12));
    return { left, top, width: w };
  }, [hole, viewport, cardH, narrow, step.placement]);

  const stop = useCallback(() => (isLast ? onFinish() : onSkip()), [isLast, onFinish, onSkip]);

  const paragraphs = step.body.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {/* dim everything except the hole; the four blocks swallow clicks, the hole lets them through */}
      {hole ? (
        <>
          <div className="pointer-events-auto absolute left-0 right-0 top-0 bg-black/65" style={{ height: Math.max(0, hole.y) }} />
          <div className="pointer-events-auto absolute left-0 right-0 bottom-0 bg-black/65" style={{ top: hole.y + hole.h }} />
          <div className="pointer-events-auto absolute left-0 bg-black/65" style={{ top: hole.y, height: hole.h, width: Math.max(0, hole.x) }} />
          <div className="pointer-events-auto absolute right-0 bg-black/65" style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }} />
          <div
            className="absolute rounded-2xl ring-2 ring-cyan-300/90 shadow-[0_0_0_4px_rgba(34,211,238,0.25),0_0_40px_rgba(34,211,238,0.35)] transition-all duration-200"
            style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/70" />
      )}

      {/* the card */}
      <div
        ref={cardRef}
        className="pointer-events-auto absolute rounded-2xl border border-cyan-400/30 bg-[#0b1220] p-4 text-gray-100 shadow-2xl shadow-black/60 transition-all duration-200"
        style={cardStyle}
        role="dialog"
        aria-label={step.title}
      >
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
          <span>使い方ガイド</span>
          <span>
            {stepIndex + 1} / {steps.length}
          </span>
        </div>
        <div className="mb-1.5 flex gap-0.5">
          {steps.map((s, i) => (
            <span key={s.id} className={"h-1 flex-1 rounded-full " + (i <= stepIndex ? "bg-cyan-400/80" : "bg-slate-700")} />
          ))}
        </div>
        <div className="text-[15px] font-semibold leading-snug text-gray-50">{step.title}</div>
        <div className="mt-1.5 space-y-1.5 text-[12px] leading-relaxed text-gray-200">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {step.action && (
          <div
            className={
              "mt-3 rounded-xl border p-2.5 transition-colors " +
              (done ? "border-emerald-400/40 bg-emerald-500/10" : "border-amber-400/40 bg-amber-500/10")
            }
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
              {done ? "できました ✓" : "やってみましょう"}
            </div>
            <div className="mt-0.5 text-[12px] text-gray-100">{step.action.prompt}</div>
            {!done && step.action.fallback && (
              <button
                type="button"
                onClick={() => step.action?.fallback?.(actions)}
                className="mt-2 rounded-lg border border-slate-400/30 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-gray-100 hover:bg-white/5"
              >
                {step.action.fallbackLabel ?? "代わりにサンプルを開く"}
              </button>
            )}
          </div>
        )}

        {step.cta && (
          <button
            type="button"
            onClick={() => step.cta?.run(actions)}
            className="mt-3 w-full rounded-xl border border-cyan-400/30 bg-linear-to-br from-cyan-500/20 to-indigo-600/20 px-3 py-2 text-[12px] font-semibold text-cyan-50 hover:border-cyan-400/50 hover:bg-cyan-500/25"
          >
            {step.cta.label}
          </button>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={stop} className="text-[11px] text-gray-400 hover:text-gray-200">
            {isLast ? "閉じる" : "スキップ"}
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onBack}
              disabled={stepIndex === 0}
              className="rounded-lg border border-slate-400/30 bg-slate-900/60 px-3 py-1.5 text-[12px] font-semibold text-gray-100 enabled:hover:bg-white/5 disabled:opacity-40"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={isLast ? onFinish : onNext}
              className="rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-1.5 text-[12px] font-semibold text-cyan-50 hover:bg-cyan-500/30"
            >
              {isLast ? "完了" : step.action && !done && !doneFlash ? "飛ばして次へ" : "次へ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
