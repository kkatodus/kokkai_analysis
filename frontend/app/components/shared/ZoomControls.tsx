"use client";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onReset,
  className = "",
}: ZoomControlsProps) {
  return (
    <div
      className={`absolute right-2 top-2 z-10 flex flex-col gap-1 rounded-lg border border-slate-400/30 bg-slate-900/90 p-1 shadow-lg ${className}`}
    >
      <button
        onClick={onZoomIn}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-400/40 bg-slate-800/90 text-xs text-gray-300 transition-colors hover:bg-slate-700 hover:text-gray-50"
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-400/40 bg-slate-800/90 text-xs text-gray-300 transition-colors hover:bg-slate-700 hover:text-gray-50"
        title="Zoom out"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        onClick={onReset}
        className="flex h-7 w-7 items-center justify-center rounded border border-slate-400/40 bg-slate-800/90 text-[10px] text-gray-300 transition-colors hover:bg-slate-700 hover:text-gray-50"
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        ⌂
      </button>
    </div>
  );
}

