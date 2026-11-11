"use client";

/**
 * Child of a landing-page <Link href="/app">: acknowledges the click in the same frame with a small
 * spinner while Next.js fetches the dashboard (specs/dashboard-loading §5.2).
 */

import { useLinkStatus } from "next/link";

export function LinkPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="inline-flex items-center gap-2" aria-busy={pending || undefined}>
      {children}
      {pending && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80 motion-reduce:animate-none"
        />
      )}
    </span>
  );
}
