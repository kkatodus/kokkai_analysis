import { NextResponse } from "next/server";

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;
const CACHE_CONTROL_7D = `public, s-maxage=${SEVEN_DAYS_SECONDS}, stale-while-revalidate=86400`;

function normalizeBaseUrl(baseUrl: string): string {
  // Ensure absolute URL for server-side fetch (Node/undici requires a scheme).
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

function getBackendBaseUrl(): string {
  // Prefer server-only var; fall back to public API url for convenience.
  const fromEnv = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return "http://localhost:8000";
}

export const revalidate = 86400;

export async function GET() {
  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/donors/`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Server-only: never expose this value to the client.
  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  const res = await fetch(url, { headers, next: { revalidate: SEVEN_DAYS_SECONDS } });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Backend request failed: ${res.status} ${res.statusText}` },
      { status: 502, headers: { "Cache-Control": "no-store", "Cache-Tag": "donors" } }
    );
  }

  const data: unknown = await res.json();
  const donors = (data as any)?.donors;
  if (!Array.isArray(donors)) {
    return NextResponse.json(
      { error: "Unexpected backend response shape", data },
      { status: 502, headers: { "Cache-Control": "no-store", "Cache-Tag": "donors" } }
    );
  }

  return NextResponse.json(
    { donors },
    { status: 200, headers: { "Cache-Control": CACHE_CONTROL_7D, "Cache-Tag": "donors" } }
  );
}


