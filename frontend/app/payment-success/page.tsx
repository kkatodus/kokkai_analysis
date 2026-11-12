import { TrackOnMount } from "@/app/components/analytics/TrackOnMount";
import { ButtonLink } from "@/app/components/shared/Button";
import { Heading } from "@/app/components/shared/Card";
import { PageShell } from "@/app/components/shared/PageShell";
import { SiteHeader } from "@/app/components/shared/SiteHeader";

export const dynamic = "force-dynamic";

export default function PaymentSuccessPage() {
  return (
    // the card's first button is this view's one primary action, so the header's is secondary
    <PageShell header={<SiteHeader ctaVariant="secondary" />} mainClassName="flex items-center justify-center py-12">
      <TrackOnMount event="PaymentSuccess" properties={{ location: "payment-success" }} />
      <div className="w-full max-w-lg rounded-2xl border border-line-subtle bg-surface p-6">
        <Heading level={1} size="headline-sm">お支払いが完了しました</Heading>
        <p className="mt-2 text-body-lg text-ink">ご支援ありがとうございます。KOKKAI DOC の改善に活用させていただきます。</p>

        <div className="mt-6 flex flex-col gap-2">
          <ButtonLink href="/app" variant="primary" className="w-full">
            ダッシュボードへ戻る
          </ButtonLink>
          <ButtonLink href="/app?open=donate" variant="secondary" className="w-full">
            もう一度募金する
          </ButtonLink>
        </div>
      </div>
    </PageShell>
  );
}
