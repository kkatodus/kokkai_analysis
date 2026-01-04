/**
 * Data fetching service
 * Automatically switches between mock data (local dev) and API calls (production)
 */

import { getApiBaseUrl, isLocalDevelopment, API_ENDPOINTS } from "@/app/lib/config/api";

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
 * Export a convenience function to check if using mock data
 */
export function isUsingMockData(): boolean {
  return isLocalDevelopment();
}

