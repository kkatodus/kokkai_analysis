/**
 * Fictional sample data for the landing-page replicas (specs/landing-page §7).
 * No real politician, party, bill or ministry appears here; every stage that shows it carries a 「サンプル」 badge.
 */

import { PARTY2RGBCOLOR } from "@/app/lib/config/parties";

export type SampleParty = "サンプル党" | "議論党" | "無所属";

/** Fictional parties borrow neon colours from the real palette so the replicas match the dashboard. */
export const PARTY_RGB: Record<SampleParty, [number, number, number]> = {
  サンプル党: PARTY2RGBCOLOR["自民"],
  議論党: PARTY2RGBCOLOR["立憲"],
  無所属: PARTY2RGBCOLOR["無所属"],
};

export function rgba(c: [number, number, number], a = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function partyColor(p: SampleParty, a = 1): string {
  return rgba(PARTY_RGB[p], a);
}

export interface SampleMember {
  name: string;
  party: SampleParty;
  house: "衆議院" | "参議院" | "元議員";
}

export const TARO: SampleMember = { name: "国会 太郎", party: "サンプル党", house: "衆議院" };
export const HANAKO: SampleMember = { name: "国会 花子", party: "サンプル党", house: "参議院" };
export const JIRO: SampleMember = { name: "国会 次郎", party: "無所属", house: "元議員" };

export const SEARCH_QUERY = "こっか";
export const SEARCH_ROWS: SampleMember[] = [TARO, HANAKO, JIRO];

/** 「やり取りの評価（AI判定）」 summary on the detail pane header. */
export const QUALITY_SUMMARY = { n: 58, substantive: 28, limited: 22, none: 8 };

export const TOPIC_CHIPS = ["全発言", "防衛", "経済対策", "少子化", "社会保障全般（医療・介護）"];
export const ACTIVE_TOPIC = "経済対策";

export interface SampleSpeech {
  date: string;
  meeting: string;
  excerpt: string;
}

/** Three "pages" of two excerpts each; the idle loop pages through them. */
export const SPEECH_PAGES: SampleSpeech[][] = [
  [
    { date: "2026-05-14", meeting: "予算委員会", excerpt: "中小企業向けの価格転嫁支援について、実施状況と今後の予算規模を伺います。" },
    { date: "2026-04-22", meeting: "経済産業委員会", excerpt: "地域の商店街支援は申請の負担が大きいと聞きます。手続きの簡素化は検討されていますか。" },
  ],
  [
    { date: "2026-03-18", meeting: "財務金融委員会", excerpt: "家計の負担軽減策について、対象世帯の線引きの根拠を説明してください。" },
    { date: "2026-02-26", meeting: "予算委員会", excerpt: "物価上昇に見合う賃上げが進んでいない業種への支援策はありますか。" },
  ],
  [
    { date: "2026-02-04", meeting: "本会議", excerpt: "補正予算の執行状況と、未執行分の扱いについて見解を伺います。" },
    { date: "2025-12-10", meeting: "経済産業委員会", excerpt: "新しい支援制度の周知は十分でしょうか。利用率の見込みを教えてください。" },
  ],
];

/** Meeting replica (§5.3): eight rows in three exchanges, each with a 判定理由 note. */
export const ISSUE_TITLE = "予算委員会 第3号 2026-05-14";
export interface IssueRow {
  speaker: string;
  excerpt: string;
}
export const ISSUE_GROUPS: Array<{ contribution: "substantive" | "limited" | "none"; note: string; rows: IssueRow[] }> = [
  {
    contribution: "substantive",
    note: "新事実が出た：担当省庁が未公表の数字を答弁で示した。",
    rows: [
      { speaker: "国会 太郎", excerpt: "価格転嫁支援の申請件数と採択率を伺います。" },
      { speaker: "担当大臣", excerpt: "申請は前年の約1.8倍、採択率は6割強です。" },
      { speaker: "国会 太郎", excerpt: "採択されなかった事業者への対応は。" },
    ],
  },
  {
    contribution: "limited",
    note: "質問が一般的で、答弁も既存の方針の確認にとどまった。",
    rows: [
      { speaker: "議会 三郎", excerpt: "地域経済への影響をどう見ていますか。" },
      { speaker: "担当大臣", excerpt: "引き続き注視してまいります。" },
    ],
  },
  {
    contribution: "none",
    note: "質問への直接の回答がなく、同じ説明が繰り返された。",
    rows: [
      { speaker: "審議 五郎", excerpt: "未執行分の具体的な金額を示してください。" },
      { speaker: "担当大臣", excerpt: "適切に執行してまいります。" },
      { speaker: "審議 五郎", excerpt: "金額を聞いています。" },
    ],
  },
];

/** Ranking replica (§5.4): eight rows, two metric vectors, baselines. */
export interface RankingRow {
  name: string;
  party: SampleParty;
  n: number;
  substantive: number;
  softball: number;
}
export const RANKING_ROWS: RankingRow[] = [
  { name: "国会 太郎", party: "サンプル党", n: 58, substantive: 0.62, softball: 0.05 },
  { name: "国会 花子", party: "サンプル党", n: 64, substantive: 0.55, softball: 0.21 },
  { name: "議会 三郎", party: "議論党", n: 31, substantive: 0.49, softball: 0.03 },
  { name: "議会 四子", party: "議論党", n: 77, substantive: 0.46, softball: 0.08 },
  { name: "審議 五郎", party: "無所属", n: 24, substantive: 0.41, softball: 0.0 },
  { name: "会議 六子", party: "サンプル党", n: 65, substantive: 0.37, softball: 0.34 },
  { name: "答弁 七郎", party: "議論党", n: 52, substantive: 0.3, softball: 0.1 },
  { name: "国会 次郎", party: "無所属", n: 51, substantive: 0.26, softball: 0.14 },
];
export const RANKING_BASELINE = { substantive: 0.43, softball: 0.12 };

/** Scatter replica (§5.5): 60 deterministic points in three loose clusters. */
export interface ScatterPoint {
  id: number;
  x1: number; // 1D position, 0..1
  x2: number; // 2D position, 0..1
  y2: number;
  party: SampleParty;
  incumbent: boolean;
}
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CLUSTERS: Array<{ cx: number; cy: number; x1: number; party: SampleParty }> = [
  { cx: 0.25, cy: 0.35, x1: 0.22, party: "議論党" },
  { cx: 0.7, cy: 0.3, x1: 0.78, party: "サンプル党" },
  { cx: 0.5, cy: 0.75, x1: 0.5, party: "無所属" },
];
export const SCATTER_POINTS: ScatterPoint[] = (() => {
  const rnd = mulberry32(20261110);
  const pts: ScatterPoint[] = [];
  for (let i = 0; i < 60; i++) {
    const c = CLUSTERS[i % 3];
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 0.6;
    pts.push({
      id: i,
      x1: Math.min(0.97, Math.max(0.03, c.x1 + gauss() * 0.22)),
      x2: Math.min(0.95, Math.max(0.05, c.cx + gauss() * 0.16)),
      y2: Math.min(0.92, Math.max(0.08, c.cy + gauss() * 0.16)),
      party: c.party,
      incumbent: i % 3 !== 2 || i % 2 === 0 ? i % 5 !== 0 : false,
    });
  }
  return pts;
})();
export const SCATTER_HOVER_ID = 1;

/** Map replica (§5.6): prefecture ids from japanPrefectures.ts → fictional party. */
export const MAP_DISTRICTS: Record<string, SampleParty> = {
  hokkaido: "議論党",
  miyagi: "サンプル党",
  niigata: "無所属",
  tokyo: "サンプル党",
  kanagawa: "議論党",
  aichi: "サンプル党",
  osaka: "議論党",
  hiroshima: "サンプル党",
  fukuoka: "無所属",
  okinawa: "議論党",
};
export const MAP_FOCUS = "tokyo";
export const DISTRICT_LABEL = "東京 1区";
export const DISTRICT_MEMBERS: SampleMember[] = [TARO, HANAKO];
export const PR_LABEL = "比例 東京ブロック";
export const PR_MEMBERS: SampleMember[] = [
  { name: "議会 四子", party: "議論党", house: "衆議院" },
  { name: "会議 六子", party: "サンプル党", house: "衆議院" },
  { name: "答弁 七郎", party: "議論党", house: "衆議院" },
];
export const ELECTION_HISTORY: Array<{ year: string; election: string; district: string; party: SampleParty; result: string; won: boolean }> = [
  { year: "2024", election: "衆院選", district: "東京1区", party: "サンプル党", result: "当選", won: true },
  { year: "2021", election: "衆院選", district: "東京1区", party: "サンプル党", result: "落選（比例復活）", won: false },
  { year: "2017", election: "衆院選", district: "東京1区", party: "サンプル党", result: "当選", won: true },
];
