import Link from "next/link";
import { ButtonLink, type ButtonVariant } from "./Button";
import { cx } from "./cx";

// DESIGN.md "Layout": static pages share one header; its row lines up with the page's outer container.

/** The site name with the cyan dot, linking to the landing page. */
export function SiteBrand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cx("inline-flex shrink-0 items-center gap-2 rounded-full text-title-md text-ink-strong", className)}>
      <span aria-hidden className="size-2.5 rounded-full bg-primary" />
      KOKKAI DOC
    </Link>
  );
}

/**
 * Header for about, privacy, terms and the payment pages: the site name (home) plus トップ / ダッシュボード.
 * `ctaVariant="secondary"` when the page already has its own primary button (one primary per view).
 */
export function SiteHeader({ ctaVariant = "primary" }: { ctaVariant?: ButtonVariant }) {
  return (
    <header className="border-b border-line-subtle">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <SiteBrand />
        <nav aria-label="サイト内の移動" className="flex items-center gap-2">
          <ButtonLink href="/" variant="ghost" size="sm" className="max-sm:hidden">
            トップ
          </ButtonLink>
          <ButtonLink href="/app" variant={ctaVariant} size="sm">
            ダッシュボードを開く
          </ButtonLink>
        </nav>
      </div>
    </header>
  );
}
