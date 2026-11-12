import { useId, type ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Typography": long-form text is body-lg capped at prose-max (42rem); h2 is headline-sm.

/**
 * One section of a long-form page (about, privacy, terms): an h2 and its prose, sitting directly on the page.
 * `wide` lifts the prose-max cap for content that is not running text (a grid of media cards).
 */
export function ProseSection({ title, children, wide = false, className }: { title: ReactNode; children: ReactNode; wide?: boolean; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={className}>
      <h2 id={id} className="max-w-2xl text-headline-sm text-ink-strong">
        {title}
      </h2>
      <div className={cx("mt-3 space-y-3 text-body-lg text-ink", !wide && "max-w-2xl")}>{children}</div>
    </section>
  );
}
