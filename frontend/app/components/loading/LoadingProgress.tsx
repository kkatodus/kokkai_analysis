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
          <div className="truncate text-title-md text-ink-strong sm:text-headline-sm">{current ? current.label : READY_LABEL}</div>
          <div className="mt-0.5 truncate text-body-sm text-ink-muted">{current ? current.caption : READY_CAPTION}</div>
        </div>
        <div className="shrink-0 text-data text-link">{Math.floor(shown)}%</div>
      </div>

      <div
        className="relative mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(shown)}
        aria-label="ダッシュボードの準備状況"
      >
        <div
          className={`h-full rounded-full bg-linear-to-r from-primary to-secondary ${reducedMotion ? "" : "transition-[width] duration-200 ease-out"}`}
          style={{ width: `${shown}%` }}
        />
        {!ready && !reducedMotion && (
          <div className="loading-shimmer pointer-events-none absolute inset-y-0 w-1/4 bg-linear-to-r from-transparent via-ink-strong/25 to-transparent" />
        )}
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption sm:grid-cols-4">
        {STAGES.map((s, i) => {
          const done = ready || i < stage;
          const active = !ready && i === stage;
          return (
            <li key={s.label} className={`flex items-center gap-1.5 ${done ? "text-link" : active ? "text-ink-strong" : "text-ink-muted"}`}>
              <span
                aria-hidden="true"
                className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-caption leading-none ${
                  done ? "border-primary-line bg-primary-soft" : active ? `border-secondary ${reducedMotion ? "" : "animate-pulse"}` : "border-line-strong"
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
        <p className="mt-4 text-body-sm text-on-warning-soft">
          時間がかかっています。もう少しお待ちいただくか、
          <button type="button" onClick={() => window.location.reload()} className="underline underline-offset-2 hover:text-ink-strong">
            再読み込み
          </button>
          してください。
        </p>
      )}
    </div>
  );
}
