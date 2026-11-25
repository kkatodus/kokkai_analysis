/**
 * Dashboard loading state (specs/dashboard-loading §5.2).
 *
 * A tiny module-level store read with useSyncExternalStore. It outlives the `loading.tsx` → page
 * swap because the overlay that reads it is rendered by `app/app/layout.tsx`.
 *
 *   overlay mounts without a dashboard, or loading.tsx mounts → start()
 *       (a server-rendered Suspense fallback is never hydrated, so on a direct visit only the
 *        overlay in the layout can run code while the page streams; it starts the clock)
 *   ParliamentExplorerClient mounts → markReady()  (readyAt = now; the only "100 %" signal)
 *   ParliamentExplorerClient unmounts → unmountDashboard()
 *   a card is touched             → touch()      (overlay stays after ready)
 *   閉じる / ダッシュボードへ         → dismiss(reason)
 */

export type LoadingState = {
  /** a loading boundary was shown for the current visit to /app */
  active: boolean;
  shownAt: number;
  readyAt: number | null;
  touched: boolean;
  dismissed: boolean;
  /** the dashboard is mounted right now */
  dashboardMounted: boolean;
  /** the visit arrived with ?tour=1 or ?open=…, read when the dashboard mounted */
  deepLink: boolean;
};

const INITIAL: LoadingState = {
  active: false,
  shownAt: 0,
  readyAt: null,
  touched: false,
  dismissed: false,
  dashboardMounted: false,
  deepLink: false,
};

let firstStartInDocument = true;

let state: LoadingState = INITIAL;
const listeners = new Set<() => void>();

function set(next: Partial<LoadingState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export const loadingStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  getServer: () => INITIAL,
  start() {
    if (state.dashboardMounted) return;
    // a second start during the same load keeps the original start time
    if (state.active && state.readyAt === null) return;
    set({ active: true, shownAt: startTime(), readyAt: null, touched: false, dismissed: false });
  },
  markReady() {
    const q = new URLSearchParams(window.location.search);
    const deepLink = q.get("tour") === "1" || q.has("open");
    if (!state.active || state.readyAt !== null) {
      set({ dashboardMounted: true, deepLink });
      return;
    }
    set({ dashboardMounted: true, deepLink, readyAt: Date.now() });
  },
  unmountDashboard() {
    set({ dashboardMounted: false });
  },
  touch() {
    if (!state.touched) set({ touched: true });
  },
  dismiss() {
    set({ dismissed: true });
  },
  /** leaving /app: the next visit starts clean */
  reset() {
    state = INITIAL;
    listeners.forEach((l) => l());
  },
};

/**
 * When the load began. On a direct visit to /app the overlay only hydrates after the scripts load,
 * so count from navigation start; on a client-side navigation, from now.
 */
function startTime(): number {
  const now = Date.now();
  if (!firstStartInDocument) return now;
  firstStartInDocument = false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const directHit = nav && new URL(nav.name).pathname === window.location.pathname && performance.now() < 60000;
  return directHit ? Math.round(performance.timeOrigin) : now;
}

/** Ready this soon after the boundary appeared, with the card untouched → no overlay at all. */
export const FAST_PATH_MS = 1000;
/** First card appears this long after the boundary. */
export const CARD_DELAY_MS = 800;
/** After this long without ready, offer a reload. */
export const SLOW_MS = 15000;

const OPTOUT_KEY = "kokkaidoc.loading.optout";
const SEEN_KEY = "kokkaidoc.loading.seen";

export function readOptOut(): boolean {
  try {
    return window.localStorage.getItem(OPTOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeOptOut(v: boolean) {
  try {
    if (v) window.localStorage.setItem(OPTOUT_KEY, "1");
    else window.localStorage.removeItem(OPTOUT_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeSeen(ids: string[]) {
  try {
    // keep the most recent 200 so the list never grows without bound
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* storage unavailable */
  }
}
