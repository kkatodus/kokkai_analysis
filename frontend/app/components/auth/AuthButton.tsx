"use client";

/**
 * AuthButton Component
 * Displays login/logout button based on authentication state
 */

import { useAuth } from "@/app/lib/hooks/useAuth";
import { Badge } from "@/app/components/shared/Badge";

export function AuthButton() {
  const { isLoading, isAuthenticated, signIn, signOut, user } = useAuth();

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
    <button
      onClick={() => signIn()}
      className="rounded-full border border-slate-400/40 bg-slate-900/90 px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:bg-slate-800 hover:text-gray-200"
    >
      Sign in
    </button>
  );
}

