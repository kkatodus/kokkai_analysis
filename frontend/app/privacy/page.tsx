import { Heading } from "@/app/components/shared/Card";
import { PageShell } from "@/app/components/shared/PageShell";
import { ProseSection } from "@/app/components/shared/ProseSection";

export const revalidate = 600;

const LINK = "rounded-sm text-link underline underline-offset-2 hover:text-on-primary-soft";

export default function PrivacyPolicyPage() {
  return (
    <PageShell>
      <Heading level={1}>プライバシーポリシー</Heading>

      <div className="mt-8 grid gap-12 sm:mt-12">
        <ProseSection title="第1条（事業主）">
          <p>
            本サービスは、<span className="font-semibold text-ink-strong">加藤 賢</span>（以下「事業主」）が運営します。
            連絡先は{" "}
            <a className={LINK} href="mailto:kokkai.doc@gmail.com">
              kokkai.doc@gmail.com
            </a>{" "}
            です。
          </p>
        </ProseSection>

        <ProseSection title="第2条（定義）">
          <p>
            「個人情報」とは、個人情報の保護に関する法律（以下「APPI」）第2条第1項に定める情報をいいます。
          </p>
        </ProseSection>

        <ProseSection title="第3条（取得する情報と方法）">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <span className="font-semibold text-ink-strong">募金（Stripe決済）時</span>：
              <br />
              任意の氏名・メールアドレス、必須の決済金額・決済日時。カード番号等は Stripe が PCI-DSS 準拠で管理し、事業主側には保存されません。
            </li>
            <li>
              <span className="font-semibold text-ink-strong">サイト閲覧時</span>：IPアドレス、ブラウザ情報、アクセス日時等のサーバログ。
              <br />
              <span className="text-ink-muted">
                Cookie は使用しません（トラッキング・広告・解析ツールを未導入）。
              </span>
            </li>
          </ol>
        </ProseSection>

        <ProseSection title="第4条（利用目的）">
          <ul className="list-disc space-y-1 pl-5">
            <li>本サービスの提供・運営・品質向上</li>
            <li>募金決済の処理、領収書発行、問い合わせ対応</li>
            <li>不正利用防止・セキュリティ確保・法令遵守</li>
          </ul>
        </ProseSection>

        <ProseSection title="第5条（第三者提供）">
          <p>以下の場合を除き、個人情報を第三者に提供しません。</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>ご本人の同意がある場合</li>
            <li>Stripe社など業務委託先に委託目的の範囲で提供する場合</li>
            <li>法令に基づき開示が必要な場合</li>
          </ol>
        </ProseSection>

        <ProseSection title="第6条（国外移転）">
          <p>
            Stripe社など海外所在事業者へ情報が移転される際は、APPI第28条等に基づき適切な保護措置を講じます。
          </p>
        </ProseSection>

        <ProseSection title="第7条（安全管理措置）">
          <ul className="list-disc space-y-1 pl-5">
            <li>TLS による通信暗号化</li>
            <li>アクセス権限管理・二要素認証</li>
            <li>定期的なログ監査・脆弱性診断</li>
          </ul>
        </ProseSection>

        <ProseSection title="第8条（開示・訂正・利用停止等の請求）">
          <p>
            本人確認のうえ合理的な期間・方法で対応します。窓口：{" "}
            <a className={LINK} href="mailto:kokkai.doc@gmail.com">
              kokkai.doc@gmail.com
            </a>
          </p>
        </ProseSection>

        <ProseSection title="第9条（変更）">
          <p>
            本ポリシーを改定する際は本サイトで告知し、重要な変更は（任意でメールアドレスを提供している場合に限り）電子メールでも通知します。
          </p>
        </ProseSection>

        <p className="text-caption text-ink-muted">付則　2025年6月6日施行／最終改定</p>
      </div>
    </PageShell>
  );
}


