"use client";

import { Legend, type LegendItem } from "@/app/components/shared/Legend";
import { CONTRIBUTION_JA, CONTRIBUTIONS } from "@/app/lib/quality";
import { SEGMENT_PALETTES } from "@/app/components/features/issue/speechSegmentation";

const ITEMS: LegendItem[] = [
  ...CONTRIBUTIONS.map((c) => ({ label: CONTRIBUTION_JA[c], color: SEGMENT_PALETTES[c].ringCss })),
  { label: "AI判定なし", color: "var(--color-line-strong)" },
];

export function IssueLegend({ className }: { className?: string }) {
  return <Legend items={ITEMS} className={className} />;
}
