"use client";

interface TooltipData {
  title: string;
  meta?: string;
  /** short amber note, e.g. 根拠が少ない */
  warning?: string;
}

interface TooltipProps {
  data: TooltipData | null;
  x: number;
  y: number;
}

const MAX_W = 280;

/** DESIGN.md "Tooltips": surface-control, caption type, at most 280px wide, kept inside the viewport. */
export function Tooltip({ data, x, y }: TooltipProps) {
  if (!data) return null;
  const vw = typeof window === "undefined" ? Infinity : window.innerWidth;
  const left = Math.max(8, Math.min(x + 10, vw - MAX_W - 8));

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-(--z-tooltip) max-w-[280px] rounded-lg border border-line bg-surface-control p-2 text-caption text-ink shadow-lg"
      style={{ left: `${left}px`, top: `${y + 10}px` }}
    >
      <div className="text-label-sm text-ink-strong">{data.title}</div>
      {data.meta && <div className="mt-0.5 text-ink-muted">{data.meta}</div>}
      {data.warning && <div className="mt-0.5 text-label-sm text-on-warning-soft">{data.warning}</div>}
    </div>
  );
}
