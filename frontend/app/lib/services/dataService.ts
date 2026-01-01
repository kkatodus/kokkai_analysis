/**
 * Data fetching service
 * Automatically switches between mock data (local dev) and API calls (production)
 */

import { getApiBaseUrl, isLocalDevelopment, API_ENDPOINTS } from "@/app/lib/config/api";
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
} from "@/app/types";

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(endpoint: string): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
      // Add cache control for development
      cache: isLocalDevelopment() ? "no-store" : "default",
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
 * Data fetching functions
 * These functions return mock data in local development, or fetch from API in production
 */


/**
 * Fetch topics
 */
export async function fetchTopics(): Promise<Topic[]> {
  if (isLocalDevelopment()) {
    console.log("[DataService] Using mock data for topics");
    return Promise.resolve(mockTopics);
  }

  try {
    // If your API has a topics endpoint, use it here
    // For now, return mock data
    return mockTopics;
  } catch (error) {
    console.error("Failed to fetch topics from API, falling back to mock data:", error);
    return mockTopics;
  }
}

/**
 * Fetch prefectures/geographic data
 */
export async function fetchPrefectures(): Promise<Prefecture[]> {
  if (isLocalDevelopment()) {
    console.log("[DataService] Using mock data for prefectures");
    return Promise.resolve(mockPrefectures);
  }

  try {
    // If your API has a geo endpoint, use it here
    // For now, return mock data
    return mockPrefectures;
  } catch (error) {
    console.error("Failed to fetch prefectures from API, falling back to mock data:", error);
    return mockPrefectures;
  }
}

/**
 * Fetch network edges (politician interaction graph)
 */
export async function fetchNetworkEdges(): Promise<NetworkEdge[]> {
  if (isLocalDevelopment()) {
    console.log("[DataService] Using mock data for network edges");
    return Promise.resolve(mockEdges);
  }

  try {
    // If your API has a network/edges endpoint, use it here
    // For now, return mock data
    return mockEdges;
  } catch (error) {
    console.error("Failed to fetch network edges from API, falling back to mock data:", error);
    return mockEdges;
  }
}

/**
 * Fetch comments for a politician
 */
export async function fetchComments(politicianId: string): Promise<Comment[]> {
  if (isLocalDevelopment()) {
    console.log("[DataService] Using mock data for comments");
    return Promise.resolve(
      mockComments.filter((c) => c.politicianId === politicianId)
    );
  }

  try {
    // If your API has a comments endpoint, use it here
    // For now, return filtered mock data
    return mockComments.filter((c) => c.politicianId === politicianId);
  } catch (error) {
    console.error("Failed to fetch comments from API, falling back to mock data:", error);
    return mockComments.filter((c) => c.politicianId === politicianId);
  }
}


/**
 * Transform API representative data to Politician format
 * This is a placeholder - adjust based on your actual API response structure
 */
function transformApiReprToPolitician(apiRepr: any): Politician {
  // This is a placeholder transformation
  // You'll need to map your actual API response structure to the Politician type
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
 * Export a convenience function to check if using mock data
 */
export function isUsingMockData(): boolean {
  return isLocalDevelopment();
}

