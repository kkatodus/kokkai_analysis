"use client";

import { READY_CAPTION, READY_LABEL, STAGES } from "./stages";

type Props = {
  stage: number;
  pct: number;
  ready: boolean;
  slow: boolean;
  reducedMotion: boolean;
};

/** Staged progress bar + checklist of the datasets being prepared (specs/dashboard-loading §5.2). */
export function LoadingProgress({ stage, pct, ready, slow, reducedMotion }: Props) {
  const current = ready ? null : STAGES[stage];
  const shown = ready ? 100 : reducedMotion ? STAGES[stage].to : pct;
  return (
    <div className="w-full">
      <div role="status" aria-live="polite" className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-gray-50 sm:text-lg">{current ? current.label : READY_LABEL}</div>
          <div className="mt-0.5 truncate text-xs text-gray-400 sm:text-sm">{current ? current.caption : READY_CAPTION}</div>
        </div>
        <div className="shrink-0 font-mono text-sm tabular-nums text-cyan-200">{Math.floor(shown)}%</div>
      </div>

      <div
        className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(shown)}
        aria-label="ダッシュボードの準備状況"
      >
        <div
          className={`h-full rounded-full bg-linear-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(34,211,238,0.6)] ${reducedMotion ? "" : "transition-[width] duration-200 ease-out"}`}
          style={{ width: `${shown}%` }}
        />
        {!ready && !reducedMotion && (
          <div className="loading-shimmer pointer-events-none absolute inset-y-0 w-1/4 bg-linear-to-r from-transparent via-white/25 to-transparent" />
        )}
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
        {STAGES.map((s, i) => {
          const done = ready || i < stage;
          const active = !ready && i === stage;
          return (
            <li key={s.label} className={`flex items-center gap-1.5 ${done ? "text-cyan-200" : active ? "text-gray-100" : "text-gray-500"}`}>
              <span
                aria-hidden="true"
                className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                  done ? "border-cyan-400/60 bg-cyan-500/20" : active ? `border-indigo-300/70 ${reducedMotion ? "" : "animate-pulse"}` : "border-slate-600"
                }`}
              >
                {done ? "✓" : ""}
              </span>
              <span className="truncate">{s.short}</span>
            </li>
          );
        })}
      </ol>

      {slow && !ready && (
        <p className="mt-4 text-xs text-amber-200/90">
          時間がかかっています。もう少しお待ちいただくか、
          <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2 hover:text-amber-100">
            再読み込み
          </button>
          してください。
        </p>
      )}
    </div>
  );
}
