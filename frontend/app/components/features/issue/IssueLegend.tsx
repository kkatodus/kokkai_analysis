"use client";

import { CONTRIBUTION_JA, CONTRIBUTION_STYLE, CONTRIBUTIONS } from "@/app/lib/quality";

export function IssueLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
      {CONTRIBUTIONS.map((c) => (
        <div key={c} className="flex items-center gap-1">
          <span className={`inline-block h-2 w-2 rounded-full ${CONTRIBUTION_STYLE[c].dot}`} />
          {CONTRIBUTION_JA[c]}
        </div>
      ))}
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-slate-600/80" />
        AI判定なし
      </div>
    </div>
  );
}
