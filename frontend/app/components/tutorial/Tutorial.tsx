"use client";

/**
 * Guided tour: dims the page, cuts a hole around the current step's target, and shows a card with
 * 戻る / 次へ / スキップ. Action steps watch the app state (TourState) and advance once the user has
 * done the thing, with a fallback button for people who would rather not.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/shared/Button";
import { useRegisterOverlay } from "@/app/components/shared/overlayStore";
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
  useRegisterOverlay();
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
      // leave keys alone while the user types in a field (search box, selects)
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
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
    <div className="pointer-events-none fixed inset-0 z-(--z-tour)" aria-live="polite">
      {/* dim everything except the hole; the four blocks swallow clicks, the hole lets them through */}
      {hole ? (
        <>
          <div className="pointer-events-auto absolute left-0 right-0 top-0 bg-scrim" style={{ height: Math.max(0, hole.y) }} />
          <div className="pointer-events-auto absolute left-0 right-0 bottom-0 bg-scrim" style={{ top: hole.y + hole.h }} />
          <div className="pointer-events-auto absolute left-0 bg-scrim" style={{ top: hole.y, height: hole.h, width: Math.max(0, hole.x) }} />
          <div className="pointer-events-auto absolute right-0 bg-scrim" style={{ top: hole.y, height: hole.h, left: hole.x + hole.w }} />
          <div
            className="absolute rounded-2xl shadow-spotlight ring-2 ring-primary transition-all duration-200 motion-reduce:transition-none"
            style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-scrim" />
      )}

      {/* the card */}
      <div
        ref={cardRef}
        className="pointer-events-auto absolute rounded-2xl border border-primary-line bg-surface-raised p-4 text-ink shadow-2xl transition-all duration-200 motion-reduce:transition-none"
        style={cardStyle}
        role="dialog"
        aria-labelledby="tour-step-title"
      >
        <div className="mb-1 flex items-center justify-between text-label-sm text-link">
          <span>使い方ガイド</span>
          <span className="text-data">
            {stepIndex + 1} / {steps.length}
          </span>
        </div>
        <div className="mb-1.5 flex gap-0.5">
          {steps.map((s, i) => (
            <span key={s.id} className={"h-1 flex-1 rounded-full " + (i <= stepIndex ? "bg-primary" : "bg-surface-hover")} />
          ))}
        </div>
        <h2 id="tour-step-title" className="text-title-md text-ink-strong">
          {step.title}
        </h2>
        <div className="mt-1.5 space-y-1.5 text-body-sm text-ink">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {step.action && (
          <div
            className={
              "mt-3 rounded-xl border p-2.5 transition-colors " +
              (done ? "border-transparent bg-success-soft text-on-success-soft" : "border-transparent bg-warning-soft text-on-warning-soft")
            }
          >
            <div className="text-label-sm">
              {done ? "できました ✓" : "やってみましょう"}
            </div>
            <div className="mt-0.5 text-body-sm">{step.action.prompt}</div>
            {!done && step.action.fallback && (
              <Button size="sm" className="mt-2" onClick={() => step.action?.fallback?.(actions)}>
                {step.action.fallbackLabel ?? "代わりにサンプルを開く"}
              </Button>
            )}
          </div>
        )}

        {step.cta && (
          <Button variant="primary" className="mt-3 w-full" onClick={() => step.cta?.run(actions)}>
            {step.cta.label}
          </Button>
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={stop}>
            {isLast ? "閉じる" : "スキップ"}
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onBack} disabled={stepIndex === 0}>
              戻る
            </Button>
            <Button size="sm" variant={step.cta ? "secondary" : "primary"} onClick={isLast ? onFinish : onNext}>
              {isLast ? "完了" : step.action && !done && !doneFlash ? "飛ばして次へ" : "次へ"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
