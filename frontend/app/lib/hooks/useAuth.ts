"use client";

/**
 * Custom hook for authentication
 * Wraps react-oidc-context useAuth with additional utilities
 */

import { useAuth as useOidcAuth } from "react-oidc-context";
import { getCognitoLogoutUrl, getCognitoAuthConfig } from "@/app/lib/config/auth";
import { useMemo } from "react";

export function useAuth() {
  const auth = useOidcAuth();
  
  // Get config (may throw if env vars not set, but that's expected)
  const config = useMemo(() => {
    try {
      return getCognitoAuthConfig();
    } catch (error) {
      console.error("Auth config not available:", error);
      return null;
    }
  }, []);

  /**
   * Sign out with redirect to Cognito logout
   * Uses the same pattern as the provided snippet
   * Note: Try 'redirect_uri' parameter if 'logout_uri' doesn't work
   */
  const signOutRedirect = () => {
    if (!config || !config.client_id || !config.cognito_domain) {
      console.warn("Auth config not available or missing required values");
      return;
    }
    const logoutUri = config.logout_uri || config.redirect_uri;
    // Try 'redirect_uri' first as Cognito might expect that parameter name
    const logoutUrl = `${config.cognito_domain}/logout?client_id=${config.client_id}&redirect_uri=${encodeURIComponent(logoutUri)}`;
    console.log("Sign out redirect URL:", logoutUrl);
    window.location.href = logoutUrl;
  };

  /**
   * Sign out - clears both local storage and Cognito session
   * First clears local storage, then redirects to Cognito logout
   * This ensures the user is fully logged out and will be prompted to sign in again
   */
  const signOut = async () => {
    try {
      // First, remove user from local storage
      await auth.removeUser();
      
      // Clear any remaining OIDC state from storage
      if (typeof window !== "undefined") {
        // Clear OIDC-related storage from sessionStorage
        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key && (key.startsWith("oidc.") || key.startsWith("oidc_user:") || key.includes("oidc"))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => window.sessionStorage.removeItem(key));
        
        // Clear OIDC-related storage from localStorage
        const localKeysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith("oidc.") || key.startsWith("oidc_user:") || key.includes("oidc"))) {
            localKeysToRemove.push(key);
          }
        }
        localKeysToRemove.forEach(key => window.localStorage.removeItem(key));
      }

      // Redirect to Cognito logout to clear server-side session
      if (config && config.client_id && config.cognito_domain) {
        const logoutUri = config.logout_uri || config.redirect_uri;
        // Use 'logout_uri' as per the user's working snippet
        // Make sure this logout URI is whitelisted in Cognito App Client → Sign-out URLs
        const logoutUrl = `${config.cognito_domain}/logout?client_id=${config.client_id}&logout_uri=${encodeURIComponent(logoutUri)}`;
        console.log("Redirecting to Cognito logout:");
        console.log("  Full URL:", logoutUrl);
        console.log("  Client ID:", config.client_id);
        console.log("  Logout URI:", logoutUri);
        console.log("  Cognito Domain:", config.cognito_domain);
        console.log("⚠️ IMPORTANT: Make sure the logout URI is whitelisted in Cognito:");
        console.log("   Go to: Cognito → App integration → App client → Sign-out URLs");
        console.log("   Add:", logoutUri);
        window.location.href = logoutUrl;
      } else {
        console.warn("Cognito domain or client_id not configured, performing local signout only");
        console.warn("Config:", { 
          hasConfig: !!config, 
          hasClientId: !!config?.client_id, 
          hasDomain: !!config?.cognito_domain 
        });
        // If config is missing, just reload the page to ensure clean state
        window.location.reload();
      }
    } catch (error) {
      console.error("Sign out error:", error);
      // Fallback: remove user locally and reload
      try {
        await auth.removeUser();
      } catch (e) {
        console.error("Failed to remove user:", e);
      }
      // Reload page to ensure clean state
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    }
  };

  /**
   * Sign in redirect
   */
  const signIn = () => {
    if (!config || !config.authority || !config.client_id) {
      console.error("Cannot sign in: Auth configuration is not available. Please check your environment variables.");
      alert("Authentication is not configured. Please check your environment variables.");
      return;
    }
    
    // Check if signinRedirect is available
    if (!auth || typeof auth.signinRedirect !== 'function') {
      console.error("Cannot sign in: Auth provider is not ready.");
      alert("Authentication provider is not ready. Please try again in a moment.");
      return;
    }
    
    try {
      console.log("Attempting sign in with config:", { 
        authority: config.authority, 
        client_id: config.client_id?.substring(0, 10) + '...',
        redirect_uri: config.redirect_uri,
        scope: config.scope,
      });
      console.log("Auth provider settings:", {
        authority: auth.settings?.authority,
        client_id: auth.settings?.client_id,
        redirect_uri: auth.settings?.redirect_uri,
        scope: auth.settings?.scope,
      });
      
      // Check if redirect URI matches what Cognito expects
      console.log("⚠️ IMPORTANT: Make sure this redirect URI is whitelisted in your Cognito App Client settings:");
      console.log("   Redirect URI:", config.redirect_uri);
      console.log("   It must match EXACTLY (including trailing slash) in Cognito → App integration → App client → Callback URLs");
      
      // signinRedirect returns a Promise<void> - the redirect happens automatically
      auth.signinRedirect().catch((error) => {
        console.error("Sign in redirect error:", error);
        console.error("Full error details:", JSON.stringify(error, null, 2));
        alert(`Failed to initiate sign in: ${error instanceof Error ? error.message : 'Unknown error'}\n\nCheck the console for details.`);
      });
    } catch (error) {
      console.error("Sign in error:", error);
      alert(`Failed to initiate sign in: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

