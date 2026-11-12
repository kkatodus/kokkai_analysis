/** The chapters of the feature tour panel (specs/landing-page §5.1–5.6), in order. */

import type { ComponentType } from "react";
import type { Playback, StageFrame } from "./useStagePlayback";
import { DETAIL_DURATION_MS, DetailPaneStage } from "./stages/DetailPaneStage";
import { ISSUE_DURATION_MS, IssuePaneStage } from "./stages/IssuePaneStage";
import { MAP_DURATION_MS, MapStage } from "./stages/MapStage";
import { RANKING_DURATION_MS, RankingStage } from "./stages/RankingStage";
import { SCATTER_DURATION_MS, ScatterStage } from "./stages/ScatterStage";
import { SEARCH_DURATION_MS, SearchStage } from "./stages/SearchStage";

export interface Chapter {
  id: string;
  /** marker label on the progress rail */
  short: string;
  title: string;
  body: string;
  caption?: string;
  note?: string;
  /** one sentence for screen readers */
  description: string;
  Component: ComponentType<{ pb: Playback; frame: StageFrame }>;
  /** length of one play; autoplay waits this plus reading time before the next chapter */
  durationMs: number;
}

export const CHAPTERS: Chapter[] = [
  {
    id: "search",
    short: "検索",
    title: "議員を、名前で探す。",
    body: "歴代の衆参議員を名前で検索できます。現職も元職も、ひらがなでも。選ぶと、その議員の詳細パネルが開きます。",
    caption: "地図の選挙区や立場の図からも、同じパネルを開けます。",
    description: "議員検索の例：名前を打ち込むと候補が出て、選ぶと詳細パネルが開きます。",
    Component: SearchStage,
    durationMs: SEARCH_DURATION_MS,
  },
  {
    id: "speeches",
    short: "発言",
    title: "発言を、トピック別に読む。",
    body: "議員をクリックすると詳細パネルが開きます。防衛・経済対策・少子化など、気になるトピックだけ読めます。AIが判定した発言には 種類／成果／問題点 のラベルが付きます。",
    caption: "ラベルは推定です。気になったら原文へ。",
    note: "このページの議員・政党・発言はすべて架空のサンプルです。",
    description: "議員の詳細パネルの例：トピックを選ぶと、ラベル付きの発言カードが並びます。",
    Component: DetailPaneStage,
    durationMs: DETAIL_DURATION_MS,
  },
  {
    id: "meeting",
    short: "会議",
    title: "その場面を、会議まるごと読む。",
    body: "「会議を閲覧する」で、その日の会議全体が開きます。ダイヤルを回すと発言をすばやく移動。色の帯は、AIが区切った「やり取り」とその成果（緑＝成果あり、橙＝限定的、赤＝成果なし）。",
    caption: "「原文を開く」で国会会議録検索システムの該当ページへ飛べます。",
    description: "会議パネルの例：ダイヤルで発言を移動し、色の帯がやり取りの成果を示します。",
    Component: IssuePaneStage,
    durationMs: ISSUE_DURATION_MS,
  },
  {
    id: "ranking",
    short: "比べる",
    title: "ほかの議員と、比べる。",
    body: "委員会での質疑を「やり取り」単位でAIが判定し、議員ごとに集計。並び替えは、成果あり・お膳立て質問・答弁のはぐらかしなど28の指標から選べます。白い縦線は全議員の平均です。",
    caption: "「最低やり取り数」で件数の少ない人を除けます。",
    description: "ランキングの例：指標を切り替えると議員の並びが変わり、件数の少ない人を除外できます。",
    Component: RankingStage,
    durationMs: RANKING_DURATION_MS,
  },
  {
    id: "ideology",
    short: "立場",
    title: "どこに立っているかを、見る。",
    body: "国会での発言から、論点ごとの立場を推定した図です。1D は「反対 ↔ 賛成」の軸、2D は近い人ほど似た語り方をしていることを示します。点をクリックするとその議員の詳細が開きます。",
    caption: "投票行動や公約ではなく、国会での発言だけが材料です。推定には誤差があります。",
    description: "立場の散布図の例：1Dの軸から2Dの配置に切り替わり、点にカーソルを合わせると名前が出ます。",
    Component: ScatterStage,
    durationMs: SCATTER_DURATION_MS,
  },
  {
    id: "districts",
    short: "地図",
    title: "地元の議員を、地図から。",
    body: "地図の選挙区をクリックすると、その選挙区の衆議院・参議院議員が並びます。「比例」に切り替えると比例代表の名簿から探せます。議員の「選挙履歴」タブで、これまでの当落・選挙区・所属政党も見られます。",
    caption: "参議院・衆議院の現職の党派別議席数もダッシュボードで確認できます。",
    description: "地図の例：選挙区をクリックすると議員の一覧と選挙履歴が開き、比例にも切り替えられます。",
    Component: MapStage,
    durationMs: MAP_DURATION_MS,
  },
];
