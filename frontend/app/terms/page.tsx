import { Heading } from "@/app/components/shared/Card";
import { PageShell } from "@/app/components/shared/PageShell";
import { ProseSection } from "@/app/components/shared/ProseSection";

export const revalidate = 600;

export default function TermsPage() {
  return (
    <PageShell>
      <Heading level={1}>利用規約</Heading>

      <div className="mt-8 grid gap-12 sm:mt-12">
        <ProseSection title="第1条（適用）">
          <p>本規約は、利用者（以下「ユーザ」）が本サービスを利用する一切の行為に適用されます。</p>
        </ProseSection>

        <ProseSection title="第2条（運営主体）">
          <p>本サービスは個人事業主 加藤 賢（以下「事業主」）が運営します。</p>
        </ProseSection>

        <ProseSection title="第3条（利用形態）">
          <ul className="list-disc space-y-1 pl-5">
            <li>ユーザ登録は不要です。</li>
            <li>
              募金時のみ Stripe 決済画面で <span className="font-semibold text-ink-strong">任意</span> で氏名・メールアドレスを入力できます。
            </li>
          </ul>
        </ProseSection>

        <ProseSection title="第4条（禁止事項）">
          <ul className="list-disc space-y-1 pl-5">
            <li>法令または公序良俗に反する行為</li>
            <li>本サービスのネットワーク・システムへの不正アクセス</li>
            <li>本サービスのデータの無断転載・再販</li>
            <li>選挙運動や政治資金規正法等に抵触する恐れのある寄付の勧誘</li>
          </ul>
        </ProseSection>

        <ProseSection title="第5条（知的財産権）">
          <p>
            本サービス上のコンテンツの著作権等は事業主または正当な権利者に帰属します。API等による再配信には事前の書面許諾が必要です。
          </p>
        </ProseSection>

        <ProseSection title="第6条（募金／寄付）">
          <ul className="list-disc space-y-1 pl-5">
            <li>ユーザは任意の金額を募金として支払えます。</li>
            <li>原則返金不可。ただし二重決済等のシステム不具合が判明した場合は返金します。</li>
            <li>募金は対価性を欠き、ユーザは本サービスに対する持分や議決権を取得しません。</li>
          </ul>
        </ProseSection>

        <ProseSection title="第7条（免責事項）">
          <ul className="list-disc space-y-1 pl-5">
            <li>国会議事録等の情報の正確性・完全性を保証しません。</li>
            <li>
              本サービス利用に起因してユーザに生じた損害について、事業主に故意または重過失がある場合を除き責任を負いません。
            </li>
          </ul>
        </ProseSection>

        <ProseSection title="第8条（サービスの変更・中断・終了）">
          <p>事業主は事前通知なくサービスの全部または一部を変更・中断・終了することがあります。</p>
        </ProseSection>

        <ProseSection title="第9条（準拠法・裁判管轄）">
          <p>
            本規約は日本法を準拠法とし、紛争が生じた場合は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </p>
        </ProseSection>

        <p className="text-caption text-ink-muted">付則　2025年6月6日施行／最終改定</p>
      </div>
    </PageShell>
  );
}


