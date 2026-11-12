/**
 * Loading boundary for /app (specs/dashboard-loading §5.2).
 *
 * Shown the instant the landing page's button is clicked, and streamed first on a direct hit.
 * It tells the overlay store that a load is in progress; the interactive overlay itself lives in
 * `layout.tsx`. The static backdrop here is what a direct visitor sees before JavaScript hydrates.
 */

import { LoadingSignal } from "@/app/components/loading/LoadingSignal";
import { Spinner } from "@/app/components/shared/states";

export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-(--z-loading) flex items-center justify-center bg-linear-to-b from-page to-surface">
      <LoadingSignal />
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <Spinner className="size-7 text-primary" />
        <p className="text-body-md text-ink">議員データを呼び出し中</p>
      </div>
    </div>
  );
}
