/**
 * Landing page at `/` (specs/landing-page). Static: pure UI plus bundled sample data, no backend fetch.
 * The dashboard it introduces lives at `/app`.
 */

import type { Metadata } from "next";
import { TrackOnMount } from "@/app/components/analytics/TrackOnMount";
import { FeatureSection } from "@/app/components/landing/FeatureSection";
import { Hero } from "@/app/components/landing/Hero";
import { LandingHeader } from "@/app/components/landing/LandingHeader";
import { MethodSection } from "@/app/components/landing/MethodSection";
import { SupportSection } from "@/app/components/landing/SupportSection";

export const metadata: Metadata = {
  title: "KOKKAI DOC ｜ その議員、国会で何してる？",
  description: "日本の政治を調べやすく、わかりやすく、身近に。AIをフル活用した国会発言分析プラットフォーム。",
  alternates: { canonical: "https://kokkaidoc.com/" },
  openGraph: {
    title: "KOKKAI DOC ｜ その議員、国会で何してる？",
    description: "国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。",
    url: "https://kokkaidoc.com/",
    siteName: "KOKKAI DOC",
    locale: "ja_JP",
    type: "website",
    images: [{ url: "https://kokkaidoc.com/og-landing.png", width: 1200, height: 630, alt: "KOKKAI DOC ｜ その議員、国会で何してる？" }],
  },
  twitter: { card: "summary_large_image", site: "@kokkaidoc" },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] text-gray-100">
      <TrackOnMount event="LandingView" />
      <LandingHeader />
      <main>
        <Hero />
        <FeatureSection
          id="speeches"
          stage="detail"
          title="発言を、トピック別に読む。"
          body="議員をクリックすると詳細パネルが開きます。防衛・経済対策・少子化など、気になるトピックだけ読めます。AIが判定した発言には 種類／成果／問題点 のラベルが付きます。"
          caption="ラベルは推定です。気になったら原文へ。"
          note="このページの議員・政党・発言はすべて架空のサンプルです。"
        />
        <FeatureSection
          id="meeting"
          stage="issue"
          flip
          title="その場面を、会議まるごと読む。"
          body="「会議を閲覧する」で、その日の会議全体が開きます。ダイヤルを回すと発言をすばやく移動。色の帯は、AIが区切った「やり取り」とその成果（緑＝成果あり、橙＝限定的、赤＝成果なし）。"
          caption="「原文を開く」で国会会議録検索システムの該当ページへ飛べます。"
        />
        <FeatureSection
          id="ranking"
          stage="ranking"
          title="ほかの議員と、比べる。"
          body="委員会での質疑を「やり取り」単位でAIが判定し、議員ごとに集計。並び替えは、成果あり・お膳立て質問・答弁のはぐらかしなど28の指標から選べます。白い縦線は全議員の平均です。"
          caption="「最低やり取り数」で件数の少ない人を除けます。"
        />
        <FeatureSection
          id="ideology"
          stage="scatter"
          flip
          title="どこに立っているかを、見る。"
          body="国会での発言から、論点ごとの立場を推定した図です。1D は「反対 ↔ 賛成」の軸、2D は近い人ほど似た語り方をしていることを示します。点をクリックするとその議員の詳細が開きます。"
          caption="投票行動や公約ではなく、国会での発言だけが材料です。推定には誤差があります。"
        />
        <FeatureSection
          id="districts"
          stage="map"
          title="地元の議員を、地図から。"
          body="地図の選挙区をクリックすると、その選挙区の衆議院・参議院議員が並びます。「比例」に切り替えると比例代表の名簿から探せます。議員の「選挙履歴」タブで、これまでの当落・選挙区・所属政党も見られます。"
          caption="参議院・衆議院の現職の党派別議席数もダッシュボードで確認できます。"
        />
        <MethodSection />
        <SupportSection />
      </main>
    </div>
  );
}
