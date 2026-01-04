import "server-only";

import available from "@/app/data/available.json";

/**
 * Server-only access to the `available.json` config.
 *
 * Keeping this in `app/lib/server` ensures it won't be imported into client bundles.
 */
export function getAvailableConfig() {
  return available as unknown;
}


