/**
 * API configuration
 * Determines the base URL for API requests based on environment
 */

/**
 * Get the API base URL based on environment
 */
export function getApiBaseUrl(): string {
  // Check if we're in local development mode
  if (isLocalDevelopment()) {
    return "http://localhost:5000";
  }

  // Use environment variable if set
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
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
  sangiinRepr: "/sangiin/repr",
  shugiinRepr: "/shugiin/repr",
  sangiinCommittees: "/sangiin/commitee",
  shugiinCommittees: "/shugiin/commitee",
  
  // Speeches
  speeches: "/speeches",
  speechesLower: "/speeches/lower",
  speechesUpper: "/speeches/upper",
  speechSummary: (party: string, reprName: string) => `/speeches/summary/${party}/${reprName}`,
  
  // Manifesto
  manifestoParties: "/manifesto/parties",
  manifestoParty: (partyName: string) => `/manifesto/party/${encodeURIComponent(partyName)}`,
  
  // Stats
  positionStats: "/stats/position",
  
  // Meetings
  sangiinMeetingNames: "/sangiin/meeting_names",
  sangiinMeetingVotes: (meetingName: string) => `/sangiin/sangiin_meeting_votes/${encodeURIComponent(meetingName)}`,
  sangiinPartyOpinions: (meetingName: string, topicName: string) => 
    `/sangiin/sangiin_party_opinions/${encodeURIComponent(meetingName)}/${encodeURIComponent(topicName)}`,
} as const;

