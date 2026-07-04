/**
 * App-wide default ISR: 10 minutes (seconds).
 * Used for server `fetch` `next.revalidate`, API Route handlers, and Cache-Control s-maxage.
 * Route and page `export const revalidate` must be the literal `600` (Next.js static analysis).
 */
export const REVALIDATE_TEN_MINUTES = 600;

/**
 * `Cache-Control` for API routes that proxy the backend (s-maxage aligned with revalidation).
 */
export const CACHE_CONTROL_10M = `public, s-maxage=${REVALIDATE_TEN_MINUTES}, stale-while-revalidate=300`;
