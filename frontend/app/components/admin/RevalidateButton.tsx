"use client";

/**
 * RevalidateButton Component
 * 
 * Admin component for manually triggering route revalidation.
 * Useful for testing or when you need to refresh cached data.
 * 
 * Note: This should be protected by authentication/authorization
 * in production environments.
 */

import { useState } from "react";
import { revalidateHomePage, revalidateParliamentRoutes } from "@/app/actions/revalidate";
import { Card, CardHeader } from "@/app/components/shared/Card";

export function RevalidateButton() {
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRevalidateHome = async () => {
    setIsRevalidating(true);
    setMessage(null);
    try {
      const result = await revalidateHomePage();
      setMessage(`✅ Revalidated: ${result.path}`);
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsRevalidating(false);
    }
  };

  const handleRevalidateAll = async () => {
    setIsRevalidating(true);
    setMessage(null);
    try {
      const result = await revalidateParliamentRoutes();
      setMessage(`✅ Revalidated ${result.paths.length} route(s)`);
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsRevalidating(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Cache Revalidation"
        subtitle="Manually refresh cached routes when new data is available"
      />
      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handleRevalidateHome}
            disabled={isRevalidating}
            className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-slate-800 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRevalidating ? "Revalidating..." : "Revalidate Home Page"}
          </button>
          <button
            onClick={handleRevalidateAll}
            disabled={isRevalidating}
            className="rounded-full border border-slate-400/40 bg-slate-900/90 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-slate-800 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRevalidating ? "Revalidating..." : "Revalidate All Routes"}
          </button>
        </div>
        {message && (
          <div className="text-xs text-gray-400">{message}</div>
        )}
      </div>
    </Card>
  );
}

