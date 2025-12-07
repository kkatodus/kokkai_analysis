"use client";

/**
 * Custom hook for authentication
 * Wraps react-oidc-context useAuth with additional utilities
 */

import { useAuth as useOidcAuth } from "react-oidc-context";
import { getCognitoLogoutUrl, getCognitoAuthConfig } from "@/app/lib/config/auth";

export function useAuth() {
  const auth = useOidcAuth();
  const config = getCognitoAuthConfig();

  /**
   * Sign out with redirect to Cognito logout
   */
  const signOutRedirect = () => {
    const logoutUrl = getCognitoLogoutUrl(config);
    window.location.href = logoutUrl;
  };

  /**
   * Sign out without redirect (local signout only)
   */
  const signOut = async () => {
    await auth.removeUser();
  };

  /**
   * Sign in redirect
   */
  const signIn = () => {
    auth.signinRedirect();
  };

  return {
    ...auth,
    signIn,
    signOut,
    signOutRedirect,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    user: auth.user,
  };
}

