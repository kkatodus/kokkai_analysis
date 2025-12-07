"use client";

/**
 * AuthGuard Component
 * Protects routes that require authentication
 * Shows loading state while checking authentication
 * Redirects to login if not authenticated
 */

import { ReactNode, useEffect } from "react";
import { useAuth } from "@/app/lib/hooks/useAuth";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isLoading, isAuthenticated, signIn } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      signIn();
    }
  }, [isLoading, isAuthenticated, signIn]);

  if (isLoading) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
          <div className="text-center">
            <div className="mb-4 text-lg text-gray-400">Loading...</div>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
        <div className="text-center">
          <div className="mb-4 text-lg text-gray-400">Redirecting to login...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

