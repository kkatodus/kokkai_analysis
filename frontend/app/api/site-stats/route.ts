import { NextResponse } from "next/server";
import { CACHE_CONTROL_10M, REVALIDATE_TEN_MINUTES } from "@/app/lib/revalidation-constants";

/**
 * Proxy for backend `/speeches/quality/site_stats` (specs/dashboard-loading §8): ~3 KB of site-wide
 * numbers for the dashboard loading cards. Fetched by the browser while /app loads.
 */
// Per request (cached by the fetch below and the CDN header), never prerendered at build: a build that
// cannot reach the backend, or runs before the file is published, would otherwise bake in an error.
export const dynamic = "force-dynamic";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `http://${trimmed}`;
}

function getBackendBaseUrl(): string {
  const fromEnv = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (fromEnv) return normalizeBaseUrl(fromEnv);
  return "http://localhost:8000";
}

export async function GET() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const res = await fetch(`${getBackendBaseUrl()}/speeches/quality/site_stats`, {
      headers,
      next: { revalidate: REVALIDATE_TEN_MINUTES },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `Backend request failed: ${res.status}` }, { status: res.status === 404 ? 404 : 502, headers: { "Cache-Control": "no-store" } });
    }
    const data = (await res.json()) as unknown;
    return NextResponse.json(data, { status: 200, headers: { "Cache-Control": CACHE_CONTROL_10M } });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to reach backend", message: e instanceof Error ? e.message : String(e) },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
