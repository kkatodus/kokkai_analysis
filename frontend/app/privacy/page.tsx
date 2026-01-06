import Link from "next/link";

export const revalidate = 600000

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-400/15 bg-slate-900/30 p-5">
      <h2 className="text-base font-semibold text-gray-50">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-gray-300">{children}</div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-50">プライバシーポリシー</h1>
            <div className="mt-1 text-sm text-gray-400">KOKKAI DOC</div>
          </div>
          <Link
            href="/about"
            className="rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
          >
            このプロジェクトについてへ戻る
          </Link>
        </div>

        <div className="grid gap-3">
          <Section title="第1条（事業主）">
            <p>
              本サービスは、<span className="font-semibold text-gray-100">加藤 賢</span>（以下「事業主」）が運営します。
              連絡先は{" "}
              <a className="text-blue-300 hover:text-blue-200" href="mailto:kokkai.doc@gmail.com">
                kokkai.doc@gmail.com
              </a>{" "}
              です。
            </p>
          </Section>

          <Section title="第2条（定義）">
            <p>
              「個人情報」とは、個人情報の保護に関する法律（以下「APPI」）第2条第1項に定める情報をいいます。
            </p>
          </Section>

          <Section title="第3条（取得する情報と方法）">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <span className="font-semibold text-gray-100">募金（Stripe決済）時</span>：
                <br />
                任意の氏名・メールアドレス、必須の決済金額・決済日時。カード番号等は Stripe が PCI-DSS 準拠で管理し、事業主側には保存されません。
              </li>
              <li>
                <span className="font-semibold text-gray-100">サイト閲覧時</span>：IPアドレス、ブラウザ情報、アクセス日時等のサーバログ。
                <br />
                <span className="italic text-gray-400">
                  Cookie は使用しません（トラッキング・広告・解析ツールを未導入）。
                </span>
              </li>
            </ol>
          </Section>

          <Section title="第4条（利用目的）">
            <ul className="list-disc space-y-1 pl-5">
              <li>本サービスの提供・運営・品質向上</li>
              <li>募金決済の処理、領収書発行、問い合わせ対応</li>
              <li>不正利用防止・セキュリティ確保・法令遵守</li>
            </ul>
          </Section>

          <Section title="第5条（第三者提供）">
            <p>以下の場合を除き、個人情報を第三者に提供しません。</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>ご本人の同意がある場合</li>
              <li>Stripe社など業務委託先に委託目的の範囲で提供する場合</li>
              <li>法令に基づき開示が必要な場合</li>
            </ol>
          </Section>

          <Section title="第6条（国外移転）">
            <p>
              Stripe社など海外所在事業者へ情報が移転される際は、APPI第28条等に基づき適切な保護措置を講じます。
            </p>
          </Section>

          <Section title="第7条（安全管理措置）">
            <ul className="list-disc space-y-1 pl-5">
              <li>TLS による通信暗号化</li>
              <li>アクセス権限管理・二要素認証</li>
              <li>定期的なログ監査・脆弱性診断</li>
            </ul>
          </Section>

          <Section title="第8条（開示・訂正・利用停止等の請求）">
            <p>
              本人確認のうえ合理的な期間・方法で対応します。窓口：{" "}
              <a className="text-blue-300 hover:text-blue-200" href="mailto:kokkai.doc@gmail.com">
                kokkai.doc@gmail.com
              </a>
            </p>
          </Section>

          <Section title="第9条（変更）">
            <p>
              本ポリシーを改定する際は本サイトで告知し、重要な変更は（任意でメールアドレスを提供している場合に限り）電子メールでも通知します。
            </p>
          </Section>

          <div className="pt-2 text-xs text-gray-400">
            <span className="rounded-full border border-slate-400/15 bg-slate-900/30 px-3 py-1">
              付則　2025年6月6日施行／最終改定
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


