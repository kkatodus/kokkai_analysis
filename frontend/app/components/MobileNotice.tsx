"use client";

import { IoClose } from "react-icons/io5";
import { IconButton } from "@/app/components/shared/Button";
import { useAnyOverlayOpen } from "@/app/components/shared/overlayStore";

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

  const overlayOpen = useAnyOverlayOpen();

  // waits until the loading screen, modals and the tour are closed
  if (!small || dismissed || overlayOpen) return null;

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
      className="fixed inset-x-3 bottom-3 z-(--z-notice) flex items-start gap-3 rounded-2xl border border-line-strong bg-surface p-4 text-body-md text-ink shadow-2xl"
    >
      <span aria-hidden="true" className="mt-0.5 text-lg leading-none">🖥️</span>
      <p className="flex-1">
        KOKKAI DOC のダッシュボードは、3D マップやグラフを大きな画面で見るように作られています。
        <span className="text-title-sm text-on-primary-soft">パソコンなど大きなモニターでの閲覧がおすすめです。</span>
      </p>
      <IconButton label="閉じる" onClick={close} className="-mt-1 -mr-1">
        <IoClose className="size-4" />
      </IconButton>
    </div>
  );
}
