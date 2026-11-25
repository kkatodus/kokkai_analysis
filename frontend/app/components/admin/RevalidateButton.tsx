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
import { Button } from "@/app/components/shared/Button";

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
          <Button size="sm" onClick={handleRevalidateHome} busy={isRevalidating}>
            {isRevalidating ? "Revalidating..." : "Revalidate Home Page"}
          </Button>
          <Button size="sm" onClick={handleRevalidateAll} busy={isRevalidating}>
            {isRevalidating ? "Revalidating..." : "Revalidate All Routes"}
          </Button>
        </div>
        {message && (
          <div className="text-body-sm text-ink-muted">{message}</div>
        )}
      </div>
    </Card>
  );
}

