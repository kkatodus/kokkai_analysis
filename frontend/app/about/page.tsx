import Link from "next/link";
import { BsTwitterX, BsYoutube } from "react-icons/bs";

export const revalidate = 600000;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-400/15 bg-slate-900/30 p-5">
      <h2 className="text-base font-semibold text-gray-50">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-gray-300">{children}</div>
    </section>
  );
}

function formatDateJa(date: string): string {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return date;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function AboutPage() {
  const mediaCoverages = [
    {
      title: "AIDBさんにて紹介していただきました！",
      description: "製作者の背景や、サイトを作った理由などについて話しました。",
      href: "https://youtu.be/SP_IJ3xxwLg?si=o6TswnPKpWvJ0Hzd",
      embed: "https://www.youtube.com/embed/SP_IJ3xxwLg?si=NbiQ3v1sy3qKd6u3",
      date: "2025-05-21",
    },
    {
      title: "Abema Primeに出演させていただきました！",
      description: "サイトの概要や活用方法についてご紹介しました。",
      href: "https://www.youtube.com/watch?v=qDOcZasG2To",
      embed: "https://www.youtube.com/embed/qDOcZasG2To?si=MR6z-APy6Qb3FaPQ",
      date: "2025-05-23",
    },
    {
      title: "KOKKAIDOCの論文がarXivに掲載されました！",
      description: "製作者の学部卒業論文がarXivに掲載されました。",
      href: "https://arxiv.org/abs/2505.07118",
	  no_visual: true,
      date: "2025-05-11",
    },
    {
      title: "KOKKAIDOCに関連する論文を国際学会でポスター発表してきました。",
      description: "カリフォルニア大学リバーサイド校で開かれたPolMeth2024学会に参加してきました。",
      href: "https://polmeth.ucr.edu/program-papers-and-panels",
      date: "2024-07-18",
	  no_visual: true,
    },
    {
      title: "学部卒業論文の発表をトロント大学の恩師の前でした様子をyoutubeにアップしました！",
      description: "英語でKOKKAIDOCの論文についてプレゼンしています。",
      href: "https://www.youtube.com/watch?v=8HOCEHbDsrE&t=181s",
      embed: "https://www.youtube.com/embed/8HOCEHbDsrE?si=B3TYzgpcSKwjGdeu",
      date: "2025-04-30",
    },
	{
	  title: "Ledge.aiさんの記事でKOKKAIDOCの紹介をしていただきました！",
	  description: "KOKKAIDOCの概要について詳しく書いていただいています。",
	  href: "https://ledge.ai/articles/kokkai_doc_ai_policy_analysis",
	  date: "2025-05-28"
	},
	{
	  title: "TECHNO EDGEさんの記事でKOKKAIDOCの紹介をしていただきました！",
	  description: "KOKKAIDOCの概要について詳しく書いていただいています。",
	  href: "https://www.techno-edge.net/article/2025/05/19/4367.html",
	  date: "2025-05-19",
	}
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-50">このプロジェクトについて</h1>
            <div className="mt-1 text-sm text-gray-400">KOKKAI DOC</div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-900/65"
          >
            トップへ戻る
          </Link>
        </div>

        <div className="grid gap-3">
          <Section title="趣旨">
            <p>
              当サイトは国会で議論されている法案について、各党がどのような投票をしているか、どのような討論をしているかを簡単に検索できるように作成されました。
              当サイトの情報が利用者の投票に役立つことを祈ります。
            </p>
          </Section>

          <Section title="引用">
            <div className="overflow-hidden rounded-xl border border-slate-400/15 bg-[#020617]">
              <div className="grid grid-cols-[1fr_1fr] gap-px bg-slate-400/15 text-xs">
                <div className="bg-slate-900/40 px-3 py-2 font-semibold text-gray-200">情報</div>
                <div className="bg-slate-900/40 px-3 py-2 font-semibold text-gray-200">情報元</div>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">投票結果（参議院）</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  参議院ホームページ
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">討論内容</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://kokkai.ndl.go.jp/api.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  国会会議録検索システム
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">過去の衆議院議員リスト</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://kokkai.sugawarataku.net/giin/rgiin.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  国会議員白書
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">参議院議員リスト</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://www.sangiin.go.jp/japanese/san60/giin/index.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  参議院ホームページ
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">衆議院議員リスト</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/011kaiha.htm"
                  target="_blank"
                  rel="noreferrer"
                >
                  衆議院ホームページ
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">選挙区ポリゴンデータ</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://gtfs-gis.jp/senkyoku/"
                  target="_blank"
                  rel="noreferrer"
                >
                  衆議院議員選挙の小選挙区の統計データ及び地図データ
                </a>

                <div className="bg-[#020617] px-3 py-2 text-gray-200">発言分析の元論文</div>
                <a
                  className="bg-[#020617] px-3 py-2 text-blue-300 hover:text-blue-200"
                  href="https://arxiv.org/pdf/2505.07118"
                  target="_blank"
                  rel="noreferrer"
                >
                  KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
                </a>
              </div>
            </div>
          </Section>

          <Section title="免責事項">
            <p>
              当サイト管理者は利用者が当サイトにて公開されている情報を用いて行う一切の行為について責任を負いません。
              当サイトの利用は各利用者の自己責任にて行っていただけます。
            </p>
			<span className="text-lg font-bold ">データの正確性、完全性、最新性について最善を尽くしていますが、誤りがある場合もあります。ご了承ください。</span>

          </Section>

          <Section title="著作権">
            <p>
              当サイトにて公開されている内容に関して、編集著作権を含む権利は当サイト管理者に帰属します。
              よって、当サイトの内容を管理者の承諾を得ずに使用することは禁止します。<br/>
            </p>
          </Section>

          <Section title="お問い合わせ/SNSアカウント">
            <div className="grid gap-2">
              <div className="text-gray-200">kokkai.doc[アット]gmail.com</div>
              <a
                href="https://x.com/kokkaidoc"
                className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200"
                target="_blank"
                rel="noreferrer"
              >
                <BsTwitterX className="text-lg" />
                <span>@kokkaidoc</span>
              </a>
              <a
                href="https://www.youtube.com/@kokkaidoc_no_naka"
                className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200"
                target="_blank"
                rel="noreferrer"
              >
                <BsYoutube className="text-lg" />
                <span>@kokkaidoc_no_naka</span>
              </a>
            </div>
          </Section>

          <Section title="メディア掲載">
            <div className="grid gap-3 md:grid-cols-2">
              {mediaCoverages.map((m) => (
                <div
                  key={m.href}
                  className="flex flex-col rounded-xl border border-slate-400/15 bg-[#020617] p-3 transition hover:border-slate-400/30 hover:bg-slate-900/40"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-200">
                      <BsYoutube className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <a
                        href={m.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-gray-50 hover:text-blue-200"
                      >
                        {m.title}
                      </a>
                      <div className="mt-0.5 text-xs text-gray-400">{m.description}</div>
                      <div className="mt-1 text-[11px] text-gray-500">{formatDateJa(m.date)}</div>
                      <div className="mt-1 truncate text-xs text-blue-300">{m.href}</div>
                    </div>
                  </div>
				  {m.href && !m.embed && !m.no_visual && (
					<div className="mt-3 overflow-hidden rounded-lg border border-slate-400/15 bg-black/20">
					<div className="relative w-full pt-[56.25%]">
					  <iframe
						className="absolute inset-0 h-full w-full"
						src={m.href}
						title={m.title}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						referrerPolicy="strict-origin-when-cross-origin"
						allowFullScreen
					  />
					</div>
				  </div>

				  )}

                  {m.embed && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-400/15 bg-black/20">
                      <div className="relative w-full pt-[56.25%]">
                        <iframe
                          className="absolute inset-0 h-full w-full"
                          src={m.embed}
                          title={m.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center gap-2 border-t border-slate-400/15 pt-4 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-blue-300 hover:text-blue-200">
              プライバシーポリシー
            </Link>
            <span className="text-slate-500">/</span>
            <Link href="/terms" className="text-blue-300 hover:text-blue-200">
              利用規約
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


