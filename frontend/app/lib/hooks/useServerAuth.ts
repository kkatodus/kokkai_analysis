/**
 * Client-Side Hook for Server-Side Authentication
 * 
 * This hook allows Client Components to check server-side authentication status
 * without causing hydration errors. It uses server actions to verify tokens
 * server-side, ensuring secrets are never exposed to the client.
 * 
 * Usage:
 * ```typescript
 * "use client";
 * 
 * import { useServerAuth } from "@/app/lib/hooks/useServerAuth";
 * 
 * export function MyComponent() {
 *   const { isAuthenticated, user, isLoading, error } = useServerAuth();
 *   
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!isAuthenticated) return <div>Please sign in</div>;
 *   
 *   return <div>Welcome, {user?.email}</div>;
 * }
 * ```
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/lib/hooks/useAuth";
import type { VerifiedUser } from "@/app/lib/server/auth";

/**
 * Server-side authentication state (from client perspective)
 */
export interface ServerAuthState {
  isAuthenticated: boolean;
  user: VerifiedUser | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to check server-side authentication status
 * 
 * This hook:
 * 1. Gets the ID token from the client-side auth context
 * 2. Sends it to a server action for verification
 * 3. Returns server-verified authentication state
 * 
 * This avoids hydration errors because:
 * - Initial state is always "loading" (no mismatch)
 * - Server verification happens after mount
 * - No secrets are exposed to the client
 */
export function useServerAuth(): ServerAuthState & {
  refetch: () => Promise<void>;
} {
  const { user: clientUser, isAuthenticated: clientIsAuthenticated } = useAuth();
  const [serverAuth, setServerAuth] = useState<ServerAuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
    error: null,
  });

  const checkServerAuth = useCallback(async () => {
    // If client-side auth says not authenticated, skip server check
    if (!clientIsAuthenticated || !clientUser?.id_token) {
      setServerAuth({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    try {
      setServerAuth((prev) => ({ ...prev, isLoading: true, error: null }));

      // Verify token server-side using server action
      // The server action will extract the token from the Authorization header
      // We need to pass it via a custom header or use the API route
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clientUser.id_token}`,
        },
        body: JSON.stringify({
          token: clientUser.id_token,
          tokenType: "id",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Authentication verification failed");
      }

      const data = await response.json();

      if (data.valid && data.user) {
        setServerAuth({
          isAuthenticated: true,
          user: data.user,
          isLoading: false,
          error: null,
        });
      } else {
        setServerAuth({
          isAuthenticated: false,
          user: null,
          isLoading: false,
          error: data.error || "Authentication failed",
        });
      }
    } catch (error) {
      console.error("Error checking server auth:", error);
      setServerAuth({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [clientUser, clientIsAuthenticated]);

  useEffect(() => {
    // Only check server auth if client-side auth is available
    if (clientIsAuthenticated && clientUser?.id_token) {
      checkServerAuth();
    } else {
      setServerAuth({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, [clientIsAuthenticated, clientUser, checkServerAuth]);

  return {
    ...serverAuth,
    refetch: checkServerAuth,
  };
}

