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
};

export default nextConfig;
