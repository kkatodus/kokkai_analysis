"use client";

/** §5.1 — hero: the accountability question, two CTAs, and the search replica playing on load. */

import Link from "next/link";
import { Stage } from "./Stage";
import { track } from "./track";
import { useStagePlayback } from "./useStagePlayback";
import { SEARCH_DURATION_MS, SearchStage } from "./stages/SearchStage";

export function Hero() {
  const [frame, pb] = useStagePlayback(SEARCH_DURATION_MS, { threshold: 0.2, onSeen: () => track("LandingSectionView", { section: "hero" }) });
  return (
    <section className="relative -mt-16 overflow-hidden pt-16">
      <div aria-hidden="true" className="landing-drift pointer-events-none absolute inset-0" />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12 lg:gap-12 lg:pb-20">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-gray-400">
            <span className="h-2 w-2 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
            KOKKAI DOC
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-gray-50 sm:text-5xl">その議員、国会で何してる？</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-gray-300 sm:text-lg">
            国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app"
              onClick={() => track("LandingCTA", { cta: "open_app", location: "hero" })}
              className="inline-flex items-center justify-center rounded-full border border-cyan-400/30 bg-linear-to-br from-cyan-500/30 to-indigo-600/30 px-6 py-3 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-500/20 transition hover:border-cyan-400/50 hover:from-cyan-500/40 hover:to-indigo-600/40"
            >
              ダッシュボードを開く
            </Link>
            <Link
              href="/app?tour=1"
              onClick={() => track("LandingCTA", { cta: "tour", location: "hero" })}
              className="inline-flex items-center justify-center rounded-full border border-slate-400/25 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
            >
              使い方を見ながら試す
            </Link>
          </div>
        </div>
        <div className="lg:col-span-7">
          <Stage frame={frame} pb={pb} section="hero" description="議員検索の例：名前を打ち込むと候補が出て、選ぶと詳細パネルが開きます。" sample>
            <SearchStage pb={pb} frame={frame} />
          </Stage>
        </div>
      </div>
    </section>
  );
}
