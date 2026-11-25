"use client";

/** §5.8 — 一人で運営: support copy and the dashboard + donate CTAs. The site footer follows in LandingFooter. */

import { ButtonLink } from "@/app/components/shared/Button";
import { LinkPending } from "./LinkPending";
import { track } from "./track";

export function SupportSection() {
  return (
    <section id="support" aria-labelledby="support-title" className="relative mx-auto w-full max-w-6xl px-4 pt-16">
      <div className="relative max-w-4xl overflow-hidden rounded-2xl border border-line-subtle bg-linear-to-br from-surface-hover to-surface p-6 sm:p-12">
        {/* ambient glow (DESIGN.md: indigo appears only as a decorative partner) */}
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-linear-to-r from-primary/20 to-secondary/20 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 id="support-title" className="text-headline-md text-ink-strong md:text-headline-lg">
            このサイトは、一人で運営しています。
          </h2>
          <p className="mt-4 text-body-lg text-ink">
            KOKKAI DOC は個人が趣味として開発・運営している非営利プロジェクトです。会議録の取得、AIによる分類、サーバー代は自己負担です。続けていくために、ご寄付はいつでも歓迎です。金額にかかわらず、大きな励みになります。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/app" variant="primary" size="lg" onClick={() => track("LandingCTA", { cta: "open_app", location: "support" })}>
              <LinkPending>ダッシュボードを開く</LinkPending>
            </ButtonLink>
            <ButtonLink href="/app?open=donate" variant="secondary" size="lg" onClick={() => track("LandingCTA", { cta: "donate", location: "support" })}>
              <LinkPending>募金について見る</LinkPending>
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
