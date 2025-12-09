import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * API Route for Route Revalidation
 * 
 * Allows external services (backend scripts, webhooks, etc.) to trigger
 * route revalidation by calling this endpoint.
 * 
 * Usage:
 * POST /api/revalidate?path=/dashboard&secret=YOUR_SECRET
 * 
 * Security:
 * - Requires a secret token to prevent unauthorized revalidation
 * - Set NEXT_PUBLIC_REVALIDATE_SECRET in environment variables
 */

export async function POST(request: NextRequest) {
  try {
    // Get secret from query params or header
    const searchParams = request.nextUrl.searchParams;
    const secret = searchParams.get("secret") || request.headers.get("x-revalidate-secret");
    const path = searchParams.get("path");

    // Verify secret
    const expectedSecret = process.env.REVALIDATE_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: "Revalidation secret not configured" },
        { status: 500 }
      );
    }

    if (secret !== expectedSecret) {
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    // Revalidate specific path or all routes
    if (path) {
      revalidatePath(path);
      return NextResponse.json({
        revalidated: true,
        path,
        now: Date.now(),
      });
    } else {
      // Revalidate home page by default
      revalidatePath("/");
      return NextResponse.json({
        revalidated: true,
        path: "/",
        now: Date.now(),
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Error revalidating path", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for easy testing
 * Same security requirements as POST
 */
export async function GET(request: NextRequest) {
  return POST(request);
}

