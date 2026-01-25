"use client";

export function IssueLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
        関連 × 生産性あり
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
        関連 × 生産性なし
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-full bg-rose-500/80" />
        非関連 × 生産性なし
      </div>
    </div>
  );
}

