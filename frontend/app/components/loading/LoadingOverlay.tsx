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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/app/components/landing/track";
import { buildDeck, mergeAfter, order, type LoadingCardItem } from "./content";
import { buildStatsCards, type SiteStats } from "./content/siteStats";
import { LoadingCard } from "./LoadingCard";
import { Button } from "@/app/components/shared/Button";
import { useRegisterOverlay } from "@/app/components/shared/overlayStore";
import { LoadingProgress } from "./LoadingProgress";
import { CARD_DELAY_MS, FAST_PATH_MS, SLOW_MS, loadingStore, readOptOut, readSeen, writeOptOut, writeSeen } from "./loadingStore";
import { progressAt } from "./stages";

const isClient = () => typeof window !== "undefined";

/** 41_234_567_890 → "41.2 GB" (decimal GB, as storage is usually quoted). */
const formatGB = (bytes: number) => `${(bytes / 1e9).toLocaleString("ja-JP", { maximumFractionDigits: bytes >= 1e11 ? 0 : 1 })} GB`;

export function LoadingOverlay() {
  const s = useSyncExternalStore(loadingStore.subscribe, loadingStore.get, loadingStore.getServer);
  const reducedMotion = Boolean(useReducedMotion());
  const [now, setNow] = useState(() => Date.now());
  // Per-visitor settings and the card deck are read once when the /app layout mounts (client only;
  // the overlay renders nothing on the server and during hydration, so these never reach markup).
  const [optOut, setOptOut] = useState(() => isClient() && readOptOut());
  const [deck, setDeck] = useState<LoadingCardItem[]>(() => (isClient() ? buildDeck(readSeen()) : []));
  const [cardIdx, setCardIdx] = useState(0);
  const cardIdxRef = useRef(0);
  useEffect(() => {
    cardIdxRef.current = cardIdx;
  }, [cardIdx]);
  const statsRequested = useRef(false);
  const [dataBytes, setDataBytes] = useState<number | null>(null);

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
  useRegisterOverlay(visible);

  // tick the progress curve while loading
  useEffect(() => {
    if (!s.active || ready) return;
    const t = window.setInterval(() => setNow(Date.now()), 120);
    return () => window.clearInterval(t);
  }, [s.active, ready]);

  // Real numbers from the site (specs/dashboard-loading §8): fetched once per load, ~3 KB, never blocks.
  // Arrives after the first card, so the cards are spliced in right after the one being read.
  useEffect(() => {
    if (!s.active || optOut || statsRequested.current) return;
    statsRequested.current = true;
    fetch("/api/site-stats")
      .then((r) => (r.ok ? (r.json() as Promise<SiteStats>) : null))
      .then((stats) => {
        if (!stats || !Array.isArray(stats.top_speakers_current)) return;
        if (typeof stats.data_bytes === "number" && stats.data_bytes > 0) setDataBytes(stats.data_bytes);
        const extra = order(buildStatsCards(stats), readSeen());
        setDeck((d) => mergeAfter(d, cardIdxRef.current % Math.max(1, d.length), extra));
      })
      .catch(() => {
        /* the static cards are enough */
      });
  }, [s.active, optOut]);

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
          className={`fixed inset-0 z-(--z-loading) flex overflow-y-auto px-4 py-8 ${
            ready ? "bg-scrim backdrop-blur-sm" : "bg-linear-to-b from-page to-surface"
          }`}
          onClick={ready ? (e) => e.target === e.currentTarget && close("close") : undefined}
          role={ready ? "dialog" : undefined}
          aria-modal={ready ? true : undefined}
          aria-label="ダッシュボードの読み込み"
        >
          {!ready && <div aria-hidden="true" className="landing-drift pointer-events-none absolute inset-0" />}

          <div className="relative m-auto w-full max-w-xl">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-title-sm text-ink">
              <span aria-hidden className="size-2.5 rounded-full bg-linear-to-br from-primary to-secondary" />
              KOKKAI DOC
              {dataBytes !== null && (
                <span className="ml-auto text-caption text-ink-muted">
                  収集・分析したデータ <span className="text-data text-link">{formatGB(dataBytes)}</span>
                </span>
              )}
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
              {!showCards && !optOut && <p className="text-center text-body-sm text-ink-muted">大量の会議録データを準備しています…</p>}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!optOut ? (
                <Button variant="ghost" size="sm" onClick={onOptOut}>
                  次回から表示しない
                </Button>
              ) : (
                <span />
              )}
              {ready && (
                <div className="flex gap-2">
                  <Button onClick={() => close("close")}>閉じる</Button>
                  <Button variant="primary" autoFocus onClick={() => close("done")}>
                    ダッシュボードへ
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
