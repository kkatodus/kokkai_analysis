import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Chips and badges": a chip is operable (filters, topics); 24px tall.
export const selectedClass = "border-primary-line bg-primary-soft text-on-primary-soft hover:bg-primary-soft-hover";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  /** Colour dot, e.g. the topic's palette colour. */
  dot?: string;
  children: ReactNode;
};

export function Chip({ selected = false, dot, className, children, type = "button", title, ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      title={title ?? (typeof children === "string" ? children : undefined)}
      className={cx(
        "hit-target inline-flex h-6 max-w-full shrink-0 items-center gap-1.5 rounded-full border px-2 text-label-sm transition-colors duration-150",
        selected ? selectedClass : "border-line bg-surface-raised text-ink hover:bg-surface-hover hover:text-ink-strong",
        "disabled:cursor-not-allowed disabled:text-ink-disabled",
        className,
      )}
      {...rest}
    >
      {dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      <span className="truncate">{children}</span>
    </button>
  );
}
