/**
 * Parliament Explorer Page (Server Component) — served at /app (specs/landing-page §4).
 * Fetches initial data on the server and passes it to the client component.
 * The loading screen while this streams is app/app/loading.tsx + the overlay in layout.tsx (specs/dashboard-loading).
 * The landing page at / links here; old root links (?person_id, ?open, ?code&state, ?tour) are redirected in next.config.ts.
 */

import type { Metadata } from "next";
import { ParliamentExplorerClient } from "@/app/components/ParliamentExplorerClient";
import { getVotingDistrictGeoJsonData, getParliamentMemberData, getIdeologyData, getAllParliamentMemberTable, getSpeechQualityAggregate } from "@/app/lib/server/dataFetcher";

/**
 * ISR: home page revalidates every 10 minutes (server `fetch` in dataFetcher uses the same default).
 * Must be a numeric literal — Next.js does not allow imported constants for segment config.
 */
export const revalidate = 600;

export const metadata: Metadata = {
  title: "KOKKAI DOC",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://kokkaidoc.com/app" },
};

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
  const [parliamentMemberData, allParliamentMemberTable, votingDistrictGeoJsonData, ideologyData, qualityAggregate] = await Promise.all([
    getParliamentMemberData(),
    getAllParliamentMemberTable(),
    getVotingDistrictGeoJsonData(),
    getIdeologyData(),
	getSpeechQualityAggregate(),
  ]);

  // Get selectedId from URL search params (for shareable links)
  const selectedPersonId = params.person_id || null;

  return (
    <ParliamentExplorerClient
		allParliamentMemberTable={allParliamentMemberTable}
        parliamentMemberData={parliamentMemberData}
        votingDistrictGeoJsonData={votingDistrictGeoJsonData}
        ideologyData={ideologyData}
        initialSelectedPersonId={selectedPersonId}
		qualityAggregate={qualityAggregate}
      />
  );
}
