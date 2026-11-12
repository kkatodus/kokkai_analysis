"use client";

/** Sticky landing header (specs/landing-page §5): transparent over the hero, solid surface after 80 px of scroll. */

import { useEffect, useState } from "react";
import { ButtonLink } from "@/app/components/shared/Button";
import { cx } from "@/app/components/shared/cx";
import { SiteBrand } from "@/app/components/shared/SiteHeader";
import { LinkPending } from "./LinkPending";
import { track } from "./track";

export function LandingHeader() {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    // z-sticky (10) is enough: the tour panel below is itself sticky, so the stages' local z-indexes stay inside it
    <header className={cx("sticky top-0 z-(--z-sticky) border-b transition-colors duration-200", solid ? "border-line-subtle bg-surface" : "border-transparent bg-transparent")}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <SiteBrand />
        <nav aria-label="サイト内の移動" className="flex items-center gap-2">
          <ButtonLink
            href="/about"
            variant="ghost"
            size="sm"
            onClick={() => track("LandingCTA", { cta: "about", location: "header" })}
            className="max-sm:hidden"
          >
            このプロジェクトについて
          </ButtonLink>
          {/* secondary: the hero's ダッシュボードを開く stays on screen through the tour and is the one primary */}
          <ButtonLink href="/app" variant="secondary" size="sm" onClick={() => track("LandingCTA", { cta: "open_app", location: "header" })}>
            <LinkPending>ダッシュボードを開く</LinkPending>
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
