"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type Props = {
  event: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
};

export function TrackOnMount({ event, properties }: Props) {
  // Vercel Analytics custom event properties must be flat (no nested objects).
  const stableProps = properties ? JSON.stringify(properties) : "";

  useEffect(() => {
    try {
      track(event, properties);
    } catch {
      // Never break the UI for analytics.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, stableProps]);

  return null;
}

