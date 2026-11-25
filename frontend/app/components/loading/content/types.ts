/** Loading-screen cards (specs/dashboard-loading §5.3). Every fact and quiz item carries a source. */

export type TipCard = { kind: "tip"; id: string; title: string; body: string };
export type FactCard = { kind: "fact"; id: string; title: string; body: string; source: string };
export type QuizCard = {
  kind: "quiz";
  id: string;
  question: string;
  options: string[];
  /** index into options */
  answer: number;
  explain: string;
  source: string;
};
export type LoadingCardItem = TipCard | FactCard | QuizCard;
