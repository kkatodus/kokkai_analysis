import type { ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Chips and badges": a badge is a read-only status, built from "label：value".
export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-raised text-ink",
  success: "border-transparent bg-success-soft text-on-success-soft",
  warning: "border-transparent bg-warning-soft text-on-warning-soft",
  error: "border-transparent bg-error-soft text-on-error-soft",
  info: "border-transparent bg-info-soft text-on-info-soft",
  accent: "border-primary-line bg-primary-soft text-on-primary-soft",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  /** Optional label shown before the value as "label：value". */
  label?: string;
  /** Optional colour dot (party or topic colour). */
  dot?: string;
  className?: string;
  title?: string;
}

export function Badge({ children, tone = "neutral", label, dot, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-label-sm whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      <span className="truncate">
        {label && <span className="font-normal opacity-80">{label}：</span>}
        {children}
      </span>
    </span>
  );
}
