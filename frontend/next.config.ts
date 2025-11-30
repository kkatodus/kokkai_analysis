import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Enable static export for S3/CloudFront deployment.
   * This generates static HTML files in the 'out' directory.
   */
  output: "export",
  
  /**
   * Disable image optimization for static export.
   * Images will be served as-is from the public directory.
   * For production, consider using a CDN or external image service.
   */
  images: {
    unoptimized: true,
  },
  
  /**
   * Disable trailing slash to match S3/CloudFront behavior.
   * This ensures URLs work correctly with the static export.
   */
  trailingSlash: false,
};

export default nextConfig;
