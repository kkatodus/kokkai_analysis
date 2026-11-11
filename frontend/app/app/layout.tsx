/**
 * Dashboard segment layout (specs/dashboard-loading §5.1).
 * Holds the loading overlay so it survives the swap from `loading.tsx` to the page: a visitor in the
 * middle of a quiz card keeps it after the dashboard has arrived underneath.
 */

import { LoadingOverlay } from "@/app/components/loading/LoadingOverlay";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LoadingOverlay />
    </>
  );
}
