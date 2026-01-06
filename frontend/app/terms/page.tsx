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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-50">利用規約</h1>
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
          <Section title="第1条（適用）">
            <p>本規約は、利用者（以下「ユーザ」）が本サービスを利用する一切の行為に適用されます。</p>
          </Section>

          <Section title="第2条（運営主体）">
            <p>本サービスは個人事業主 加藤 賢（以下「事業主」）が運営します。</p>
          </Section>

          <Section title="第3条（利用形態）">
            <ul className="list-disc space-y-1 pl-5">
              <li>ユーザ登録は不要です。</li>
              <li>
                募金時のみ Stripe 決済画面で <span className="font-semibold text-gray-100">任意</span> で氏名・メールアドレスを入力できます。
              </li>
            </ul>
          </Section>

          <Section title="第4条（禁止事項）">
            <ul className="list-disc space-y-1 pl-5">
              <li>法令または公序良俗に反する行為</li>
              <li>本サービスのネットワーク・システムへの不正アクセス</li>
              <li>本サービスのデータの無断転載・再販</li>
              <li>選挙運動や政治資金規正法等に抵触する恐れのある寄付の勧誘</li>
            </ul>
          </Section>

          <Section title="第5条（知的財産権）">
            <p>
              本サービス上のコンテンツの著作権等は事業主または正当な権利者に帰属します。API等による再配信には事前の書面許諾が必要です。
            </p>
          </Section>

          <Section title="第6条（募金／寄付）">
            <ul className="list-disc space-y-1 pl-5">
              <li>ユーザは任意の金額を募金として支払えます。</li>
              <li>原則返金不可。ただし二重決済等のシステム不具合が判明した場合は返金します。</li>
              <li>募金は対価性を欠き、ユーザは本サービスに対する持分や議決権を取得しません。</li>
            </ul>
          </Section>

          <Section title="第7条（免責事項）">
            <ul className="list-disc space-y-1 pl-5">
              <li>国会議事録等の情報の正確性・完全性を保証しません。</li>
              <li>
                本サービス利用に起因してユーザに生じた損害について、事業主に故意または重過失がある場合を除き責任を負いません。
              </li>
            </ul>
          </Section>

          <Section title="第8条（サービスの変更・中断・終了）">
            <p>事業主は事前通知なくサービスの全部または一部を変更・中断・終了することがあります。</p>
          </Section>

          <Section title="第9条（準拠法・裁判管轄）">
            <p>
              本規約は日本法を準拠法とし、紛争が生じた場合は東京地方裁判所を第一審の専属的合意管轄裁判所とします。
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


