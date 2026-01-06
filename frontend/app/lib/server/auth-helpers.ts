/**
 * Server-Side Authentication Helpers for Server Components
 * 
 * These utilities are designed to be used in Server Components only.
 * They avoid hydration errors by never exposing sensitive data to the client.
 * 
 * Usage in Server Components:
 * ```typescript
 * import { getServerAuth } from "@/app/lib/server/auth-helpers";
 * 
 * export default async function MyPage() {
 *   const { isAuthenticated, user } = await getServerAuth();
 *   if (!isAuthenticated) {
 *     return <div>Please sign in</div>;
 *   }
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 */

import { headers } from "next/headers";
import {
  getAuthFromRequest,
  getCurrentUser,
  isAuthenticated,
  type VerifiedUser,
} from "@/app/lib/server/auth";

/**
 * Server-side authentication state
 * Safe to use in Server Components - no hydration issues
 */
export interface ServerAuthState {
  isAuthenticated: boolean;
  user: VerifiedUser | null;
  error?: string;
}

/**
 * Get authentication state from request headers (Server Component)
 * 
 * This function reads the Authorization header from the request and verifies
 * the token server-side. It's safe to use in Server Components and will not
 * cause hydration errors since all processing happens on the server.
 * 
 * @returns Authentication state with user information if authenticated
 * 
 * @example
 * ```typescript
 * export default async function ProtectedPage() {
 *   const auth = await getServerAuth();
 *   
 *   if (!auth.isAuthenticated) {
 *     redirect("/login");
 *   }
 *   
 *   return <div>Welcome, {auth.user?.email}</div>;
 * }
 * ```
 */
export async function getServerAuth(): Promise<ServerAuthState> {
  try {
    const headersList = await headers();
    const result = await getAuthFromRequest(headersList);

    return {
      isAuthenticated: result.valid && !!result.user,
      user: result.user || null,
      error: result.error,
    };
  } catch (error) {
    console.error("Error getting server auth:", error);
    return {
      isAuthenticated: false,
      user: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current user from request (Server Component)
 * Returns null if not authenticated
 * 
 * @returns User information or null
 * 
 * @example
 * ```typescript
 * export default async function UserProfile() {
 *   const user = await getServerUser();
 *   
 *   if (!user) {
 *     return <div>Not authenticated</div>;
 *   }
 *   
 *   return <div>Email: {user.email}</div>;
 * }
 * ```
 */
export async function getServerUser(): Promise<VerifiedUser | null> {
  try {
    const headersList = await headers();
    return await getCurrentUser(headersList);
  } catch (error) {
    console.error("Error getting server user:", error);
    return null;
  }
}

/**
 * Check if user is authenticated (Server Component)
 * 
 * @returns true if authenticated, false otherwise
 * 
 * @example
 * ```typescript
 * export default async function MyPage() {
 *   const authenticated = await checkServerAuth();
 *   
 *   if (!authenticated) {
 *     redirect("/login");
 *   }
 *   
 *   return <div>Protected content</div>;
 * }
 * ```
 */
export async function checkServerAuth(): Promise<boolean> {
  try {
    const headersList = await headers();
    return await isAuthenticated(headersList);
  } catch (error) {
    console.error("Error checking server auth:", error);
    return false;
  }
}

/**
 * Require authentication in Server Component
 * Throws error or redirects if not authenticated
 * 
 * @param redirectTo - Optional redirect path if not authenticated (uses Next.js redirect)
 * @returns User information if authenticated
 * @throws Error if not authenticated and no redirect path provided
 * 
 * @example
 * ```typescript
 * import { redirect } from "next/navigation";
 * 
 * export default async function ProtectedPage() {
 *   const user = await requireServerAuth("/login");
 *   // User is guaranteed to be authenticated here
 *   return <div>Welcome, {user.email}</div>;
 * }
 * ```
 */
export async function requireServerAuth(
  redirectTo?: string
): Promise<VerifiedUser> {
  const auth = await getServerAuth();

  if (!auth.isAuthenticated || !auth.user) {
    if (redirectTo) {
      const { redirect } = await import("next/navigation");
      redirect(redirectTo);
    }
    throw new Error("Authentication required");
  }

  return auth.user;
}

