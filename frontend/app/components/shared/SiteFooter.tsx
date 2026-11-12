import Link from "next/link";
import type { ReactNode } from "react";
import { BsTwitterX, BsYoutube } from "react-icons/bs";

// DESIGN.md "Layout": one footer for the landing and static pages, inside the same outer container as the header.

export type SiteFooterLink = "top" | "about" | "privacy" | "terms" | "x" | "youtube";

const PAGES: { key: SiteFooterLink; href: string; label: string }[] = [
  { key: "top", href: "/", label: "トップ" },
  { key: "about", href: "/about", label: "このプロジェクトについて" },
  { key: "privacy", href: "/privacy", label: "プライバシーポリシー" },
  { key: "terms", href: "/terms", label: "利用規約" },
];

const link = "rounded-sm text-ink-muted transition-colors duration-150 hover:text-ink-strong";

/**
 * Site links, social accounts and the contact address. `onLinkClick` lets a client caller track clicks;
 * `note` is a fine-print line under the links (attributions).
 */
export function SiteFooter({ onLinkClick, note }: { onLinkClick?: (key: SiteFooterLink) => void; note?: ReactNode }) {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 pt-16">
      <div className="flex flex-col gap-4 border-t border-line-subtle pt-6 text-caption sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="サイト情報" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {PAGES.map((p) => (
            <Link key={p.key} href={p.href} onClick={onLinkClick && (() => onLinkClick(p.key))} className={link}>
              {p.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="https://x.com/kokkaidoc" target="_blank" rel="noreferrer" onClick={onLinkClick && (() => onLinkClick("x"))} className={`flex items-center gap-1 ${link}`}>
            <BsTwitterX aria-hidden className="size-3" />
            @kokkaidoc
          </a>
          <a
            href="https://www.youtube.com/@kokkaidoc_no_naka"
            target="_blank"
            rel="noreferrer"
            onClick={onLinkClick && (() => onLinkClick("youtube"))}
            className={`flex items-center gap-1 ${link}`}
          >
            <BsYoutube aria-hidden className="size-3.5" />
            @kokkaidoc_no_naka
          </a>
          <span className="text-ink-muted">kokkai.doc[アット]gmail.com</span>
        </div>
      </div>
      {note && <p className="mt-4 text-caption text-ink-muted">{note}</p>}
    </footer>
  );
}
