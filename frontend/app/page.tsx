/**
 * Parliament Explorer Page (Server Component)
 * Fetches initial data on the server and passes it to the client component
 */

import { Suspense } from "react";
import { ParliamentExplorerClient } from "@/app/components/ParliamentExplorerClient";
import { getVotingDistrictGeoJsonData, getParliamentMemberData, getIdeologyData, getAllParliamentMemberTable, getAllRelevanceAndProductivityData } from "@/app/lib/server/dataFetcher";
import { isUsingMockData } from "@/app/lib/services/dataService";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";

/**
 * Loading component shown while data is being fetched
 */
function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center">
          <LoadingIndicator label="読み込み中" />
        </div>
        <div className="text-lg text-gray-400">Loading parliament data...</div>
        <div className="text-sm text-gray-500">
          {isUsingMockData() ? "Using mock data" : "Fetching from API"}
        </div>
      </div>
    </div>
  );
}

/**
 * ISR: home page revalidates every 10 minutes (server `fetch` in dataFetcher uses the same default).
 * Must be a numeric literal — Next.js does not allow imported constants for segment config.
 */
export const revalidate = 600;

/**
 * Main page component (Server Component)
 * Fetches data on the server before rendering
 */
export default async function ParliamentExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ person_id?: string }>;
}) {
  // Await searchParams (Next.js 15+ requires this)
  const params = await searchParams;
  
  // Fetch all initial data in parallel on the server
  const [parliamentMemberData, allParliamentMemberTable, votingDistrictGeoJsonData, ideologyData, relevanceAndProductivityData] = await Promise.all([
    getParliamentMemberData(),
    getAllParliamentMemberTable(),
    getVotingDistrictGeoJsonData(),
    getIdeologyData(),
	getAllRelevanceAndProductivityData(),
  ]);

  // Get selectedId from URL search params (for shareable links)
  const selectedPersonId = params.person_id || null;

  return (
    <Suspense fallback={<LoadingState />}>
      <ParliamentExplorerClient
		allParliamentMemberTable={allParliamentMemberTable}
        parliamentMemberData={parliamentMemberData}
        votingDistrictGeoJsonData={votingDistrictGeoJsonData}
        ideologyData={ideologyData}
        initialSelectedPersonId={selectedPersonId}
		relevanceAndProductivityData={relevanceAndProductivityData}
      />
    </Suspense>
  );
}
