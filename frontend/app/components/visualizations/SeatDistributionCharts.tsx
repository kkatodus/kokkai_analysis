"use client";

import { useMemo } from "react";
import type { ParliamentMemberData, ShugiinPolitician, SangiinPolitician } from "@/app/types";
import { EmptyState } from "@/app/components/shared/EmptyState";
import { PartyPieChart, type PieDatum } from "./PartyPieChart";
import { PARTY2PARTY, PARTY2RGBCOLOR } from "@/app/lib/config/parties";

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function hashToColor(input: string): string {
  // Deterministic fallback color
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  const r = 60 + (hash % 150);
  const g = 60 + ((hash >>> 8) % 150);
  const b = 60 + ((hash >>> 16) % 150);
  return `rgb(${r}, ${g}, ${b})`;
}

function normalizeParty(raw: string | undefined | null): string {
  if (!raw) return "不明";
  return PARTY2PARTY[raw] || raw;
}

function buildSeatData(reprs: Array<ShugiinPolitician | SangiinPolitician>): PieDatum[] {
  const counts = new Map<string, number>();
  for (const r of reprs) {
    const party = normalizeParty((r as any).kaiha);
    counts.set(party, (counts.get(party) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => {
      const rgb = PARTY2RGBCOLOR[label];
      const color = rgb ? rgbToCss(rgb) : hashToColor(label);
      return { label, value, color };
    })
    .sort((a, b) => b.value - a.value);
}

export function SeatDistributionChart({
  parliamentMemberData,
  house,
}: {
  parliamentMemberData: ParliamentMemberData | null;
  house: "upper" | "lower";
}) {
  const data = useMemo(() => {
    if (!parliamentMemberData) return null;
    const reprs = house === "upper" ? parliamentMemberData.sangiin.reprs : parliamentMemberData.shugiin.reprs;
    return buildSeatData(reprs as any);
  }, [parliamentMemberData, house]);

  if (!data) return <EmptyState message="No data loaded." className="py-8" />;
  if (!data.length) return <EmptyState message="No seat data available." className="py-8" />;

  return <PartyPieChart data={data} />;
}


