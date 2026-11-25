import type { QuizCard } from "./types";

/** Multiple-choice questions about the Diet. Answers phrased so they stay true across elections (§5.3). */
export const QUIZ: QuizCard[] = [
  { kind: "quiz", id: "quiz-upper-term", question: "参議院議員の任期は何年？", options: ["3年", "4年", "6年", "8年"], answer: 2, explain: "6年です。3年ごとに半数ずつ改選されるので、選挙は3年おきにあります。", source: "日本国憲法 第46条" },
  { kind: "quiz", id: "quiz-lower-term", question: "衆議院議員の任期は何年？", options: ["2年", "4年", "5年", "6年"], answer: 1, explain: "4年です。ただし解散があると任期の途中で終わります。", source: "日本国憲法 第45条" },
  { kind: "quiz", id: "quiz-budget-first", question: "予算を先に審議するのはどちら？", options: ["衆議院", "参議院", "どちらからでもよい", "内閣が決める"], answer: 0, explain: "衆議院です（予算先議権）。予算の議決でも衆議院が優越します。", source: "日本国憲法 第60条" },
  { kind: "quiz", id: "quiz-session-length", question: "通常国会の会期は何日？", options: ["90日", "120日", "150日", "180日"], answer: 2, explain: "150日です。両院の議決で1回だけ延長できます。", source: "国会法 第10条・第12条" },
  { kind: "quiz", id: "quiz-upper-age", question: "参議院議員に立候補できるのは満何歳から？", options: ["満18歳", "満25歳", "満30歳", "満35歳"], answer: 2, explain: "満30歳からです。衆議院は満25歳からです。", source: "公職選挙法 第10条" },
  { kind: "quiz", id: "quiz-override", question: "参議院が否決した法律案を、衆議院だけで成立させるには？", options: ["出席議員の過半数で再可決", "出席議員の3分の2以上で再可決", "総議員の4分の3以上で再可決", "成立させる方法はない"], answer: 1, explain: "出席議員の3分の2以上で再可決すれば法律になります。", source: "日本国憲法 第59条" },
  { kind: "quiz", id: "quiz-written-question", question: "質問主意書に内閣が答える期限は、原則何日以内？", options: ["3日", "7日", "14日", "30日"], answer: 1, explain: "7日以内です。期間内に答えられないときは理由と見込みを示す必要があります。", source: "国会法 第75条" },
  { kind: "quiz", id: "quiz-special-session", question: "衆議院の総選挙のあとに召集される国会は？", options: ["通常国会", "臨時国会", "特別国会", "参議院の緊急集会"], answer: 2, explain: "特別国会（特別会）です。総選挙の日から30日以内に召集され、まず内閣総理大臣を指名します。", source: "日本国憲法 第54条" },
  { kind: "quiz", id: "quiz-pm", question: "内閣総理大臣を「指名」するのは？", options: ["天皇", "国会", "内閣", "最高裁判所"], answer: 1, explain: "国会が国会議員の中から指名し、天皇が任命します。", source: "日本国憲法 第6条・第67条" },
  { kind: "quiz", id: "quiz-committee", question: "国会の質疑の多くが行われる場所は？", options: ["本会議", "委員会", "両院協議会", "記者会見"], answer: 1, explain: "委員会です。法律案は委員会で審査されてから本会議で採決されます。KOKKAI DOC のやり取りの多くも委員会のものです。", source: "国会法 第56条" },
  { kind: "quiz", id: "quiz-source", question: "KOKKAI DOC の発言データはどこから来ている？", options: ["SNS の投稿", "報道記事", "国立国会図書館の会議録", "議員の公式サイト"], answer: 2, explain: "国立国会図書館の「国会会議録検索システム」です。原文はいつでも確かめられます。", source: "国立国会図書館 国会会議録検索システム" },
];
