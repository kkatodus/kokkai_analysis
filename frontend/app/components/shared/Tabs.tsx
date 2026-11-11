"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Tabs and segmented controls": a pill track holding pill segments.
const track = "inline-flex max-w-full shrink-0 items-center gap-0.5 rounded-full border border-line bg-surface-raised p-0.5";
const segment = (selected: boolean, size: "sm" | "md") =>
  cx(
    "hit-target inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full text-label-md transition-colors duration-150",
    size === "md" ? "h-7 px-3" : "h-6 px-2.5 text-label-sm",
    selected ? "bg-primary-soft text-on-primary-soft" : "text-ink-muted hover:bg-surface-hover hover:text-ink-strong",
    "disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-transparent",
  );

export type TabItem<T extends string> = { value: T; label: ReactNode; disabled?: boolean };

type TabsProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Japanese name of the tab list. */
  label: string;
  /** Prefix for tab / panel ids: tabs are `${idBase}-tab-${value}`, panels `${idBase}-panel-${value}`. */
  idBase: string;
  size?: "sm" | "md";
  className?: string;
};

/** Views of one object (発言 / やり取り / 選挙履歴 / 立場). Arrow keys move between tabs. */
export function Tabs<T extends string>({ items, value, onChange, label, idBase, size = "md", className }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = items.filter((i) => !i.disabled);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = enabled.findIndex((i) => i.value === value);
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (idx + 1) % enabled.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + enabled.length) % enabled.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    if (next === null) return;
    e.preventDefault();
    const target = enabled[next];
    onChange(target.value);
    refs.current[items.indexOf(target)]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cx(track, className)} onKeyDown={onKeyDown}>
      {items.map((item, i) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${item.value}`}
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${item.value}`}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={segment(selected, size)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Wraps the content of one tab; pair with `Tabs` using the same idBase. */
export function TabPanel({ idBase, value, children, className }: { idBase: string; value: string; children: ReactNode; className?: string }) {
  return (
    <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className={className}>
      {children}
    </div>
  );
}

type SegmentedProps<T extends string> = {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Japanese name of the option group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
};

/** Display options (1D / 2D, 全議員 / 現職のみ, 地図 / 比例): a labelled group of aria-pressed buttons. */
export function SegmentedControl<T extends string>({ items, value, onChange, label, size = "sm", className }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={cx(track, className)}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={selected}
            disabled={item.disabled}
            onClick={() => {
              if (!selected) onChange(item.value);
            }}
            className={segment(selected, size)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
