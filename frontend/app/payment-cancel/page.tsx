import { TrackOnMount } from "@/app/components/analytics/TrackOnMount";
import { ButtonLink } from "@/app/components/shared/Button";
import { Heading } from "@/app/components/shared/Card";
import { PageShell } from "@/app/components/shared/PageShell";
import { SiteHeader } from "@/app/components/shared/SiteHeader";

export const dynamic = "force-dynamic";

export default function PaymentCancelPage() {
  return (
    // the card's first button is this view's one primary action, so the header's is secondary
    <PageShell header={<SiteHeader ctaVariant="secondary" />} mainClassName="flex items-center justify-center py-12">
      <TrackOnMount event="PaymentCancel" properties={{ location: "payment-cancel" }} />
      <div className="w-full max-w-lg rounded-2xl border border-line-subtle bg-surface p-6">
        <Heading level={1} size="headline-sm">お支払いがキャンセルされました</Heading>
        <p className="mt-2 text-body-lg text-ink">お支払いは完了していません。もう一度お試しいただくか、ダッシュボードに戻ってください。</p>

        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/app?open=donate" variant="primary" className="w-full">
            募金画面へ戻る
          </ButtonLink>
          <ButtonLink href="/app" variant="secondary" className="w-full">
            ダッシュボードへ戻る
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
