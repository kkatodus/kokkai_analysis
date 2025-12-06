"use client";

import { useEffect, useState } from "react";

interface TooltipData {
  title: string;
  meta?: string;
}

interface TooltipProps {
  data: TooltipData | null;
  x: number;
  y: number;
}

export function Tooltip({ data, x, y }: TooltipProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (data) {
      setPosition({ x: x + 10, y: y + 10 });
    }
  }, [data, x, y]);

  if (!data) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-[220px] rounded-lg border border-slate-400/35 bg-[#020617] p-1.5 text-xs text-gray-50 shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        display: data ? "block" : "none",
      }}
    >
      <div className="font-semibold">{data.title}</div>
      {data.meta && <div className="mt-0.5 text-[10px] text-gray-400">{data.meta}</div>}
    </div>
  );
}

