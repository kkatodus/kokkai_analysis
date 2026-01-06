import { NextResponse } from "next/server";

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

export const dynamic = "force-dynamic";

type IncomingBody = {
  subscription?: boolean;
  items?: unknown;
};

export async function POST(req: Request) {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const subscription = Boolean(body.subscription);
  const items = body.items;
  if (!items || typeof items !== "object") {
    return NextResponse.json({ error: "Missing `items`" }, { status: 400 });
  }

  const baseUrl = getBackendBaseUrl();
  const path = subscription
    ? "/payment/create-subscription-session"
    : "/payment/create-payment-session";
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
  if (apiKey) headers["X-API-KEY"] = apiKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ items }),
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Try to parse JSON (expected: { url: "..." })
    try {
      const data = JSON.parse(text) as unknown;
      return NextResponse.json(data, { status: 200, headers: { "Cache-Control": "no-store" } });
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


