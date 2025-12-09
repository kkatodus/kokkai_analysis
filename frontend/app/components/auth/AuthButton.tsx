"use client";

/**
 * AuthButton Component
 * Displays login/logout button based on authentication state
 */

import { useAuth } from "@/app/lib/hooks/useAuth";
import { Badge } from "@/app/components/shared/Badge";
import { getCognitoAuthConfig } from "@/app/lib/config/auth";
import { useEffect, useState } from "react";

export function AuthButton() {
  const { isLoading, isAuthenticated, signIn, signOut, user, error } = useAuth();
  const [redirectUri, setRedirectUri] = useState<string | null>(null);

  useEffect(() => {
    try {
      const config = getCognitoAuthConfig();
      setRedirectUri(config.redirect_uri);
    } catch (e) {
      // Config not available
    }
  }, []);

  if (isLoading) {
    return (
      <Badge variant="default" className="text-[11px]">
        Loading...
      </Badge>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default" className="text-[11px]">
          {user.profile.email || "Signed in"}
        </Badge>
        <button
          onClick={() => signOut()}
          className="rounded-full border border-slate-400/40 bg-slate-900/90 px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-slate-800 hover:text-gray-200"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <div className="text-[10px] text-red-400 max-w-[200px] text-right">
          Auth error: {error.message || "Unknown error"}
        </div>
      )}
      {redirectUri && process.env.NODE_ENV === 'development' && (
        <div className="text-[9px] text-gray-500 max-w-[200px] text-right" title="Make sure this matches Cognito callback URLs">
          Redirect: {redirectUri}
        </div>
      )}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("Sign in button clicked");
          signIn();
        }}
        className="rounded-full border border-slate-400/40 bg-slate-900/90 px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-slate-800 hover:text-gray-200 cursor-pointer"
        type="button"
        style={{ pointerEvents: 'auto', zIndex: 10 }}
      >
        Sign in
      </button>
    </div>
  );
}

