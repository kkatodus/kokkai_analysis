import { track as vercelTrack } from "@vercel/analytics";

/** Vercel Analytics custom event that never throws (specs/landing-page §9). */
export function track(event: string, properties?: Record<string, string | number | boolean | null>) {
  try {
    vercelTrack(event, properties);
  } catch {
    // analytics must never break the page
  }
}
