/**
 * Parliament Explorer Page (Server Component)
 * Fetches initial data on the server and passes it to the client component
 */

import { Suspense } from "react";
import { ParliamentExplorerClient } from "@/app/components/ParliamentExplorerClient";
import { getPoliticians, getTopics, getPrefectures, getNetworkEdges } from "@/app/lib/server/dataFetcher";
import { isUsingMockData } from "@/app/lib/services/dataService";

/**
 * Loading component shown while data is being fetched
 */
function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
      <div className="text-center">
        <div className="mb-4 text-lg text-gray-400">Loading parliament data...</div>
        <div className="text-sm text-gray-500">
          {isUsingMockData() ? "Using mock data" : "Fetching from API"}
        </div>
      </div>
    </div>
  );
}

/**
 * Revalidation period: 1 week (604800 seconds)
 * This enables ISR (Incremental Static Regeneration) on Vercel
 * The page will be cached and only revalidated once per week
 * This prevents hammering the backend API on every request
 */
export const revalidate = 604800; // 7 days * 24 hours * 60 minutes * 60 seconds

/**
 * Main page component (Server Component)
 * Fetches data on the server before rendering
 */
export default async function ParliamentExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;
  
  // Fetch all initial data in parallel on the server
  const [politicians, topics, prefectures, edges] = await Promise.all([
    getPoliticians(),
    getTopics(),
    getPrefectures(),
    getNetworkEdges(),
  ]);

  // Get selectedId from URL search params (for shareable links)
  const selectedId = params.id || null;

  return (
    <Suspense fallback={<LoadingState />}>
      <ParliamentExplorerClient
        initialPoliticians={politicians}
        initialTopics={topics}
        initialPrefectures={prefectures}
        initialEdges={edges}
        initialSelectedId={selectedId}
      />
    </Suspense>
  );
}
