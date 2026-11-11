"use client";

/**
 * Small-screen notice for the dashboard: the 3D map, charts and side panels are built for a wide
 * screen, so phone visitors are told once per browser session that a larger monitor works better.
 * Sits below the loading overlay (z-100), so it shows once the dashboard is there.
 */

import { useState, useSyncExternalStore } from "react";

const KEY = "kokkai.mobileNoticeDismissed";
const SMALL = "(max-width: 767px)";

function subscribeSmall(cb: () => void) {
  const mq = window.matchMedia(SMALL);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false; // storage blocked: show it anyway
  }
}

export function MobileNotice() {
  // false on the server and during hydration, so the markup always matches
  const small = useSyncExternalStore(subscribeSmall, () => window.matchMedia(SMALL).matches, () => false);
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && readDismissed());

  if (!small || dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[90] flex items-start gap-3 rounded-2xl border border-cyan-400/30 bg-[#0b1220]/95 p-4 text-sm text-gray-200 shadow-xl shadow-black/40 backdrop-blur"
    >
      <span aria-hidden="true" className="mt-0.5 text-lg leading-none">🖥️</span>
      <p className="flex-1 leading-relaxed">
        KOKKAI DOC のダッシュボードは、3D マップやグラフを大きな画面で見るように作られています。
        <span className="font-semibold text-cyan-100">パソコンなど大きなモニターでの閲覧がおすすめです。</span>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="閉じる"
        className="-mr-1 -mt-1 rounded-full px-2 py-1 text-gray-400 transition hover:bg-white/10 hover:text-gray-100"
      >
        ✕
      </button>
    </div>
  );
}
