"use client";

/**
 * AuthProvider Component
 * Wraps the application with react-oidc-context AuthProvider
 * This must be a Client Component since it uses React Context
 * 
 * Uses useState + useEffect to prevent hydration mismatches by only
 * initializing the OIDC provider on the client side
 * 
 * CRITICAL: We must NOT remount the provider during OAuth flow to preserve state.
 * The provider is initialized with config immediately on client-side mount.
 */

import { ReactNode, useState, useEffect, useMemo, useCallback } from "react";
import { AuthProvider as OidcAuthProvider } from "react-oidc-context";
import { getCognitoAuthConfig } from "@/app/lib/config/auth";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isMounted, setIsMounted] = useState(false);
  
  // Get config immediately on client side - don't wait for useEffect
  // This ensures the provider is initialized with correct config from the start
  const config = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return getCognitoAuthConfig();
    } catch (error) {
      console.error("Failed to initialize auth config:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Log the redirect URI to help debug state matching issues
  useEffect(() => {
    if (config && isMounted) {
      console.log("AuthProvider initialized with redirect_uri:", config.redirect_uri);
      console.log("Current window location:", window.location.href);
    }
  }, [config, isMounted]);

  // Callback handler to clean up URL after successful sign-in
  // This is critical - it removes OAuth parameters from URL after callback
  // Using useCallback to ensure stable reference
  const onSigninCallback = useCallback(() => {
    // Remove OAuth code and state parameters from URL after successful callback
    if (typeof window !== "undefined") {
      console.log("onSigninCallback: Cleaning up URL parameters");
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      url.searchParams.delete("session_state");
      
      // Update URL without page reload
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  // Callback handler for signout - cleans up URL after logout redirect
  const onSignoutCallback = useCallback(() => {
    if (typeof window !== "undefined") {
      console.log("onSignoutCallback: User signed out, cleaning up");
      // Remove any logout-related parameters from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("logout");
      url.searchParams.delete("state");
      
      // Update URL without page reload
      window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  // Match function to detect signout callback
  const matchSignoutCallback = useCallback((args: any) => {
    if (!config || typeof window === "undefined") return false;
    // Check if current URL matches the post_logout_redirect_uri
    return window.location.href.startsWith(config.redirect_uri);
  }, [config]);

  // Always call all hooks in the same order, then conditionally render
  // This ensures we follow the Rules of Hooks
  const authority = config?.authority || "";
  const client_id = config?.client_id || "";
  const redirect_uri = config?.redirect_uri || (typeof window !== "undefined" ? `${window.location.origin}/` : "");
  const scope = config?.scope || "openid";

  return (
    <OidcAuthProvider
      authority={authority}
      client_id={client_id}
      redirect_uri={redirect_uri}
      response_type="code"
      scope={scope}
      onSigninCallback={onSigninCallback}
      onSignoutCallback={onSignoutCallback}
      matchSignoutCallback={matchSignoutCallback}
    >
      {children}
    </OidcAuthProvider>
  );
}

