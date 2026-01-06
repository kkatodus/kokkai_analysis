/**
 * API configuration
 * Determines the base URL for API requests based on environment
 */

/**
 * Get the API base URL based on environment
 * Works both server-side and client-side
 */
export function getApiBaseUrl(): string {
  // Check if we're in local development mode
  if (isLocalDevelopment()) {
    return "http://localhost:5000";
  }

  // Use environment variable if set (works on both server and client)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // Fallback to production API (Heroku legacy)
  return "https://sangiin-api.herokuapp.com";
}

/**
 * Check if we're in local development mode
 * Uses environment variable NEXT_PUBLIC_ENVIRONMENT or NODE_ENV
 */
export function isLocalDevelopment(): boolean {
  // Check explicit environment variable
  if (typeof window !== "undefined") {
    const env = process.env.NEXT_PUBLIC_ENVIRONMENT;
    if (env === "local") return true;
    if (env === "development") return true;
  }

  // Check NODE_ENV (for server-side)
  if (process.env.NODE_ENV === "development") {
    // Only use mock in local dev if explicitly set
    const env = process.env.NEXT_PUBLIC_ENVIRONMENT;
    return env === "local" || env === undefined;
  }

  return false;
}

/**
 * API endpoint paths
 */
export const API_ENDPOINTS = {
  // Representatives
  parliamentMemberData: "/parliamentMember",

  // donors
  donors: "/donors",
  
  // Speeches
  speeches: "/speeches",
  
  // voting district geo json data
  votingDistrictGeoJson: "/geo/senkyokuPolydata",

  // ideology
  ideology: "/ideology",

  // all parliament member table
  allParliamentMemberTable: "/parliamentMember/all",
} as const;

