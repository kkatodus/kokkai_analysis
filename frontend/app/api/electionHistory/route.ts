import { NextResponse } from "next/server";

const ONE_DAY_SECONDS = 86400;
const CACHE_CONTROL_1D = `public, s-maxage=${ONE_DAY_SECONDS}, stale-while-revalidate=86400`;

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
 * Proxy for backend `/electionHistory/?person_id=...`
 *
 * Backend returns JSONL (one JSON object per line). We parse it server-side and return JSON.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get("person_id");
  if (!personId) {
    return NextResponse.json({ error: "Missing query param: person_id" }, { status: 400 });
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/electionHistory/?person_id=${encodeURIComponent(personId)}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  const res = await fetch(url, { headers, next: { revalidate: ONE_DAY_SECONDS } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const text = await res.text();
  const lines = text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter(Boolean);

  try {
    const history = lines.map((l) => JSON.parse(l));
    return NextResponse.json(
      { history },
      { status: 200, headers: { "Cache-Control": CACHE_CONTROL_1D } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: "Failed to parse backend JSONL response",
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}


