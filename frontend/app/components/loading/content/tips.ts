import type { TipCard } from "./types";

/** 使い方 tips, condensed from the guided tour (components/tutorial/tutorialSteps.ts). */
export const TIPS: TipCard[] = [
  { kind: "tip", id: "tip-search", title: "議員を探す", body: "左上の検索欄は漢字でもかなでも探せます。現職だけでなく歴代の議員も対象です。" },
  { kind: "tip", id: "tip-issue", title: "会議の全体を読む", body: "発言の「会議を閲覧する」で、その会議を最初から最後まで読めます。色の帯は AI が区切った「やり取り」です。" },
  { kind: "tip", id: "tip-original", title: "原文に当たる", body: "会議の画面の「原文を開く」で、国会会議録の該当ページに飛べます。AI の判定と原文を見比べてみてください。" },
  { kind: "tip", id: "tip-scatter", title: "立場の図", body: "立場の推定の図で点をクリックすると、その議員の詳細パネルが開きます。「現職のみ」で現職だけに絞れます。" },
  { kind: "tip", id: "tip-map", title: "選挙区から探す", body: "地図の選挙区をクリックすると、その選挙区の衆議院・参議院議員が並びます。「比例」に切り替えると比例代表から探せます。" },
  { kind: "tip", id: "tip-ranking", title: "やり取りのランキング", body: "「並び替え」で、成果あり・お膳立て質問・答弁のはぐらかしなど28の指標から並べ替えられます。" },
  { kind: "tip", id: "tip-share", title: "そのまま共有", body: "議員を開くと URL にその議員が記録されます。アドレスをコピーすれば、同じ画面を共有できます。" },
  { kind: "tip", id: "tip-tour", title: "迷ったら「使い方」", body: "ヘッダーの「使い方」から、実際に操作しながら学べるガイドをいつでも始められます。3分ほどです。" },
];
