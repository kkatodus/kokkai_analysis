import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Server-Side Rendering (SSR) enabled
   * This allows Server Components, server-side data fetching, and dynamic rendering.
   * 
   * NOTE: This requires deploying Next.js as a server (not static export).
   * Options:
   * - Vercel (recommended for Next.js)
   * - AWS with containerized deployment (ECS/Fargate)
   * - AWS Lambda with @vercel/next
   * - Other Node.js hosting platforms
   * 
   * To revert to static export, set `output: "export"` and convert page.tsx
   * back to a Client Component.
   */
  
  /**
   * Disable image optimization for simpler deployment.
   * Images will be served as-is from the public directory.
   * For production, consider using a CDN or external image service.
   */
  images: {
    unoptimized: true,
  },
  
  /**
   * Disable trailing slash for cleaner URLs.
   */
  trailingSlash: false,

  /**
   * The landing page lives at `/`; the dashboard moved to `/app` (specs/landing-page §4).
   * Old root links keep working: shares (`?person_id`), payment returns (`?open=donate`),
   * the Cognito OIDC callback (`?code&state`, redirect URI stays the root) and `?tour`.
   * Next.js preserves the full query string on the destination.
   * Temporary (307) so the mapping can be revisited.
   */
  async redirects() {
    const toApp = (keys: string[]) => ({
      source: "/",
      has: keys.map((key) => ({ type: "query" as const, key })),
      destination: "/app",
      permanent: false,
    });
    return [toApp(["person_id"]), toApp(["open"]), toApp(["code", "state"]), toApp(["tour"])];
  },
};

export default nextConfig;
