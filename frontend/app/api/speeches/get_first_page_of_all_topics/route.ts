import { NextResponse } from "next/server";

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;
const CACHE_CONTROL_7D = `public, s-maxage=${SEVEN_DAYS_SECONDS}, stale-while-revalidate=86400`;

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

export const revalidate = 604800;

/**
 * Proxy for backend `/speeches/get_first_page_of_all_topics?person_id=...`
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  if (!personId) {
    return NextResponse.json({ error: "Missing query param: person_id" }, { status: 400 });
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/speeches/get_first_page_of_all_topics?person_id=${encodeURIComponent(personId)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const res = await fetch(url, { headers, next: { revalidate: SEVEN_DAYS_SECONDS } });
    const text = await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    try {
      const data = JSON.parse(text) as unknown;
      return NextResponse.json(data, { status: 200, headers: { "Cache-Control": CACHE_CONTROL_7D } });
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


