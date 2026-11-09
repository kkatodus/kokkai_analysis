"use client";

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
  className?: string;
}

/**
 * Explicit colour → party legend shared by the scaling scatter and the district map.
 * Items are shown in the order given; callers sort by count so the big parties come first.
 */
export function PartyLegend({ items, caption, className = "" }: PartyLegendProps) {
  if (!items.length) return null;
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-300 ${className}`}
      aria-label="政党の凡例"
    >
      {caption && <span className="text-gray-400">{caption}</span>}
      {items.map((it) => (
        <span key={`${it.label}:${it.color}`} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white/50"
            style={{ backgroundColor: it.color }}
            aria-hidden
          />
          <span>{it.label}</span>
          {it.count != null && <span className="text-gray-500">{it.count}</span>}
        </span>
      ))}
    </div>
  );
}
