"use client";

import { useMemo } from "react";
import type { ParliamentMemberData, ShugiinPolitician, SangiinPolitician } from "@/app/types";
import { Empty } from "@/app/components/shared/states";
import { PartyPieChart, type PieDatum } from "./PartyPieChart";
import { PARTY2PARTY, PARTY2RGBCOLOR, PARTY_FALLBACK_RGB, canonicalParty } from "@/app/lib/config/parties";

function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function normalizeParty(raw: string | undefined | null): string {
  if (!raw) return "その他";
  // one short name per party in both houses (民主 → 国民, 無 → 無所属, い党 → れ新, …)
  return canonicalParty(PARTY2PARTY[raw] || raw);
}

function buildSeatData(reprs: Array<ShugiinPolitician | SangiinPolitician>): PieDatum[] {
  const counts = new Map<string, number>();
  for (const r of reprs) {
    const named = normalizeParty((r as any).kaiha);
    // parties without a palette colour are grouped as その他
    const party = PARTY2RGBCOLOR[named] ? named : "その他";
    counts.set(party, (counts.get(party) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value, color: rgbToCss(PARTY2RGBCOLOR[label] ?? PARTY_FALLBACK_RGB) }))
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

  if (!data) return <Empty message="議員データを読み込めませんでした。" />;
  if (!data.length) return <Empty message="議席のデータがありません。" />;

  return <PartyPieChart data={data} />;
}


