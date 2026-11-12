/**
 * The guided tour's steps, in page order. Targets are `data-tour` attributes on the components.
 * Action steps read TourState and advance when `isDone` turns true; `fallback` does it for the user.
 */

export type DetailPanel = "speeches" | "quality" | "history" | "stances";

export interface TourState {
  personOpen: boolean;
  issueOpen: boolean;
  detailPanel: DetailPanel | null;
}

export interface TourActions {
  openSamplePerson: () => void;
  closePerson: () => void;
  openSampleIssue: () => void;
  closeIssue: () => void;
  setDetailPanel: (panel: DetailPanel) => void;
  openDonation: () => void;
}

export interface TourStep {
  id: string;
  /** CSS selector; omitted for centred steps (welcome, finish) */
  target?: string;
  title: string;
  /** paragraphs separated by newlines */
  body: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  scrollBlock?: ScrollLogicalPosition;
  onEnter?: (actions: TourActions, state: TourState) => void;
  /** an optional button in the card that runs something (e.g. opens the donation modal) */
  cta?: { label: string; run: (actions: TourActions) => void };
  action?: {
    prompt: string;
    isDone: (state: TourState) => boolean;
    fallbackLabel?: string;
    fallback?: (actions: TourActions) => void;
  };
}

/** 玉木雄一郎 and one of his recent committee exchanges, used when the visitor would rather not search. */
export const TOUR_SAMPLE = {
  personId: "268",
  issueId: "122124293X00220260715",
  speechId: "122124293X00220260715_002",
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "KOKKAI DOC へようこそ",
    body:
      "国会の会議録をもとに、議員の発言・立場・質疑の中身を調べられるサイトです。\n" +
      "このガイドでは、画面の各部分を順番に紹介しながら、実際に操作していただきます。3分ほどで終わります。\n" +
      "いつでも「スキップ」で抜けられ、ヘッダーの「使い方」からやり直せます。",
  },
  {
    id: "header",
    target: '[data-tour="header-actions"]',
    title: "ヘッダー",
    body:
      "「使い方」でこのガイドをいつでも再開できます。\n" +
      "「このプロジェクトについて」で背景と目的を、「募金する」で運営の支援方法をご覧いただけます。",
    placement: "bottom",
  },
  {
    id: "search",
    target: '[data-tour="search"]',
    title: "議員を探す",
    body: "漢字でもかなでも検索できます。歴代の議員が対象で、候補をクリックすると右側に詳細パネルが開きます。",
    placement: "right",
    action: {
      prompt: "議員の名前を入力して、候補をクリックしてみましょう（例：玉木、たまき）。",
      isDone: (s) => s.personOpen,
      fallbackLabel: "代わりにサンプルの議員を開く",
      fallback: (a) => a.openSamplePerson(),
    },
  },
  {
    id: "detail",
    target: '[data-tour="detail-pane"]',
    title: "議員の詳細パネル",
    body:
      "上部に名前と、AIによる「やり取りの評価」の要約が出ます。\n" +
      "その下の3つのタブで、発言／やり取り／選挙履歴を切り替えます。左端をドラッグすると幅を変えられます。",
    placement: "left",
    scrollBlock: "nearest",
    onEnter: (a, s) => {
      if (!s.personOpen) a.openSamplePerson();
      a.setDetailPanel("speeches");
    },
  },
  {
    id: "speeches",
    target: '[data-tour="speech-card"]',
    title: "発言（トピック別）",
    body:
      "「全発言」か、防衛・経済対策などトピック別に発言を読めます。ページ送りは右上の矢印です。\n" +
      "AI判定済みの発言には 種類／成果／問題点 のラベルが付きます。",
    placement: "left",
    scrollBlock: "nearest",
    onEnter: (a) => a.setDetailPanel("speeches"),
    action: {
      prompt: "どれかの発言の「会議を閲覧する」を押して、その会議全体を開いてみましょう。",
      isDone: (s) => s.issueOpen,
      fallbackLabel: "代わりにサンプルの会議を開く",
      fallback: (a) => a.openSampleIssue(),
    },
  },
  {
    id: "issue",
    target: '[data-tour="issue-pane"]',
    title: "会議の全体を読む",
    body:
      "左に会議全体が開きます。ダイヤルをドラッグすると発言を素早く移動できます。\n" +
      "色の帯は AI が判定した「やり取り」の区切りと成果（緑＝成果あり、橙＝限定的、赤＝成果なし）。各やり取りの先頭に判定理由が付きます。\n" +
      "「原文を開く」で国会会議録の該当ページに飛べます。",
    placement: "right",
    scrollBlock: "nearest",
    onEnter: (a, s) => {
      if (!s.issueOpen) a.openSampleIssue();
    },
  },
  {
    id: "quality-tab",
    target: '[data-tour="detail-pane"]',
    title: "やり取りタブ",
    body:
      "質問者として・答弁者としての記録を、全議員の平均（白い縦線）と並べて見られます。\n" +
      "下の一覧は種類・成果・問題点で絞り込め、各行の「会議を閲覧する」でその場面に飛べます。",
    placement: "left",
    scrollBlock: "nearest",
    onEnter: (a) => {
      a.closeIssue();
      a.setDetailPanel("quality");
    },
  },
  {
    id: "history-tab",
    target: '[data-tour="detail-pane"]',
    title: "選挙履歴タブ",
    body: "これまでの選挙での当落、選挙区、所属政党を新しい順に並べています。",
    placement: "left",
    scrollBlock: "nearest",
    onEnter: (a) => a.setDetailPanel("history"),
  },
  {
    id: "stances-tab",
    target: '[data-tour="detail-pane"]',
    title: "立場タブ",
    body:
      "国会での発言を AI が論点ごとに要約し、各論点での位置と並べています。" +
      "「元になった発言を見る」で根拠の発言に飛べます。",
    placement: "left",
    scrollBlock: "nearest",
    onEnter: (a) => a.setDetailPanel("stances"),
  },
  {
    id: "ideology",
    target: '[data-tour="ideology-card"]',
    title: "政治的な立場の推定",
    body:
      "国会での発言から、論点ごとの立場を推定した図です。上の2つのメニューでトピックと論点を選びます。\n" +
      "1D は「反対 ↔ 賛成」の軸、2D は近い人ほど似た語り方をしていることを示します。「現職のみ」で現職だけに絞れます。\n" +
      "点をクリックするとその議員の詳細が開きます。右上の「注意事項」に手法と限界をまとめています。",
    placement: "right",
    onEnter: (a) => {
      a.closeIssue();
      a.closePerson();
    },
  },
  {
    id: "map",
    target: '[data-tour="map-card"]',
    title: "選挙区地図",
    body:
      "地図の選挙区をクリックすると、その選挙区の衆議院・参議院議員が並びます。\n" +
      "「比例」に切り替えると比例代表の名簿から探せます。",
    placement: "right",
  },
  {
    id: "quality-card",
    target: '[data-tour="quality-card"]',
    title: "やり取りの評価（AI判定）",
    body:
      "委員会での質疑を「やり取り」単位で AI が判定し、議員ごとに集計したランキングです。\n" +
      "「並び替え」で成果あり・お膳立て質問・答弁のはぐらかしなど28の指標から選べ、「最低やり取り数」で件数の少ない人を除けます。\n" +
      "推定であることを忘れずに。必ず「注意事項」をご覧ください。",
    placement: "left",
  },
  {
    id: "seats",
    target: '[data-tour="seats"]',
    title: "議席配分",
    body: "参議院・衆議院それぞれの、現職の党派別議席数です。",
    placement: "left",
  },
  {
    id: "support",
    target: '[data-tour="donate"]',
    title: "このサイトは一人で運営しています",
    body:
      "KOKKAI DOC は個人の趣味として一人で開発・運営している非営利のプロジェクトです。\n" +
      "会議録の取得、AIによる分類、サーバー代などの費用は自己負担でまかなっています。\n" +
      "続けていくために、ご寄付はいつでも大歓迎です。金額にかかわらず、大きな励みになります。",
    placement: "bottom",
    onEnter: (a) => {
      a.closeIssue();
      a.closePerson();
    },
    cta: { label: "募金について見る", run: (a) => a.openDonation() },
  },
  {
    id: "finish",
    title: "これで一通りです",
    body:
      "表示される数値や図は、すべて会議録からの推定・参考情報です。気になったら必ず原文を確認してください。\n" +
      "このガイドはヘッダーの「使い方」からいつでも見直せます。",
  },
];
