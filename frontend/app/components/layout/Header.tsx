"use client";

import { useModal } from "@/app/lib/hooks/useModal";
import { useTutorial } from "@/app/lib/hooks/useTutorial";
import { BiDonateHeart } from "react-icons/bi";
import { FaRegCircleQuestion } from "react-icons/fa6";
import { track } from "@vercel/analytics";
import { Button, ButtonLink } from "@/app/components/shared/Button";

export function Header() {
  const { addModal } = useModal();
  const tutorial = useTutorial();
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-line-subtle bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="flex items-center gap-2 text-headline-sm text-ink-strong">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-primary" />
            KOKKAI DOC
          </h1>
          <ButtonLink
            href="/"
            variant="secondary"
            size="sm"
            onClick={() => track("Navigate", { destination: "/", location: "dashboard_header" })}
            title="トップページへ"
          >
            トップ
          </ButtonLink>
        </div>
        <p className="mt-0.5 text-body-sm text-ink-muted">日本の政治を調べやすく、わかりやすく、身近に。</p>
      </div>
      <div className="flex flex-wrap items-center gap-2" data-tour="header-actions">
        <Button
          variant="secondary"
          icon={<FaRegCircleQuestion aria-hidden className="size-3.5" />}
          onClick={() => {
            track("StartTutorial", { location: "header" });
            tutorial.start();
          }}
          title="画面の使い方を順番に案内します"
        >
          使い方
        </Button>
        <ButtonLink
          href="/about"
          variant="secondary"
          onClick={() => track("Navigate", { destination: "/about", location: "header" })}
        >
          このプロジェクトについて
        </ButtonLink>
        <Button
          variant="primary"
          icon={<BiDonateHeart aria-hidden className="size-4" />}
          onClick={() => {
            track("OpenDonationModal", { location: "header" });
            addModal("donation");
          }}
          data-tour="donate"
        >
          募金する
        </Button>
      </div>
    </header>
  );
}
