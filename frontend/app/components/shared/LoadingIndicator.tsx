import React from "react";

type LoadingIndicatorProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "grid" | "dots";
  className?: string;
};

function pxForSize(size: LoadingIndicatorProps["size"]): number {
  switch (size) {
    case "sm":
      return 14;
    case "lg":
      return 28;
    case "md":
    default:
      return 20;
  }
}

export function LoadingIndicator({
  label,
  size = "md",
  variant = "grid",
  className = "",
}: LoadingIndicatorProps) {
  const px = pxForSize(size);

  if (variant === "dots") {
    return (
      <div
        className={`inline-flex items-center gap-2 text-gray-400 ${className}`}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="relative inline-flex h-4 w-10 items-center justify-between">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
        </span>
        {label ? <span className="text-xs">{label}</span> : null}
      </div>
    );
  }

  // "grid" variant — lightweight recreation of react-spinners GridLoader.
  const cell = Math.max(3, Math.floor(px / 5));
  const gap = Math.max(2, Math.floor(cell / 2));
  const delays = [
    -0.32, -0.16, 0,
    -0.16, 0, 0.16,
    0, 0.16, 0.32,
  ];

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(3, ${cell}px)`,
          gridTemplateRows: `repeat(3, ${cell}px)`,
          gap: `${gap}px`,
        }}
      >
        {delays.map((d, idx) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            className="rounded-[3px] bg-slate-400/70 animate-pulse"
            style={{ animationDelay: `${d}s` }}
          />
        ))}
      </div>
      {label ? <div className="text-xs text-gray-400">{label}</div> : null}
    </div>
  );
}


