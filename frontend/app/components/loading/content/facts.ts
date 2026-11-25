import type { FactCard } from "./types";

/**
 * Facts about the Diet as an institution and about how KOKKAI DOC works.
 * Only statements that stay true across elections: no seat counts, no session dates (§5.3).
 */
export const FACTS: FactCard[] = [
  { kind: "fact", id: "fact-lower-term", title: "衆議院の任期", body: "衆議院議員の任期は4年。ただし解散があると、その時点で任期が終わります。", source: "日本国憲法 第45条" },
  { kind: "fact", id: "fact-upper-term", title: "参議院の任期", body: "参議院議員の任期は6年で、3年ごとに半数ずつ選挙をします。参議院に解散はありません。", source: "日本国憲法 第46条" },
  { kind: "fact", id: "fact-ordinary-session", title: "通常国会", body: "通常国会は毎年1回、1月に召集されるのが常例で、会期は150日です。", source: "国会法 第2条・第10条" },
  { kind: "fact", id: "fact-budget-first", title: "予算は衆議院から", body: "予算は必ず衆議院が先に審議します。両院の議決が異なり協議もまとまらない場合は、衆議院の議決が国会の議決になります。", source: "日本国憲法 第60条" },
  { kind: "fact", id: "fact-override", title: "衆議院の再可決", body: "衆議院で可決した法律案を参議院が否決しても、衆議院が出席議員の3分の2以上で再び可決すれば法律になります。", source: "日本国憲法 第59条" },
  { kind: "fact", id: "fact-committee", title: "委員会で中身を詰める", body: "法律案はまず委員会で審査され、その報告を受けて本会議で採決されます。国会の質疑の多くは委員会で行われています。", source: "国会法 第56条" },
  { kind: "fact", id: "fact-written-question", title: "質問主意書", body: "国会議員は内閣に文書で質問できます。内閣は受け取ってから原則7日以内に文書で答えなければなりません。", source: "国会法 第74条・第75条" },
  { kind: "fact", id: "fact-immunity", title: "発言の免責", body: "国会議員は、議院で行った演説・討論・表決について、院外で責任を問われません。", source: "日本国憲法 第51条" },
  { kind: "fact", id: "fact-candidacy-age", title: "立候補できる年齢", body: "衆議院は満25歳以上、参議院は満30歳以上で立候補できます。", source: "公職選挙法 第10条" },
  { kind: "fact", id: "fact-source", title: "データの出どころ", body: "KOKKAI DOC の発言は、国立国会図書館の「国会会議録検索システム」から取得しています。誰でも原文を確かめられる公開データです。", source: "国立国会図書館 国会会議録検索システム" },
  { kind: "fact", id: "fact-labels", title: "AI の判定は推定です", body: "やり取りの評価は AI による推定で、誤りもありえます。だからこそ、判定理由と原文をいつも並べて表示しています。", source: "KOKKAI DOC 注意事項" },
  { kind: "fact", id: "fact-scaling", title: "立場の推定のしくみ", body: "論点ごとに議員の発言を AI が要約し、その意味の近さから位置を推定しています。点の位置は「国会での語り方」であり、投票行動そのものではありません。", source: "KOKKAI DOC 注意事項" },
  { kind: "fact", id: "fact-solo", title: "一人で運営しています", body: "KOKKAI DOC は個人が趣味で開発・運営している非営利のプロジェクトです。会議録の取得や AI の費用は自己負担です。", source: "KOKKAI DOC このプロジェクトについて" },
];
