/**
 * Cards built from `speech_quality/site_stats.json` (specs/dashboard-loading §8), fetched through
 * /api/site-stats while the dashboard loads. Named politicians appear only with neutral counts;
 * AI-label numbers are site-wide shares only (§3 "Naming").
 */

import { FUNCTION_JA, ISSUE_JA } from "@/app/lib/quality";
import type { QualityFunction, QualityIssueType } from "@/app/types";
import type { FactCard, LoadingCardItem, QuizCard } from "./types";

type Ranked = { person_id: number; name: string | null; group: string | null; n: number };

export type SiteStats = {
  version: number;
  generated_at: string;
  corpus: { speeches: number; meetings: number; from: string | null };
  labels: { from: string | null; to: string | null; exchanges: number; meetings: number; persons: number };
  n_persons_total: number;
  current_members: { lower: number; upper: number };
  function_share: Partial<Record<QualityFunction, number>>;
  contribution_share: Partial<Record<"substantive" | "limited" | "none", number>>;
  issue_share: Partial<Record<QualityIssueType, number>>;
  outcome_share: Partial<Record<"new_information" | "commitment" | "proposal", number>>;
  top_speakers_current: Ranked[];
  top_questioners_current: Ranked[];
  top_answerers_current: Ranked[];
  top_terms_lower_current: Ranked[];
  /** total size of the data bucket in bytes; absent when the publisher could not read it */
  data_bytes?: number;
};

const int = (n: number) => n.toLocaleString("ja-JP");
const pct = (share: number) => `${Math.round(share * 100)}%`;
const ymd = (d: string | null) => (d ? d.slice(0, 10).replace(/-/g, "/") : "—");
const who = (r: Ranked) => (r.group ? `${r.name}（${r.group}）` : `${r.name ?? "—"}`);

/** 2459534 → "約246万" (one significant step, always 万 or plain). */
function approx(n: number): string {
  if (n >= 10000) return `約${int(Math.round(n / 10000))}万`;
  if (n >= 1000) return `約${int(Math.round(n / 100) * 100)}`;
  return `約${int(n)}`;
}

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Options in random order with the index of the right one. */
function choices(correct: string, wrong: string[]): { options: string[]; answer: number } {
  const options = shuffle([correct, ...wrong]);
  return { options, answer: options.indexOf(correct) };
}

/** "約X割" with three distractors at least two tenths away. */
function tenthsQuiz(share: number): { options: string[]; answer: number } | null {
  const d = Math.round(share * 10);
  if (d < 1 || d > 9) return null;
  const wrong = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => Math.abs(x - d) >= 2)).slice(0, 3);
  const all = [d, ...wrong].sort((a, b) => a - b).map((x) => `約${x}割`);
  return { options: all, answer: all.indexOf(`約${d}割`) };
}

/** Who-is-first question; only when there is a clear first place and four names to choose from. */
function rankingQuiz(id: string, question: string, list: Ranked[], unit: string, note: string, source: string): QuizCard | null {
  if (list.length < 4 || !list[0].name || list[0].n <= list[1].n) return null;
  const [first, second] = list;
  const { options, answer } = choices(who(first), list.slice(1, 4).map(who));
  return {
    kind: "quiz",
    id,
    question,
    options,
    answer,
    explain: `${first.name}さんで${int(first.n)}${unit}。2位は${second.name}さんの${int(second.n)}${unit}です。${note}`,
    source,
  };
}

export function buildStatsCards(s: SiteStats): LoadingCardItem[] {
  const source = `KOKKAI DOC 集計（${ymd(s.generated_at)} 時点）`;
  const cards: (LoadingCardItem | null)[] = [];

  // --- quiz ---
  const n = s.corpus.speeches;
  if (n > 0) {
    const options = [0.1, 0.3, 1, 3].map((f) => `${approx(n * f)}件`);
    cards.push({
      kind: "quiz",
      id: "stats-quiz-corpus",
      question: "KOKKAI DOC が収録している2000年以降の国会の発言は、およそ何件？",
      options,
      answer: 2,
      explain: `${int(n)}件、会議にして${int(s.corpus.meetings)}回分です。いま読み込んでいるのは、ここから作った集計です。`,
      source,
    });
  }
  cards.push(
    rankingQuiz("stats-quiz-speaker", "2000年以降、国会で発言した回数が最も多い現職議員は？", s.top_speakers_current, "回",
      "会議録に記録された発言の数です。", source),
    rankingQuiz("stats-quiz-questioner", "KOKKAI DOC が分析したやり取りで、質問者として最も多く登場する現職議員は？", s.top_questioners_current, "件",
      "質問の中身の評価ではなく、登場した回数です。", source),
    rankingQuiz("stats-quiz-answerer", "KOKKAI DOC が分析したやり取りで、答弁者として最も多く登場する現職議員は？", s.top_answerers_current, "件",
      "大臣などとして答弁した回数です。", source),
    rankingQuiz("stats-quiz-terms", "現職の衆議院議員で、当選回数が最も多いのは？", s.top_terms_lower_current, "回",
      "衆議院の公式名簿にある当選回数です。", source),
  );
  const oversight = s.function_share.oversight;
  const ov = oversight !== undefined ? tenthsQuiz(oversight) : null;
  if (ov && oversight !== undefined) {
    cards.push({
      kind: "quiz",
      id: "stats-quiz-oversight",
      question: "分析したやり取りのうち、主な役割が「行政監視」だったのはどのくらい？",
      ...ov,
      explain: `${pct(oversight)}です。最も多いのは「${FUNCTION_JA[topKey(s.function_share) as QualityFunction] ?? "—"}」でした（AIによる推定）。`,
      source,
    });
  }
  const substantive = s.contribution_share.substantive;
  const sub = substantive !== undefined ? tenthsQuiz(substantive) : null;
  if (sub && substantive !== undefined) {
    cards.push({
      kind: "quiz",
      id: "stats-quiz-substantive",
      question: "AI が「成果あり」と判定したやり取りは、全体のどのくらい？",
      ...sub,
      explain: `${pct(substantive)}です。事実が明らかになった、具体的な約束や提案が出た、などを「成果あり」としています（AIによる推定）。`,
      source,
    });
  }
  const issues = (Object.entries(s.issue_share) as [QualityIssueType, number][]).filter(([k]) => ISSUE_JA[k]).sort((a, b) => b[1] - a[1]);
  if (issues.length >= 4 && issues[0][1] > issues[1][1]) {
    const { options, answer } = choices(ISSUE_JA[issues[0][0]], issues.slice(1, 4).map(([k]) => ISSUE_JA[k]));
    cards.push({
      kind: "quiz",
      id: "stats-quiz-issue",
      question: "AI が問題点として指摘したやり取りで、最も多い種類は？",
      options,
      answer,
      explain: `「${ISSUE_JA[issues[0][0]]}」で、やり取り全体の${pct(issues[0][1])}です。次は「${ISSUE_JA[issues[1][0]]}」の${pct(issues[1][1])}（AIによる推定）。`,
      source,
    });
  }

  // --- facts ---
  if (n > 0) {
    cards.push({ kind: "fact", id: "stats-fact-corpus", title: "収録している会議録",
      body: `${ymd(s.corpus.from)}以降の国会の発言${int(n)}件、会議${int(s.corpus.meetings)}回分を収録しています。`, source });
  }
  if (s.labels.exchanges > 0) {
    cards.push({ kind: "fact", id: "stats-fact-labels", title: "AI が読んだやり取り",
      body: `${ymd(s.labels.from)}〜${ymd(s.labels.to)}の会議${int(s.labels.meetings)}回から、${int(s.labels.exchanges)}件の質疑のやり取りを AI が分類しました。登場する議員は${int(s.labels.persons)}人です。`, source });
  }
  if (s.data_bytes) {
    cards.push({ kind: "fact", id: "stats-fact-bytes", title: "集めたデータの量",
      body: `会議録、議員情報、投票記録、AI による分析結果など、このサイトのために集めて分析したデータは合わせて約${Math.round(s.data_bytes / 1e9).toLocaleString("ja-JP")} GB です。`, source });
  }
  if (s.n_persons_total > 0) {
    cards.push({ kind: "fact", id: "stats-fact-members", title: "データベースの議員",
      body: `歴代${int(s.n_persons_total)}人の議員を収録しています。現職は衆議院${int(s.current_members.lower)}人、参議院${int(s.current_members.upper)}人です。`, source });
  }
  const proposal = s.outcome_share.proposal;
  if (proposal) {
    cards.push({ kind: "fact", id: "stats-fact-proposal", title: "提案が記録に残る",
      body: `分析したやり取りの${pct(proposal)}で、まだ採られていない具体的な提案が会議録に残っています（AIによる推定）。`, source });
  }
  return cards.filter((c): c is LoadingCardItem => c !== null);
}

function topKey(shares: Record<string, number | undefined>): string | undefined {
  return Object.entries(shares).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
}

export type { FactCard, QuizCard };
