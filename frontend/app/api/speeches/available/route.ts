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

export const revalidate = 86400;

/**
 * Proxy for backend `/speeches/available?person_id=...`
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  if (!personId) {
    return NextResponse.json({ error: "Missing query param: person_id" }, { status: 400 });
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/speeches/available?person_id=${encodeURIComponent(personId)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const res = await fetch(url, { headers, next: { revalidate: SEVEN_DAYS_SECONDS } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const data: unknown = await res.json();
    const availableSpeeches = (data as any)?.available_speeches;
    if (!Array.isArray(availableSpeeches)) {
      return NextResponse.json(
        { error: "Unexpected backend response shape", data },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { available_speeches: availableSpeeches },
      { status: 200, headers: { "Cache-Control": CACHE_CONTROL_7D } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to reach backend", message: e instanceof Error ? e.message : String(e) },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}


