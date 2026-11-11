"use client";

/** §5.8 — 一人で運営: support copy, donate + dashboard CTAs, and the site footer. */

import Link from "next/link";
import { BsTwitterX, BsYoutube } from "react-icons/bs";
import { track } from "./track";

export function SupportSection() {
  return (
    <section id="support" className="relative mx-auto w-full max-w-3xl px-4 pb-10 pt-14 sm:pt-20">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-800/80 to-[#020617] p-6 shadow-2xl sm:p-10">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-linear-to-r from-cyan-500/20 to-indigo-600/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl font-semibold text-gray-50 sm:text-3xl">このサイトは、一人で運営しています。</h2>
          <p className="mt-4 text-base leading-relaxed text-gray-300">
            KOKKAI DOC は個人が趣味として開発・運営している非営利プロジェクトです。会議録の取得、AIによる分類、サーバー代は自己負担です。続けていくために、ご寄付はいつでも歓迎です。金額にかかわらず、大きな励みになります。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app?open=donate"
              onClick={() => track("LandingCTA", { cta: "donate", location: "support" })}
              className="inline-flex items-center justify-center rounded-full border border-cyan-400/30 bg-linear-to-br from-cyan-500/30 to-indigo-600/30 px-6 py-3 text-sm font-semibold text-cyan-50 shadow-lg shadow-cyan-500/20 transition hover:border-cyan-400/50 hover:from-cyan-500/40 hover:to-indigo-600/40"
            >
              募金について見る
            </Link>
            <Link
              href="/app"
              onClick={() => track("LandingCTA", { cta: "open_app", location: "support" })}
              className="inline-flex items-center justify-center rounded-full border border-slate-400/25 bg-slate-900/40 px-6 py-3 text-sm font-semibold text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
            >
              ダッシュボードを開く
            </Link>
          </div>
        </div>
      </div>

      <footer className="mt-10 flex flex-col gap-4 border-t border-white/5 pt-6 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/about" onClick={() => track("LandingCTA", { cta: "about", location: "footer" })} className="hover:text-gray-200">
            このプロジェクトについて
          </Link>
          <Link href="/privacy" className="hover:text-gray-200">
            プライバシーポリシー
          </Link>
          <Link href="/terms" className="hover:text-gray-200">
            利用規約
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="https://x.com/kokkaidoc" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-gray-200">
            <BsTwitterX className="h-3 w-3" />
            @kokkaidoc
          </a>
          <a href="https://www.youtube.com/@kokkaidoc_no_naka" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-gray-200">
            <BsYoutube className="h-3.5 w-3.5" />
            @kokkaidoc_no_naka
          </a>
          <span>kokkai.doc[アット]gmail.com</span>
        </div>
      </footer>
      <p className="mt-4 text-[10px] text-gray-600">
        地図の都道府県の形は svg-maps/japan（CC BY 4.0）を簡略化したものです。ページ内の議員・政党・発言はすべて架空のサンプルです。
      </p>
    </section>
  );
}
