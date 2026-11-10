import { NextResponse } from "next/server";
import { CACHE_CONTROL_10M } from "@/app/lib/revalidation-constants";
import {
  getPopularPoliticians,
  isValidPersonId,
  recordPoliticianSelection,
} from "@/app/lib/server/popularPoliticians";

/**
 * Frequently searched politicians.
 *
 * GET  → `{ items: [{ person_id, count }] }`, top 20, cached 10 minutes at the edge so
 *        Redis sees one read per region per window regardless of traffic.
 * POST → body `{ person_id }`; increments the counter for the current week.
 *        Fire-and-forget from the client; always answers quickly and never 5xx on Redis trouble.
 */

const TOP_N = 20;

export async function GET() {
  const items = await getPopularPoliticians(TOP_N);
  return NextResponse.json(
    { items },
    {
      status: 200,
      headers: {
        // Only cache non-empty results; an empty list usually means Redis is unavailable.
        "Cache-Control": items.length > 0 ? CACHE_CONTROL_10M : "no-store",
      },
    }
  );
}

export async function POST(req: Request) {
  let personId: unknown;
  try {
    const body = (await req.json()) as { person_id?: unknown };
    personId = body?.person_id;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isValidPersonId(personId)) {
    return NextResponse.json({ error: "Invalid person_id" }, { status: 400 });
  }
  const recorded = await recordPoliticianSelection(personId);
  return NextResponse.json({ ok: true, recorded }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
