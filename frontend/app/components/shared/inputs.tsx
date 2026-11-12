"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { IoClose, IoSearch } from "react-icons/io5";
import { cx } from "./cx";

// DESIGN.md "Inputs and selects": surface-control, line-strong outline, pill; 40px tall (selects 36px).
// Every field has a visible label or an aria-label; the placeholder is an example, not the label.

const field =
  "w-full rounded-full border border-line-strong bg-surface-control text-ink-strong placeholder:text-ink-muted transition-colors duration-150 hover:border-ink-muted disabled:cursor-not-allowed disabled:text-ink-disabled";

/** Visible label above a control. */
export function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-label-sm text-ink-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

type Labelled = { "aria-label"?: string; id?: string };

export const TextInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & Labelled & { size?: "sm" | "md" }>(
  function TextInput({ className, size = "md", ...rest }, ref) {
    return <input ref={ref} className={cx(field, size === "md" ? "h-10 px-4 text-body-md" : "h-8 px-3 text-label-md", className)} {...rest} />;
  },
);

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> &
  Labelled & { value: string; onValueChange: (value: string) => void };

/** type="search" with a leading icon and a clear button once text is entered. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, value, onValueChange, ...rest },
  ref,
) {
  return (
    <div className={cx("relative", className)}>
      <IoSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={cx(field, "h-10 pr-10 pl-10 text-body-md [&::-webkit-search-cancel-button]:hidden")}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="検索語を消す"
          onClick={() => onValueChange("")}
          className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted hover:bg-surface-hover hover:text-ink-strong"
        >
          <IoClose className="size-4" />
        </button>
      )}
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & Labelled & { size?: "sm" | "md" }>(
  function Select({ className, size = "md", children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cx(field, "text-ink", size === "md" ? "h-9 px-3 text-label-md" : "h-7 px-2.5 text-label-sm", className)}
        {...rest}
      >
        {children}
      </select>
    );
  },
);
