/**
 * Loading boundary for /app (specs/dashboard-loading §5.2).
 *
 * Shown the instant the landing page's button is clicked, and streamed first on a direct hit.
 * It tells the overlay store that a load is in progress; the interactive overlay itself lives in
 * `layout.tsx`. The static backdrop here is what a direct visitor sees before JavaScript hydrates.
 */

import { LoadingSignal } from "@/app/components/loading/LoadingSignal";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";

export default function DashboardLoading() {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
      <LoadingSignal />
      <div className="flex flex-col items-center gap-3 text-center">
        <LoadingIndicator size="lg" />
        <div className="text-sm font-medium text-gray-200">議員データを呼び出し中</div>
      </div>
    </div>
  );
}
