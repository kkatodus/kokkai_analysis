"use client";

import { useModal } from "@/app/lib/hooks/useModal";
import { useTutorial } from "@/app/lib/hooks/useTutorial";
import { BiDonateHeart } from "react-icons/bi";
import { FaRegCircleQuestion } from "react-icons/fa6";
import Link from "next/link";
import { track } from "@vercel/analytics";

export function Header() {
  const { addModal } = useModal();
  const tutorial = useTutorial();
  return (
    <header className="flex items-center justify-between rounded-2xl border border-white/5 bg-linear-to-br from-gray-800 to-[#020617] px-5 py-3 shadow-2xl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-200">
          <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
          KOKKAI DOC
        </h1>
        <div className="text-[11px] text-gray-400 sm:text-[13px]">
          日本の政治を調べやすく、わかりやすく、身近に。
        </div>
      </div>
      <div className="flex items-center gap-3" data-tour="header-actions">
        <button
          type="button"
          onClick={() => {
            track("StartTutorial", { location: "header" });
            tutorial.start();
          }}
          className="flex items-center gap-1 rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-cyan-400/45 hover:bg-slate-900/65 hover:text-cyan-50"
          title="画面の使い方を順番に案内します"
        >
          <FaRegCircleQuestion className="h-3.5 w-3.5" />
          使い方
        </button>
        <Link
          href="/about"
          onClick={() =>
            track("Navigate", { destination: "/about", location: "header" })
          }
          className="rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
        >
          このプロジェクトについて
        </Link>
        <button
          type="button"
          onClick={() => {
            track("OpenDonationModal", { location: "header" });
            addModal("donation");
          }}
          className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-linear-to-br from-cyan-500/20 to-indigo-600/20 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:border-cyan-400/40 hover:bg-cyan-500/25 hover:text-cyan-50"
          data-tour="donate"
        >
          <BiDonateHeart className="h-7 w-7" />
          <span className="text-sm">
            KOKKAI DOC に<br />
            募金する
          </span>
        </button>
      </div>
    </header>
  );
}
