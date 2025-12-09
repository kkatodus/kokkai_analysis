/**
 * Server Actions for Authentication
 * 
 * These server actions can be called from Client Components to perform
 * server-side authentication operations without exposing secrets.
 * 
 * SECURITY: All token verification happens server-side.
 */

"use server";

import { headers } from "next/headers";
import {
  getAuthFromRequest,
  getCurrentUser,
  isAuthenticated,
  verifyCognitoToken,
  type VerifiedUser,
  type TokenVerificationResult,
} from "@/app/lib/server/auth";

/**
 * Get current authentication status
 * Can be called from Client Components to check server-side auth status
 * 
 * @returns Authentication status and user information if authenticated
 */
export async function getAuthStatus(): Promise<{
  isAuthenticated: boolean;
  user: VerifiedUser | null;
  error?: string;
}> {
  try {
    const headersList = await headers();
    const result = await getAuthFromRequest(headersList);

    return {
      isAuthenticated: result.valid && !!result.user,
      user: result.user || null,
      error: result.error,
    };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return {
      isAuthenticated: false,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current user information
 * Returns null if not authenticated
 * 
 * @returns User information or null
 */
export async function getCurrentUserAction(): Promise<VerifiedUser | null> {
  try {
    const headersList = await headers();
    return await getCurrentUser(headersList);
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * Check if user is authenticated
 * 
 * @returns true if authenticated, false otherwise
 */
export async function checkAuthentication(): Promise<boolean> {
  try {
    const headersList = await headers();
    return await isAuthenticated(headersList);
  } catch (error) {
    console.error("Error checking authentication:", error);
    return false;
  }
}

/**
 * Verify a token (server-side)
 * This can be used to verify tokens passed from the client
 * 
 * @param token - JWT token to verify
 * @param tokenType - Type of token: "id" or "access"
 * @returns Verification result
 */
export async function verifyToken(
  token: string,
  tokenType: "id" | "access" = "id"
): Promise<TokenVerificationResult> {
  try {
    return await verifyCognitoToken(token, tokenType);
  } catch (error) {
    console.error("Error verifying token:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user email (if authenticated)
 * 
 * @returns User email or null
 */
export async function getUserEmail(): Promise<string | null> {
  try {
    const user = await getCurrentUserAction();
    return user?.email || null;
  } catch (error) {
    console.error("Error getting user email:", error);
    return null;
  }
}

/**
 * Check if user belongs to a specific Cognito group
 * 
 * @param groupName - Name of the Cognito group to check
 * @returns true if user belongs to the group, false otherwise
 */
export async function isUserInGroup(groupName: string): Promise<boolean> {
  try {
    const user = await getCurrentUserAction();
    if (!user || !user["cognito:groups"]) {
      return false;
    }
    return user["cognito:groups"].includes(groupName);
  } catch (error) {
    console.error("Error checking user group:", error);
    return false;
  }
}

