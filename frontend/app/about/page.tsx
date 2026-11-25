import { BsGlobe, BsTwitterX, BsYoutube } from "react-icons/bs";
import { Heading } from "@/app/components/shared/Card";
import { PageShell } from "@/app/components/shared/PageShell";
import { ProseSection } from "@/app/components/shared/ProseSection";

export const revalidate = 600;

const LINK = "rounded-sm text-link underline underline-offset-2 hover:text-on-primary-soft";

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
      logo: "youtube"
    },
    {
      title: "Abema Primeに出演させていただきました！",
      description: "サイトの概要や活用方法についてご紹介しました。",
      href: "https://www.youtube.com/watch?v=qDOcZasG2To",
      embed: "https://www.youtube.com/embed/qDOcZasG2To?si=MR6z-APy6Qb3FaPQ",
      date: "2025-05-23",
      logo: "youtube"
    },
    {
      title: "KOKKAIDOCの論文がarXivに掲載されました！",
      description: "製作者の学部卒業論文がarXivに掲載されました。",
      href: "https://arxiv.org/abs/2505.07118",
      no_visual: true,
      date: "2025-05-11",
      logo: "website"
    },
    {
      title: "KOKKAIDOCに関連する論文を国際学会でポスター発表してきました。",
      description: "カリフォルニア大学リバーサイド校で開かれたPolMeth2024学会に参加してきました。",
      href: "https://polmeth.ucr.edu/program-papers-and-panels",
      date: "2024-07-18",
      no_visual: true,
      logo: "website"
    },
    {
      title: "学部卒業論文をトロント大学の恩師の前で発表した様子をYouTubeにアップしました！",
      description: "英語でKOKKAIDOCの論文についてプレゼンしています。",
      href: "https://www.youtube.com/watch?v=8HOCEHbDsrE&t=181s",
      embed: "https://www.youtube.com/embed/8HOCEHbDsrE?si=B3TYzgpcSKwjGdeu",
      date: "2025-04-30",
      logo: "youtube"
    },
    {
      title: "Ledge.aiさんの記事でKOKKAIDOCの紹介をしていただきました！",
      description: "KOKKAIDOCの概要について詳しく書いていただいています。",
      href: "https://ledge.ai/articles/kokkai_doc_ai_policy_analysis",
      date: "2025-05-28",
      logo: "website"
    },
    {
      title: "TECHNO EDGEさんの記事でKOKKAIDOCの紹介をしていただきました！",
      description: "KOKKAIDOCの概要について詳しく書いていただいています。",
      href: "https://www.techno-edge.net/article/2025/05/19/4367.html",
      date: "2025-05-19",
      logo: "website"
    },
    {
      title: "計量・数理政治研究会の集会でKOKKAIDOCの論文をポスター発表してきました！",
      description: "2025年の夏に同志社大学で開かれた学会でKOKKAIDOCの論文の内容をプレゼンテーションしてきました。",
      href: "https://sites.google.com/view/jsqps/2025-summer-meeting",
      date: "2025-07-05",
      logo: "website",
      no_visual: true
    }
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <PageShell>
      <Heading level={1}>このプロジェクトについて</Heading>

      <div className="mt-8 grid gap-12 sm:mt-12 sm:gap-16">
        <ProseSection title="趣旨">
          <p>
            当サイトは国会で議論されている法案について、各党がどのような投票をしているか、どのような討論をしているかを簡単に検索できるように作成されました。
            当サイトの情報が皆さまの投票の参考になれば幸いです。
          </p>
          <p>
            「政治的な立場の推定」の図は、国会での意見文を AI が論点ごとに要約した文章から作っています。その要約の本文は、議員の詳細パネルの「立場」タブで、元になった発言とあわせて読めます。
          </p>
        </ProseSection>

        <ProseSection title="製作者について">
          <p>
            加藤賢、日本で生まれ、ドイツのデュッセルドルフで幼少期から高校卒業までを過ごす。
            トロント大学工学部（Engineering Science）に進学し、AI を学ぶ。
            卒業後に帰国し、デジタル庁の AI 関連部署に勤務。
            現在はスタートアップでエンジニア（Member of Technical Staff）として働く。
            趣味はサッカー、好きな食べ物は餃子。
          </p>
        </ProseSection>

        <ProseSection title="引用">
          <div className="overflow-hidden rounded-xl border border-line-subtle bg-surface">
            <table className="w-full table-fixed border-collapse break-words text-left text-body-md">
              <thead className="bg-surface-raised text-label-md text-ink">
                <tr>
                  <th scope="col" className="px-3 py-2">情報</th>
                  <th scope="col" className="px-3 py-2">情報元</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle text-ink">
                <tr>
                  <td className="px-3 py-2 align-top">投票結果（参議院）</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://www.sangiin.go.jp/japanese/touhyoulist/touhyoulist.html" target="_blank" rel="noreferrer">
                      参議院ホームページ
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">討論内容</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://kokkai.ndl.go.jp/api.html" target="_blank" rel="noreferrer">
                      国会会議録検索システム
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">過去の衆議院議員リスト</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://kokkai.sugawarataku.net/giin/rgiin.html" target="_blank" rel="noreferrer">
                      国会議員白書
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">参議院議員リスト</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://www.sangiin.go.jp/japanese/san60/giin/index.html" target="_blank" rel="noreferrer">
                      参議院ホームページ
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">衆議院議員リスト</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/011kaiha.htm" target="_blank" rel="noreferrer">
                      衆議院ホームページ
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">選挙区ポリゴンデータ</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://gtfs-gis.jp/senkyoku/" target="_blank" rel="noreferrer">
                      衆議院議員選挙の小選挙区の統計データ及び地図データ
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 align-top">発言分析の元論文</td>
                  <td className="px-3 py-2 align-top">
                    <a className={LINK} href="https://arxiv.org/pdf/2505.07118" target="_blank" rel="noreferrer">
                      KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ProseSection>

        <ProseSection title="免責事項">
          <p>
            当サイト管理者は利用者が当サイトにて公開されている情報を用いて行う一切の行為について責任を負いません。
            当サイトの利用は、各利用者の自己責任にて行ってください。
          </p>
          <p className="text-title-md text-ink-strong">データの正確性、完全性、最新性について最善を尽くしていますが、誤りがある場合もあります。ご了承ください。</p>
        </ProseSection>

        <ProseSection title="著作権">
          <p>
            当サイトにて公開されている内容に関して、編集著作権を含む権利は当サイト管理者に帰属します。
            よって、当サイトの内容を管理者の承諾を得ずに使用することは禁止します。
          </p>
        </ProseSection>

        <ProseSection title="お問い合わせ/SNSアカウント">
          <ul className="grid gap-2">
            <li>kokkai.doc[アット]gmail.com</li>
            <li>
              <a href="https://x.com/kokkaidoc" className={`inline-flex items-center gap-2 ${LINK}`} target="_blank" rel="noreferrer">
                <BsTwitterX aria-hidden className="size-4" />
                <span>@kokkaidoc</span>
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@kokkaidoc_no_naka" className={`inline-flex items-center gap-2 ${LINK}`} target="_blank" rel="noreferrer">
                <BsYoutube aria-hidden className="size-4" />
                <span>@kokkaidoc_no_naka</span>
              </a>
            </li>
          </ul>
        </ProseSection>

        <ProseSection title="メディア掲載" wide>
          <div className="grid gap-4 md:grid-cols-2">
            {mediaCoverages.map((m) => (
              <div key={m.href} className="flex min-w-0 flex-col rounded-xl border border-line-subtle bg-surface p-3">
                <div className="flex items-start gap-3">
                  <div aria-hidden className="mt-0.5 shrink-0 rounded-lg border border-line bg-surface-raised p-2 text-ink-muted">
                    {m.logo === "youtube" ? <BsYoutube className="size-4" /> : <BsGlobe className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <a href={m.href} target="_blank" rel="noreferrer" className="rounded-sm text-title-sm text-ink-strong hover:text-link hover:underline">
                      {m.title}
                    </a>
                    <p className="mt-0.5 text-body-sm text-ink-muted">{m.description}</p>
                    <p className="mt-1 text-caption text-ink-muted">{formatDateJa(m.date)}</p>
                    <p className="mt-1 truncate text-caption text-link">{m.href}</p>
                  </div>
                </div>
                {m.href && !m.embed && !m.no_visual && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-line-subtle bg-surface-raised">
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
                  <div className="mt-3 overflow-hidden rounded-xl border border-line-subtle bg-surface-raised">
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
        </ProseSection>
      </div>
    </PageShell>
  );
}
