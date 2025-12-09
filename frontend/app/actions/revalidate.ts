"use server";

/**
 * Server Actions for Route Revalidation
 * 
 * These actions allow you to invalidate cached routes on demand.
 * Useful when new data is available and you want to refresh specific pages.
 * 
 * Usage:
 * - Call from Server Components using form actions
 * - Call from Client Components using server actions
 * - Call from API routes or external services
 */

import { revalidatePath } from "next/cache";

/**
 * Revalidate the home page (Parliament Explorer)
 */
export async function revalidateHomePage() {
  revalidatePath("/");
  return { revalidated: true, path: "/" };
}

/**
 * Revalidate a specific path
 * @param path - Path to revalidate (e.g., "/dashboard", "/politician/123")
 */
export async function revalidatePathAction(path: string) {
  revalidatePath(path);
  return { revalidated: true, path };
}

/**
 * Revalidate multiple paths at once
 * @param paths - Array of paths to revalidate
 */
export async function revalidatePaths(paths: string[]) {
  paths.forEach((path) => {
    revalidatePath(path);
  });
  return { revalidated: true, paths };
}

/**
 * Revalidate all parliament-related routes
 * Useful when new politician data, topics, or other core data is updated
 */
export async function revalidateParliamentRoutes() {
  const paths = [
    "/", // Home page
    // Add other routes here as they're created
    // "/dashboard",
    // "/politician/[id]",
  ];

  paths.forEach((path) => {
    revalidatePath(path);
  });

  return { revalidated: true, paths };
}

/**
 * Revalidate a politician detail page
 * @param politicianId - ID of the politician
 */
export async function revalidatePolitician(politicianId: string) {
  revalidatePath(`/politician/${politicianId}`);
  revalidatePath("/"); // Also revalidate home page as it may list this politician
  return { revalidated: true, paths: [`/politician/${politicianId}`, "/"] };
}

