"use client";

/** The shared site footer on the landing page, with click tracking and the attribution for the map and samples. */

import { SiteFooter } from "@/app/components/shared/SiteFooter";
import { track } from "./track";

export function LandingFooter() {
  return (
    <SiteFooter
      onLinkClick={(key) => {
        if (key === "about") track("LandingCTA", { cta: "about", location: "footer" });
      }}
      note="地図の都道府県の形は svg-maps/japan（CC BY 4.0）を簡略化したものです。ページ内の議員・政党・発言はすべて架空のサンプルです。"
    />
  );
}
