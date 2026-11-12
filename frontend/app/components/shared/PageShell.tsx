import type { ReactNode } from "react";
import { cx } from "./cx";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

// DESIGN.md "Elevation & Depth" level 0 and "Layout": the page → surface gradient is set once here, and header,
// main and footer share one outer container (content-max 72rem, 16px gutter) so their left edges line up.

/**
 * Frame for the landing and static pages: header / main / footer landmarks on the page gradient.
 * `contained={false}` leaves width to the children (the landing page's full-bleed sections).
 */
export function PageShell({
  children,
  header = <SiteHeader />,
  footer = <SiteFooter />,
  contained = true,
  mainClassName,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  contained?: boolean;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-page to-surface text-ink">
      {header}
      <main id="main" className={cx("flex-1", contained && "mx-auto w-full max-w-6xl px-4 pt-8 sm:pt-12", mainClassName)}>
        {children}
      </main>
      {footer}
    </div>
  );
}
