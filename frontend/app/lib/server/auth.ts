/**
 * Server-Side Authentication Utilities
 * 
 * SECURITY: This module handles all server-side authentication operations.
 * All secrets and sensitive operations are kept server-side only.
 * 
 * Features:
 * - JWT token verification using Cognito's public keys (JWKS)
 * - Server-side session validation
 * - User information extraction from verified tokens
 * - Protected route utilities
 * 
 * Environment Variables Required:
 * - COGNITO_USER_POOL_ID: AWS Cognito User Pool ID (server-side only, NOT NEXT_PUBLIC)
 * - COGNITO_REGION: AWS region where Cognito is deployed (server-side only, NOT NEXT_PUBLIC)
 * - COGNITO_CLIENT_ID: Cognito App Client ID (can be NEXT_PUBLIC for client, but also needed server-side)
 */

import { jwtVerify, createRemoteJWKSet, JWTPayload } from "jose";

/**
 * Server-side Cognito configuration
 * Uses server-only environment variables (no NEXT_PUBLIC prefix)
 */
interface ServerCognitoConfig {
  userPoolId: string;
  region: string;
  clientId: string;
  issuer: string;
  jwksUri: string;
}

/**
 * Get server-side Cognito configuration
 * Uses server-only environment variables for security
 * 
 * @throws Error if required environment variables are not set
 */
function getServerCognitoConfig(): ServerCognitoConfig {
  // Server-side only: Use non-NEXT_PUBLIC env vars for secrets
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.COGNITO_REGION;
  const clientId = process.env.COGNITO_CLIENT_ID || process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!userPoolId) {
    throw new Error(
      "COGNITO_USER_POOL_ID environment variable is required for server-side authentication. " +
      "This should be a server-only variable (not NEXT_PUBLIC)."
    );
  }

  if (!region) {
    throw new Error(
      "COGNITO_REGION environment variable is required for server-side authentication. " +
      "This should be a server-only variable (not NEXT_PUBLIC)."
    );
  }

  if (!clientId) {
    throw new Error(
      "COGNITO_CLIENT_ID or NEXT_PUBLIC_COGNITO_CLIENT_ID environment variable is required."
    );
  }

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
  const jwksUri = `${issuer}/.well-known/jwks.json`;

  return {
    userPoolId,
    region,
    clientId,
    issuer,
    jwksUri,
  };
}

/**
 * Cached JWKS (JSON Web Key Set) for token verification
 * This is safe to cache as Cognito's public keys don't change frequently
 */
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * Get or create the JWKS client for token verification
 */
function getJWKS() {
  if (!cachedJWKS) {
    const config = getServerCognitoConfig();
    cachedJWKS = createRemoteJWKSet(new URL(config.jwksUri));
  }
  return cachedJWKS;
}

/**
 * Verified user information extracted from JWT token
 */
export interface VerifiedUser {
  sub: string; // User ID (subject)
  email?: string;
  email_verified?: boolean;
  phone?: string;
  phone_verified?: boolean;
  "cognito:username"?: string;
  "cognito:groups"?: string[];
  token_use: "id" | "access";
  client_id: string;
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

/**
 * Result of token verification
 */
export interface TokenVerificationResult {
  valid: boolean;
  user?: VerifiedUser;
  error?: string;
  expired?: boolean;
}

/**
 * Verify a JWT token from Cognito
 * 
 * @param token - The JWT token (ID token or access token) to verify
 * @param tokenType - Type of token: "id" for ID token, "access" for access token
 * @returns Verification result with user information if valid
 */
export async function verifyCognitoToken(
  token: string,
  tokenType: "id" | "access" = "id"
): Promise<TokenVerificationResult> {
  try {
    const config = getServerCognitoConfig();
    const JWKS = getJWKS();

    // Verify the token signature and claims
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: config.issuer,
      audience: config.clientId,
    });

    // Check token use matches expected type
    if (payload.token_use !== tokenType) {
      return {
        valid: false,
        error: `Token type mismatch. Expected ${tokenType}, got ${payload.token_use}`,
      };
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        expired: true,
        error: "Token has expired",
      };
    }

    // Extract user information
    const user: VerifiedUser = {
      sub: payload.sub as string,
      email: payload.email as string | undefined,
      email_verified: payload.email_verified as boolean | undefined,
      phone: payload.phone_number as string | undefined,
      phone_verified: payload.phone_number_verified as boolean | undefined,
      "cognito:username": payload["cognito:username"] as string | undefined,
      "cognito:groups": payload["cognito:groups"] as string[] | undefined,
      token_use: payload.token_use as "id" | "access",
      client_id: payload.aud as string || config.clientId,
      exp: payload.exp as number,
      iat: payload.iat as number,
    };

    return {
      valid: true,
      user,
    };
  } catch (error) {
    if (error instanceof Error) {
      // Check if it's an expiration error
      if (error.message.includes("expired") || error.message.includes("exp")) {
        return {
          valid: false,
          expired: true,
          error: error.message,
        };
      }

      return {
        valid: false,
        error: error.message,
      };
    }

    return {
      valid: false,
      error: "Unknown error during token verification",
    };
  }
}

/**
 * Extract token from Authorization header
 * Supports "Bearer <token>" format
 * 
 * @param authHeader - Authorization header value
 * @returns Token string or null if not found
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Get authentication status from request headers
 * Verifies the token and returns user information if valid
 * 
 * @param headers - Request headers (from Next.js request)
 * @returns Verification result with user information
 */
export async function getAuthFromRequest(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<TokenVerificationResult> {
  // Handle both Headers object and plain object
  let authHeader: string | null = null;
  
  if (headers instanceof Headers) {
    authHeader = headers.get("authorization");
  } else {
    const auth = headers.authorization || headers.Authorization;
    if (typeof auth === "string") {
      authHeader = auth;
    } else if (Array.isArray(auth) && auth.length > 0) {
      authHeader = auth[0];
    }
  }

  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return {
      valid: false,
      error: "No authorization token provided",
    };
  }

  return await verifyCognitoToken(token, "id");
}

/**
 * Check if a user is authenticated (server-side)
 * 
 * @param headers - Request headers
 * @returns true if user is authenticated, false otherwise
 */
export async function isAuthenticated(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<boolean> {
  const result = await getAuthFromRequest(headers);
  return result.valid && !!result.user;
}

/**
 * Get current user from request (server-side)
 * 
 * @param headers - Request headers
 * @returns User information if authenticated, null otherwise
 */
export async function getCurrentUser(
  headers: Headers | Record<string, string | string[] | undefined>
): Promise<VerifiedUser | null> {
  const result = await getAuthFromRequest(headers);
  return result.valid && result.user ? result.user : null;
}

