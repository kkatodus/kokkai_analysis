/**
 * App-wide default ISR: 10 minutes (seconds).
 * Used by `export const revalidate`, server `fetch` `next.revalidate`, and API Route Cache-Control s-maxage.
 */
export const REVALIDATE_TEN_MINUTES = 600;

/**
 * `Cache-Control` for API routes that proxy the backend (s-maxage aligned with revalidation).
 */
export const CACHE_CONTROL_10M = `public, s-maxage=${REVALIDATE_TEN_MINUTES}, stale-while-revalidate=300`;
