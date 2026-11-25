"use client";

import { useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { Empty, Loading } from "@/app/components/shared/states";

/** Share as a whole percent; below 1% reads 1%未満 (DESIGN.md "Data Visualisation"). */
function sharePct(value: number, total: number): string {
  if (!total) return "0%";
  const p = (value / total) * 100;
  if (p > 0 && p < 1) return "1%未満";
  return `${Math.round(p)}%`;
}

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
      <div className="flex w-full items-center justify-center" style={{ height: size }}>
        <Loading />
      </div>
    );
  }

  if (!arcs.length) {
    return (
      <Empty message="議席のデータがありません。" className="h-[220px]" />
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
                  {a.data.label}：{a.data.value.toLocaleString()}議席（{sharePct(a.data.value, total)}）
                </title>
              </path>
            ))}
          </g>
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-caption text-ink-muted">合計</div>
            <div className="text-headline-sm text-ink-strong tabular-nums">
              {total.toLocaleString()}
              <span className="ml-0.5 text-caption text-ink-muted">議席</span>
            </div>
          </div>
        </div>
      </div>

      <ul aria-label="議席の凡例" className="grid gap-1 text-body-sm text-ink">
        {arcs
          .slice()
          .sort((a, b) => b.data.value - a.data.value)
          .map((a) => (
            <li key={`legend-${a.data.label}`} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.data.color }} />
                <span className="truncate">{a.data.label}</span>
              </div>
              <div className="shrink-0 text-data text-ink">
                {a.data.value.toLocaleString()}議席
                <span className="ml-1 text-ink-muted">（{sharePct(a.data.value, total)}）</span>
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}


