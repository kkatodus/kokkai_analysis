"use client";

import { Legend } from "./Legend";
import { cx } from "./cx";

export interface PartyLegendItem {
  /** Party label as shown to the user (short name). */
  label: string;
  /** Any CSS colour: named colour, hex, or rgb(). */
  color: string;
  /** How many points / districts carry this colour. */
  count?: number;
}

interface PartyLegendProps {
  items: PartyLegendItem[];
  /** Short caption shown before the chips, e.g. 「色＝政党」. */
  caption?: string;
  /** Unit after each count, e.g. 人 or 区. */
  unit?: string;
  className?: string;
}

/**
 * Explicit colour → party legend shared by the scaling scatter and the district map.
 * Items are shown in the order given; callers sort by count so the big parties come first.
 */
export function PartyLegend({ items, caption, unit = "", className }: PartyLegendProps) {
  if (!items.length) return null;
  return (
    <div role="group" aria-label="政党の凡例" className={className}>
      <Legend
        items={items}
        title={caption}
        unit={unit}
      />
    </div>
  );
}
