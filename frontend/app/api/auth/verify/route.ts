/**
 * API Route: Token Verification
 * 
 * POST /api/auth/verify
 * 
 * Verifies a JWT token from Cognito and returns user information.
 * This endpoint can be called from client-side code to verify tokens server-side.
 * 
 * Request Body:
 * {
 *   "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "tokenType": "id" | "access" (optional, defaults to "id")
 * }
 * 
 * Response:
 * {
 *   "valid": boolean,
 *   "user": { ... } | null,
 *   "error": string | undefined,
 *   "expired": boolean | undefined
 * }
 * 
 * SECURITY: Token verification happens entirely server-side.
 * No secrets are exposed to the client.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCognitoToken, extractTokenFromHeader, type TokenVerificationResult } from "@/app/lib/server/auth";

/**
 * POST /api/auth/verify
 * Verify a token from request body or Authorization header
 */
export async function POST(request: NextRequest) {
  try {
    let token: string | null = null;
    let tokenType: "id" | "access" = "id";

    // Try to get token from request body first
    try {
      const body = await request.json();
      token = body.token || null;
      tokenType = body.tokenType || "id";
    } catch {
      // If no body, try Authorization header
      const authHeader = request.headers.get("authorization");
      token = extractTokenFromHeader(authHeader);
    }

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: "No token provided. Include token in request body or Authorization header.",
        },
        { status: 400 }
      );
    }

    // Verify the token
    const result: TokenVerificationResult = await verifyCognitoToken(token, tokenType);

    if (!result.valid) {
      return NextResponse.json(result, {
        status: result.expired ? 401 : 403,
      });
    }

    // Return success with user information
    // Note: We don't return the full token payload for security
    // Only return necessary user information
    return NextResponse.json({
      valid: true,
      user: result.user,
    });
  } catch (error) {
    console.error("Error in /api/auth/verify:", error);
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/verify
 * Verify token from Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: "No authorization token provided. Use 'Authorization: Bearer <token>' header.",
        },
        { status: 400 }
      );
    }

    // Verify the token (default to ID token)
    const result: TokenVerificationResult = await verifyCognitoToken(token, "id");

    if (!result.valid) {
      return NextResponse.json(result, {
        status: result.expired ? 401 : 403,
      });
    }

    return NextResponse.json({
      valid: true,
      user: result.user,
    });
  } catch (error) {
    console.error("Error in /api/auth/verify:", error);
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

