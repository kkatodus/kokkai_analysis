"use client";

import { Badge } from "@/app/components/shared/Badge";
import { useModal } from "@/app/lib/hooks/useModal";
import { BiDonateHeart } from "react-icons/bi";

export function Header() {
  const { addModal } = useModal();
  return (
    <header className="flex items-center justify-between rounded-2xl border border-white/5 bg-linear-to-br from-gray-800 to-[#020617] px-5 py-3 shadow-2xl">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-indigo-600 shadow-lg shadow-cyan-400/90" />
          KOKKAI DOC
        </h1>
        <div className="text-[11px] text-gray-400 sm:text-[13px]">
         日本の政治を見やすく、わかりやすく、調べやすく
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => addModal("donation")}
          className="flex items-center gap-1 rounded-full border border-cyan-400/20 bg-linear-to-br from-cyan-500/20 to-indigo-600/20 px-3 py-1.5 text-xs font-medium text-cyan-100 shadow-lg shadow-cyan-500/10 transition hover:border-cyan-400/40 hover:bg-cyan-500/25 hover:text-cyan-50"
        >
          <BiDonateHeart className="h-7 w-7" /><span className="text-sm">KOKKAI DOC に<br/>募金する</span>
        </button>
      </div>
      {/* <div className="flex items-center gap-3">
        <Badge variant="default" className="text-[11px] uppercase tracking-wider">
          Ideology • Trust • Facts • Map
        </Badge>
      </div> */}
    </header>
  );
}

