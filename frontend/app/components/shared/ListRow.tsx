import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { selectedClass } from "./Chip";
import { cx } from "./cx";

// DESIGN.md "Lists and pagers": a row is surface-raised, line, 8px radius; the whole row is one button.
// Selected rows use the selected recipe with a 2px primary leading edge.

/** Frame classes for a row. Use directly only when the row also holds its own link or button. */
export function listRowClass(selected = false, interactive = true) {
  return cx(
    "rounded-lg border transition-colors duration-150",
    selected ? cx(selectedClass, "edge-primary") : cx("border-line bg-surface-raised", interactive && "hover:bg-surface-hover"),
  );
}

/** Name line inside a row; follows the row's selected state. */
export function rowTitleClass(selected = false) {
  return cx("block truncate text-title-sm", selected ? "text-on-primary-soft" : "text-ink-strong");
}

type ListRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  children: ReactNode;
};

/** A whole-row button. Padding defaults to 12px; pass `className` to change it. */
export function ListRow({ selected = false, className, children, ...rest }: ListRowProps) {
  return (
    <button type="button" className={cx(
        "block w-full p-3 text-left",
        listRowClass(selected),
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface-raised",
        className,
      )} {...rest}>
      {children}
    </button>
  );
}

/** A row frame for rows that contain their own controls (a link, a 全文を表示 button). */
export function ListRowFrame({ selected = false, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { selected?: boolean }) {
  return (
    <div className={cx(listRowClass(selected), className)} {...rest}>
      {children}
    </div>
  );
}
