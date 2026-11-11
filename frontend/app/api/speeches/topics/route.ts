import { NextResponse } from "next/server";

/** Topic words change only when experiment_config.json does; cache for an hour. */
export const revalidate = 3600;
const CACHE_CONTROL_1H = "public, s-maxage=3600, stale-while-revalidate=600";

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

/**
 * Proxy for backend `/speeches/topics` (specs/topic-keyword-highlight §5)
 */
export async function GET() {
  const url = `${getBackendBaseUrl()}/speeches/topics`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    const text = await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    try {
      const data = JSON.parse(text) as unknown;
      return NextResponse.json(data, { status: 200, headers: { "Cache-Control": CACHE_CONTROL_1H } });
    } catch {
      return NextResponse.json(
        { error: "Backend returned non-JSON response", raw: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to reach backend", message: e instanceof Error ? e.message : String(e) },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
