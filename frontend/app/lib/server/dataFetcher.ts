"use server";
/**
 * Server-side data fetching functions
 * These can be used in Server Components and run on the server
 * They use native fetch with proper cache configurations
 */


import { API_ENDPOINTS } from "@/app/lib/config/api";
import Papa from "papaparse";
import { gunzipSync } from "node:zlib";
import type {
  ParliamentMemberData,
  IdeologyData,
  AllParliamentMemberTableData,
  RelevanceAndProductivityData,
} from "@/app/types";


/**
 * Get the API base URL (server-side version)
 */
function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

function getServerApiBaseUrl(): string {
  // Check if we're in local development mode
  if (process.env.BACKEND_URL) {
	return normalizeBaseUrl(process.env.BACKEND_URL);
  }
  return "http://localhost:8000";
}

/**
 * Revalidation period: 1 day (86400 seconds)
 * Matches the page-level revalidation setting
 */
const REVALIDATION_TIME = parseInt(process.env.REVALIDATION_TIME || "86400"); // 1 day
console.log('[Server DataFetcher] Revalidation time:', REVALIDATION_TIME);

/**
 * Generic server-side fetch wrapper
 * Uses Next.js caching with ISR (Incremental Static Regeneration)
 * Data is cached and only refetched after the revalidation period
 */
async function fetchApi<T>(endpoint: string, options: { cache?: boolean } = { cache: true }): Promise<T> {
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  console.log('[Server DataFetcher] Fetching from server:', url);

  try {
	const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
	  headers: {
		"Content-Type": "application/json",
		"X-API-KEY": process.env.API_KEY || "",
	  },
	};

	// IMPORTANT:
	// In Next.js App Router, fetch() defaults to caching ("force-cache") when no cache/next is provided.
	// That means `options.cache: false` MUST explicitly use `cache: "no-store"`; otherwise large responses
	// can hit Next's data cache limits (>2MB) and lead to confusing "works once then hangs" behavior.
	if (options.cache) {
	  fetchOptions.next = { revalidate: REVALIDATION_TIME };
	} else {
	  fetchOptions.cache = "no-store";
	}

	const response = await fetch(url, fetchOptions);

	if (!response.ok) {
	  throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}

	return await response.json();
  } catch (error) {
	console.error(`Failed to fetch from ${url}:`, error);
	throw error;
  }
}

async function fetchApiRaw(endpoint: string, options: { cache?: boolean } = { cache: true }): Promise<ArrayBuffer> {
  const baseUrl = getServerApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  console.log('[Server DataFetcher] Fetching from server:', url);

  try {
	// Important: disable Next.js fetch cache here.
	// Large payloads (>2MB) cannot be stored in Next's data cache.
	const response = await fetch(url, { cache: options.cache ? "default" : "no-store", headers: { "X-API-KEY": process.env.API_KEY || "" } });
	if (!response.ok) {
	  throw new Error(`API request failed: ${response.status} ${response.statusText}`);
	}
	return await response.arrayBuffer();
  } catch (error) {
	console.error(`Failed to fetch from ${url}:`, error);
	throw error;
  }
}


/**
 * Fetch prefectures (server-side)
 */
export async function getVotingDistrictGeoJsonData(): Promise<any> {
	

  try {
	// If your API has a geo endpoint, use it here
	const geoJsonData = await fetchApi<any>(API_ENDPOINTS.votingDistrictGeoJson, { cache: true });
	return geoJsonData;
  } catch (error) {
	console.error("Failed to fetch prefectures from API, falling back to mock data:", error);
	return []; 
  }
}

export async function getParliamentMemberData(): Promise<ParliamentMemberData | null> {
 
  try {
	// If your API has a parliament member data endpoint, use it here
	return await fetchApi<ParliamentMemberData>(API_ENDPOINTS.parliamentMemberData, { cache: true });
  } catch (error) {
	console.error("Failed to fetch parliament member data from API, falling back to mock data:", error);
	return null;
  }
}

export async function getDonors(): Promise<string[]> {
	try {
		return await fetchApi<string[]>(API_ENDPOINTS.donors, { cache: true });
	} catch (error) {
		console.error("Failed to fetch donors from API, falling back to mock data:", error);
		return [];
	}
}


export async function getIdeologyData(): Promise<IdeologyData | null> {
	try {
		return await fetchApi<IdeologyData | null>(API_ENDPOINTS.ideology, { cache: true });
	} catch (error) {
		console.error("Failed to fetch ideology data from API, falling back to mock data:", error);
		return null;
	}
}

export async function getAllParliamentMemberTable(): Promise<AllParliamentMemberTableData[] | null> {
	try {
		const buf = await fetchApiRaw(API_ENDPOINTS.allParliamentMemberTable, { cache: true });
		let bytes = new Uint8Array(buf);

		// In some runtimes the response may still be gzipped; handle both cases.
		if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
			bytes = gunzipSync(bytes);
		}

		const csvText = new TextDecoder("utf-8").decode(bytes);

		// Papa.parse on ArrayBuffer triggers FileReaderSync in some environments.
		// Parse from string instead (sync).
		return Papa.parse(csvText, { header: true, skipEmptyLines: true }).data as AllParliamentMemberTableData[];
	} catch (error) {
		console.error("Failed to fetch all parliament member table from API, falling back to mock data:", error);
		return null;
	}
}

export async function getAllRelevanceAndProductivityData(): Promise<RelevanceAndProductivityData[] | null> {
	try {
		const data = await fetchApi<any>(API_ENDPOINTS.allRelevanceAndProductivityData, { cache: true });
		return data.data as RelevanceAndProductivityData[];
	} catch (error) {
		console.error("Failed to fetch all relevance and productivity data from API, falling back to mock data:", error);
		return null;
	}
}