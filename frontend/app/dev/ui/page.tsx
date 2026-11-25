import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Gallery } from "./Gallery";

// specs/design-system §6: development-only reference for every shared component in every state.
export const metadata: Metadata = { title: "UI gallery · KOKKAI DOC", robots: { index: false } };

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Gallery />;
}
