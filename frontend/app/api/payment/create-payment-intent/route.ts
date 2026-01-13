import { NextResponse } from "next/server";
import { track } from "@vercel/analytics/server";

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
  items?: unknown;
  customer?: unknown;
};

function summarizeDonationItems(items: unknown): {
  totalPrice: number | null;
  totalQty: number | null;
  sQty: number | null;
  mQty: number | null;
  lQty: number | null;
} {
  if (!items || typeof items !== "object") {
    return { totalPrice: null, totalQty: null, sQty: null, mQty: null, lQty: null };
  }

  let totalPrice = 0;
  let totalQty = 0;
  let sQty = 0;
  let mQty = 0;
  let lQty = 0;

  for (const [key, value] of Object.entries(items as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;

    const qty = typeof v.quantity === "number" && Number.isFinite(v.quantity) ? v.quantity : 0;
    const price = typeof v.price === "number" && Number.isFinite(v.price) ? v.price : 0;

    totalQty += qty;
    totalPrice += price * qty;

    if (key === "s") sQty += qty;
    if (key === "m") mQty += qty;
    if (key === "l") lQty += qty;
  }

  return { totalPrice, totalQty, sQty, mQty, lQty };
}

export async function POST(req: Request) {
  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = body.items;
  if (!items || typeof items !== "object") {
    return NextResponse.json({ error: "Missing `items`" }, { status: 400 });
  }

  try {
    const summary = summarizeDonationItems(items);
    await track("CreatePaymentIntent", {
      totalPrice: summary.totalPrice,
      totalQty: summary.totalQty,
      sQty: summary.sQty,
      mQty: summary.mQty,
      lQty: summary.lQty,
    });
  } catch {
    // Never block payment on analytics.
  }

  const baseUrl = getBackendBaseUrl();
  const url = `${baseUrl}/payment/create-payment-intent`;

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
      body: JSON.stringify({ items, customer: body.customer }),
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend request failed: ${res.status} ${res.statusText}`, details: text },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

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


