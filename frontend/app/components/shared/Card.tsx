import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Cards, panels, side panes". Nesting stops at card → panel.

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  /** Class applied to the inner content wrapper (the element that directly wraps `children`). */
  contentClassName?: string;
}

export function Card({ children, className, contentClassName, ...rest }: CardProps) {
  return (
    <div className={cx("relative overflow-hidden rounded-2xl border border-line-subtle bg-surface p-4 text-ink", className)} {...rest}>
      <div className={cx("relative", contentClassName)}>{children}</div>
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  /** Heading level; cards on a page are h2. */
  level?: 2 | 3;
  id?: string;
}

/** h2 with the cyan bullet, optional subtitle, actions on the right that wrap under the title when narrow. */
export function CardHeader({ title, subtitle, action, level = 2, id }: CardHeaderProps) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0 flex-1 basis-60">
        <H id={id} className="flex items-start gap-2 text-title-md text-ink-strong">
          {/* aligned to the first line when the title wraps */}
          <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
          {title}
        </H>
        {subtitle && <p className="mt-0.5 text-body-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

/** Groups content inside a card. Does not contain another bordered box. */
export function Panel({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cx("rounded-xl border border-line-subtle bg-surface p-3", className)} {...rest}>
      {children}
    </div>
  );
}

const levelSize = { 1: "text-headline-md", 2: "text-title-md", 3: "text-title-sm", 4: "text-label-md" } as const;
const namedSize = {
  display: "text-display",
  "headline-lg": "text-headline-lg",
  "headline-md": "text-headline-md",
  "headline-sm": "text-headline-sm",
  "title-md": "text-title-md",
  "title-sm": "text-title-sm",
  "label-md": "text-label-md",
} as const;

/** Real headings instead of styled divs. `size` overrides the default size for the level. */
export function Heading({
  level,
  size,
  children,
  className,
  id,
}: {
  level: 1 | 2 | 3 | 4;
  size?: keyof typeof namedSize;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const H = `h${level}` as "h1" | "h2" | "h3" | "h4";
  return (
    <H id={id} className={cx(size ? namedSize[size] : levelSize[level], "text-ink-strong", className)}>
      {children}
    </H>
  );
}
