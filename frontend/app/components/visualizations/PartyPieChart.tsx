"use client";

import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";

export type PieDatum = {
  label: string;
  value: number;
  color: string; // any CSS color
};

type PartyPieChartProps = {
  data: PieDatum[];
  size?: number;
  innerRadius?: number;
};

export function PartyPieChart({ data, size = 220, innerRadius = 64 }: PartyPieChartProps) {
  // Avoid hydration mismatches from subtle server-vs-client float/string differences
  // in SVG path generation (d3 arc output). Render a stable placeholder on the server,
  // then draw the chart after mount on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { arcs, total } = useMemo(() => {
    const filtered = data.filter((d) => d.value > 0);
    const total = filtered.reduce((acc, d) => acc + d.value, 0);
    const pie = d3
      .pie<PieDatum>()
      .sort(null)
      .value((d) => d.value);
    return { arcs: pie(filtered), total };
  }, [data]);

  const outerRadius = size / 2 - 6;
  const arcGen = d3.arc<d3.PieArcDatum<PieDatum>>().innerRadius(innerRadius).outerRadius(outerRadius);

  if (!mounted) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-xl border border-slate-400/10 bg-slate-900/20 text-xs text-gray-400"
        style={{ height: size }}
      >
        <LoadingIndicator label="読み込み中" size="sm" />
      </div>
    );
  }

  if (!arcs.length) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center text-xs text-gray-400">
        No data
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`translate(${size / 2},${size / 2})`}>
            {arcs.map((a) => (
              <path
                key={a.data.label}
                d={arcGen(a) ?? undefined}
                fill={a.data.color}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={1}
              >
                <title>
                  {a.data.label}: {a.data.value}（{total ? Math.round((a.data.value / total) * 100) : 0}%）
                </title>
              </path>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[10px] text-gray-400">Total</div>
            <div className="text-lg font-semibold text-gray-50">{total}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-1.5 text-xs text-gray-200">
        {arcs
          .slice()
          .sort((a, b) => b.data.value - a.data.value)
          .map((a) => (
            <div key={`legend-${a.data.label}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: a.data.color }}
                />
                <span className="truncate">{a.data.label}</span>
              </div>
              <div className="shrink-0 text-gray-300">
                {a.data.value}
                <span className="ml-1 text-[10px] text-gray-500">
                  ({total ? Math.round((a.data.value / total) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}


