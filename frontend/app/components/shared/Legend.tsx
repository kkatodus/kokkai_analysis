import { cx } from "./cx";

export type LegendItem = { label: string; color: string; count?: number; hollow?: boolean };

/** Colour key for a chart: circle swatch, label and optional count (with 人 or the given unit). */
export function Legend({ items, title, unit = "", className }: { items: LegendItem[]; title?: string; unit?: string; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted", className)}>
      {title && <span>{title}</span>}
      <ul className="contents">
        {items.map((it) => (
          <li key={it.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={it.hollow ? { border: `2px solid ${it.color}` } : { backgroundColor: it.color }}
            />
            <span className="text-ink">{it.label}</span>
            {it.count !== undefined && (
              <span className="text-data">
                {it.count.toLocaleString("ja-JP")}
                {unit}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
