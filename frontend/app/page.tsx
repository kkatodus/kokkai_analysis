/**
 * Landing page at `/` (specs/landing-page). Static: pure UI plus bundled sample data, no backend fetch.
 * The dashboard it introduces lives at `/app`.
 */

import type { Metadata } from "next";
import { TrackOnMount } from "@/app/components/analytics/TrackOnMount";
import { FeatureTour } from "@/app/components/landing/FeatureTour";
import { Hero } from "@/app/components/landing/Hero";
import { LandingHeader } from "@/app/components/landing/LandingHeader";
import { MethodSection } from "@/app/components/landing/MethodSection";
import { SupportSection } from "@/app/components/landing/SupportSection";

export const metadata: Metadata = {
  title: "KOKKAI DOC ｜ その議員、国会で何してる？",
  description: "日本の政治を調べやすく、わかりやすく、身近に。AIをフル活用した国会発言分析プラットフォーム。",
  alternates: { canonical: "https://kokkaidoc.com/" },
  openGraph: {
    title: "KOKKAI DOC ｜ その議員、国会で何してる？",
    description: "国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。",
    url: "https://kokkaidoc.com/",
    siteName: "KOKKAI DOC",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "https://kokkaidoc.com/og-landing.png", width: 1200, height: 630, alt: "KOKKAI DOC ｜ その議員、国会で何してる？" }],
  },
  twitter: { card: "summary_large_image", site: "@kokkaidoc" },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] text-gray-100">
      <TrackOnMount event="LandingView" />
      <LandingHeader />
      <main>
        <Hero />
        <FeatureTour />
        <MethodSection />
        <SupportSection />
      </main>
    </div>
  );
}
