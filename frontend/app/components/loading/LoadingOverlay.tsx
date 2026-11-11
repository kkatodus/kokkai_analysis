"use client";

/**
 * Dashboard loading overlay (specs/dashboard-loading §5.2), rendered by app/app/layout.tsx.
 *
 * While /app loads: staged progress bar naming the datasets being prepared, then (after 0.8 s) a deck
 * of 使い方 tips, facts and quiz questions. When the dashboard mounts:
 *   - ready within 1 s and nothing touched → the overlay simply goes away (regulars never see it);
 *   - otherwise it stays, dimmed over the live dashboard, until 閉じる / ダッシュボードへ / Esc.
 * Opted-out visitors get the bar only, and it always goes away on ready.
 * Visits that arrive with ?tour=1 or ?open=… never hold the overlay: the tour or modal takes over.
 * On a direct visit the static backdrop of loading.tsx shows until this hydrates (about half a second).
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { track } from "@/app/components/landing/track";
import { buildDeck, type LoadingCardItem } from "./content";
import { LoadingCard } from "./LoadingCard";
import { LoadingProgress } from "./LoadingProgress";
import { CARD_DELAY_MS, FAST_PATH_MS, SLOW_MS, loadingStore, readOptOut, readSeen, writeOptOut, writeSeen } from "./loadingStore";
import { progressAt } from "./stages";

const isClient = () => typeof window !== "undefined";

export function LoadingOverlay() {
  const s = useSyncExternalStore(loadingStore.subscribe, loadingStore.get, loadingStore.getServer);
  const reducedMotion = Boolean(useReducedMotion());
  const [now, setNow] = useState(() => Date.now());
  // Per-visitor settings and the card deck are read once when the /app layout mounts (client only;
  // the overlay renders nothing on the server and during hydration, so these never reach markup).
  const [optOut, setOptOut] = useState(() => isClient() && readOptOut());
  const [deck] = useState<LoadingCardItem[]>(() => (isClient() ? buildDeck(readSeen()) : []));
  const [cardIdx, setCardIdx] = useState(0);

  // Start the clock if the dashboard is not here yet (the only way to notice a direct visit, see
  // loadingStore). Runs after the page's own layout effects, so an instant page is already mounted.
  // Leaving /app resets the store so the next visit starts clean.
  useLayoutEffect(() => {
    loadingStore.start();
    return () => loadingStore.reset();
  }, []);

  const ready = s.readyAt !== null;
  const hold = ready && !optOut && !s.deepLink && (s.touched || s.readyAt! - s.shownAt >= FAST_PATH_MS);
  const visible = s.active && !s.dismissed && (!ready || hold);

  // tick the progress curve while loading
  useEffect(() => {
    if (!s.active || ready) return;
    const t = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(t);
  }, [s.active, ready]);

  const elapsed = Math.max(0, (ready ? s.readyAt! : now) - s.shownAt);
  const { stage, pct } = progressAt(elapsed);
  const slow = elapsed >= SLOW_MS;
  const showCards = !optOut && (elapsed >= CARD_DELAY_MS || ready);

  const item = deck.length ? deck[cardIdx % deck.length] : null;

  // remember what was shown so a returning visitor starts with fresh cards
  useEffect(() => {
    if (!item || !visible || !showCards) return;
    const seen = readSeen().filter((id) => id !== item.id);
    writeSeen([...seen, item.id]);
  }, [item, visible, showCards]);

  const close = useCallback((reason: "close" | "done" | "optout") => {
    track("LoadingCardDismiss", { reason });
    loadingStore.dismiss();
  }, []);

  useEffect(() => {
    if (!visible || !ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("close");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, ready, close]);

  const onNext = useCallback(() => {
    loadingStore.touch();
    setCardIdx((i) => i + 1);
  }, []);
  const onAnswer = useCallback((id: string, correct: boolean) => {
    loadingStore.touch();
    track("LoadingCardAnswer", { id, correct });
  }, []);
  const onOptOut = useCallback(() => {
    writeOptOut(true);
    setOptOut(true);
    if (ready) close("optout");
    else track("LoadingCardDismiss", { reason: "optout" });
  }, [ready, close]);

  const fade = useMemo(() => (reducedMotion ? { duration: 0 } : { duration: 0.25 }), [reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="dashboard-loading-overlay"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          className={`fixed inset-0 z-[100] flex overflow-y-auto px-4 py-8 ${
            ready ? "bg-[#020617]/75 backdrop-blur-sm" : "bg-linear-to-b from-[#111827] to-[#020617]"
          }`}
          onClick={ready ? (e) => e.target === e.currentTarget && close("close") : undefined}
          role={ready ? "dialog" : undefined}
          aria-modal={ready ? true : undefined}
          aria-label="ダッシュボードの読み込み"
        >
          {!ready && <div aria-hidden="true" className="landing-drift pointer-events-none absolute inset-0" />}

          <div className="relative m-auto w-full max-w-xl">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-200">
              <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
              KOKKAI DOC
            </div>

            <LoadingProgress stage={stage} pct={pct} ready={ready} slow={slow} reducedMotion={reducedMotion} />

            <div className="mt-6 min-h-[14rem]">
              <AnimatePresence mode="wait" initial={false}>
                {showCards && item && (
                  <motion.div
                    key={`${item.id}-${cardIdx}`}
                    initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }}
                    transition={fade}
                  >
                    <LoadingCard
                      item={item}
                      position={(cardIdx % deck.length) + 1}
                      total={deck.length}
                      onNext={onNext}
                      onAnswer={onAnswer}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              {!showCards && !optOut && <p className="text-center text-xs text-gray-500">大量の会議録データを準備しています…</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!optOut ? (
                <button type="button" onClick={onOptOut} className="text-[11px] text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline">
                  次回から表示しない
                </button>
              ) : (
                <span />
              )}
              {ready && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => close("close")}
                    className="rounded-full border border-slate-400/25 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
                  >
                    閉じる
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => close("done")}
                    className="rounded-full border border-cyan-400/30 bg-linear-to-br from-cyan-500/30 to-indigo-600/30 px-5 py-2 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-500/20 transition hover:border-cyan-400/50 hover:from-cyan-500/40 hover:to-indigo-600/40"
                  >
                    ダッシュボードへ
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
