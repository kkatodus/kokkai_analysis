"use client";

import { useLayoutEffect } from "react";
import { track } from "@/app/components/landing/track";
import { CARD_DELAY_MS, loadingStore, readOptOut } from "./loadingStore";

/**
 * Rendered by app/app/loading.tsx: marks the start of a client-side navigation before the first paint.
 * (On a direct visit this never runs: React does not hydrate a server-rendered Suspense fallback.)
 */
export function LoadingSignal() {
  useLayoutEffect(() => {
    loadingStore.start();
  }, []);
  return null;
}

/** Rendered by the dashboard once it has mounted: the only "100 %" signal. */
export function DashboardReadySignal() {
  useLayoutEffect(() => {
    loadingStore.markReady();
    const s = loadingStore.get();
    if (s.active && s.readyAt !== null) {
      const ms = s.readyAt - s.shownAt;
      track("DashboardLoad", { ms, cold: true, overlay: readOptOut() || ms < CARD_DELAY_MS ? "bar" : "cards" });
    } else {
      // no loading boundary: the page arrived complete (cached HTML or a prefetched route)
      track("DashboardLoad", { cold: false, overlay: "none" });
    }
    return () => loadingStore.unmountDashboard();
  }, []);
  return null;
}
