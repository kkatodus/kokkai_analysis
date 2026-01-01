"use server";
/**
 * Server-side data fetching functions
 * These can be used in Server Components and run on the server
 * They use native fetch with proper cache configurations
 */


import { API_ENDPOINTS } from "@/app/lib/config/api";
import {
  mockTopics,
  mockPrefectures,
  mockEdges,
  mockComments,
} from "@/app/data/mockData";
import type {
  Politician,
  Topic,
  NetworkEdge,
  Prefecture,
  Comment,
  ParliamentMemberData,
} from "@/app/types";

/**
 * Check if we're in local development (server-side)
 */
function isLocalDevelopment(): boolean {
  if (process.env.NODE_ENV === "development") {
	const env = process.env.ENVIRONMENT;
	return env === "local" || env === undefined;
  }
  return false;
}

/**
 * Get the API base URL (server-side version)
 */
function getServerApiBaseUrl(): string {
  // Check if we're in local development mode
  if (isLocalDevelopment()) {
	return process.env.BACKEND_URL || "http://localhost:5000";
  }

  // Use environment variable if set
  if (process.env.NEXT_PUBLIC_API_URL) {
	return process.env.NEXT_PUBLIC_API_URL;
  }

  // Fallback to production API (Heroku legacy)
  return "https://sangiin-api.herokuapp.com";
}

/**
 * Revalidation period: 1 week (604800 seconds)
 * Matches the page-level revalidation setting
 */
const REVALIDATION_TIME = parseInt(process.env.REVALIDATION_TIME || "604800"); // 7 days
console.log('[Server DataFetcher] Revalidation time:', REVALIDATION_TIME);

/**
 * Generic server-side fetch wrapper
 * Uses Next.js caching with ISR (Incremental Static Regeneration)
 * Data is cached and only refetched after the revalidation period
 */
async function fetchApi<T>(endpoint: string): Promise<T> {
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  console.log('[Server DataFetcher] Fetching from server:', url);

  try {
	const response = await fetch(url, {
	  headers: {
		"Content-Type": "application/json",
	  },
	  // Use Next.js ISR caching - data is cached for 1 week
	  // After the revalidation period, Next.js will revalidate in the background
	  // This prevents hammering the backend API
	  next: { revalidate: REVALIDATION_TIME },
	});

	if (!response.ok) {
	  throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	return await response.json();
  } catch (error) {
	console.error(`Failed to fetch from ${url}:`, error);
	throw error;
  }
}

/**
 * Transform API representative data to Politician format
 */
function transformApiReprToPolitician(apiRepr: any): Politician {
  return {
	id: apiRepr.id || apiRepr.name?.replace(/\s+/g, "_").toLowerCase() || `politician_${Date.now()}`,
	name: apiRepr.name || "Unknown",
	party: apiRepr.party || apiRepr.affiliation || "Unknown",
	isMajor: apiRepr.isMajor || false,
	ideology: {
	  econ: apiRepr.ideology?.econ || apiRepr.econ_axis || 0,
	  social: apiRepr.ideology?.social || apiRepr.social_axis || 0,
	},
	topicScores: apiRepr.topicScores || {},
	trustScore: apiRepr.trustScore || apiRepr.trust_score || 50,
	trustLabel: apiRepr.trustLabel || apiRepr.trust_label || "Unknown",
	factScore: apiRepr.factScore || apiRepr.fact_score || 50,
	factLabel: apiRepr.factLabel || apiRepr.fact_label || "Unknown",
	district: apiRepr.district ? {
	  prefectureId: apiRepr.district.prefectureId || apiRepr.district.prefecture_id || "",
	  prefectureName: apiRepr.district.prefectureName || apiRepr.district.prefecture_name || "",
	  name: apiRepr.district.name || "",
	} : undefined,
	photoUrl: apiRepr.photoUrl || apiRepr.photo_url,
	summary: apiRepr.summary || "",
	keyPositions: apiRepr.keyPositions || apiRepr.key_positions || [],
	career: apiRepr.career || [],
	speeches: apiRepr.speeches || [],
	tweets: apiRepr.tweets || [],
  };
}

/**
 * Fetch topics (server-side)
 */
export async function getTopics(): Promise<Topic[]> {
  if (isLocalDevelopment()) {
	console.log("[Server DataFetcher] Using mock data for topics");
	return mockTopics;
  }

  try {
	// If your API has a topics endpoint, use it here
	return mockTopics;
  } catch (error) {
	console.error("Failed to fetch topics from API, falling back to mock data:", error);
	return mockTopics;
  }
}

/**
 * Fetch prefectures (server-side)
 */
export async function getVotingDistrictGeoJsonData(): Promise<Prefecture[]> {
	

  try {
	// If your API has a geo endpoint, use it here
	const geoJsonData = await fetchApi<any>(API_ENDPOINTS.votingDistrictGeoJson);
	return geoJsonData;
  } catch (error) {
	console.error("Failed to fetch prefectures from API, falling back to mock data:", error);
	return mockPrefectures; 
  }
}

export async function getParliamentMemberData(): Promise<ParliamentMemberData | null> {
 
  try {
	// If your API has a parliament member data endpoint, use it here
	return await fetchApi<ParliamentMemberData>(API_ENDPOINTS.parliamentMemberData);
  } catch (error) {
	console.error("Failed to fetch parliament member data from API, falling back to mock data:", error);
	return null;
  }
}

export async function getDonors(): Promise<string[]> {
	try {
		return await fetchApi<string[]>(API_ENDPOINTS.donors);
	} catch (error) {
		console.error("Failed to fetch donors from API, falling back to mock data:", error);
		return [];
	}
}


/**
 * Fetch network edges (server-side)
 */
export async function getNetworkEdges(): Promise<NetworkEdge[]> {
  if (isLocalDevelopment()) {
	console.log("[Server DataFetcher] Using mock data for network edges");
	return mockEdges;
  }

  try {
	// If your API has a network/edges endpoint, use it here
	return mockEdges;
  } catch (error) {
	console.error("Failed to fetch network edges from API, falling back to mock data:", error);
	return mockEdges;
  }
}

/**
 * Fetch comments for a politician (server-side)
 */
export async function getComments(politicianId: string): Promise<Comment[]> {
  if (isLocalDevelopment()) {
	console.log("[Server DataFetcher] Using mock data for comments");
	return mockComments.filter((c) => c.politicianId === politicianId);
  }

  try {
	// If your API has a comments endpoint, use it here
	return mockComments.filter((c) => c.politicianId === politicianId);
  } catch (error) {
	console.error("Failed to fetch comments from API, falling back to mock data:", error);
	return mockComments.filter((c) => c.politicianId === politicianId);
  }
}

