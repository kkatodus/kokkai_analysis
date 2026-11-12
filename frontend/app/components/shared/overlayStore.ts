"use client";

import { useEffect, useSyncExternalStore } from "react";

// DESIGN.md "Elevation & Depth": two overlays never share the screen. Modals, the tour and the
// loading screen register while open; the bottom notice waits until none are.
let open = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Registers an open overlay while `active` is true. */
export function useRegisterOverlay(active = true) {
  useEffect(() => {
    if (!active) return;
    open += 1;
    emit();
    return () => {
      open -= 1;
      emit();
    };
  }, [active]);
}

/** True while any registered overlay is open. */
export function useAnyOverlayOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => open > 0,
    () => false,
  );
}
