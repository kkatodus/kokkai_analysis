"use client";

/** Sticky landing header (specs/landing-page §5): transparent over the hero, frosted after 80 px of scroll. */

import Link from "next/link";
import { useEffect, useState } from "react";
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
    <header className={`sticky top-0 z-50 transition-colors duration-300 ${solid ? "border-b border-white/5 bg-[#020617]/80 backdrop-blur" : "bg-transparent"}`}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-gray-100">
          <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
          KOKKAI DOC
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/about"
            onClick={() => track("LandingCTA", { cta: "about", location: "header" })}
            className="hidden rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65 sm:inline-flex"
          >
            このプロジェクトについて
          </Link>
          <Link
            href="/app"
            onClick={() => track("LandingCTA", { cta: "open_app", location: "header" })}
            className="inline-flex items-center rounded-full border border-cyan-400/20 bg-linear-to-br from-cyan-500/20 to-indigo-600/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:border-cyan-400/40 hover:bg-cyan-500/25 hover:text-cyan-50"
          >
            <LinkPending>ダッシュボードへ</LinkPending>
          </Link>
        </nav>
      </div>
    </header>
  );
}
