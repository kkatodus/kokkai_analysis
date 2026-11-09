/**
 * Vocabulary, colours and helpers for the exchange quality labels
 * (specs/speech-quality-labels §3, specs/speech-quality-ui §4). Mirrors data/speech_quality/prompt.py.
 */

import type {
  QualityAnswerCounts,
  QualityContribution,
  QualityCounts,
  QualityExchange,
  QualityExtent,
  QualityFunction,
  QualityIssue,
  QualityIssueType,
  QualityOutcome,
  QualityPerson,
  QualityResponsible,
  QualitySide,
} from "@/app/types";

export const FUNCTIONS: QualityFunction[] = ["legislation", "oversight", "policy", "representation", "procedural", "none"];
export const CONTRIBUTIONS: QualityContribution[] = ["substantive", "limited", "none"];
export const ISSUE_TYPES: QualityIssueType[] = [
  "softball",
  "grandstanding",
  "redundant",
  "private_scandal",
  "personal_attack",
  "procedural_dispute",
  "evasive",
];
export const QUESTIONER_ISSUE_TYPES: QualityIssueType[] = [
  "softball",
  "grandstanding",
  "redundant",
  "private_scandal",
  "personal_attack",
  "procedural_dispute",
];
export const ANSWERER_ISSUE_TYPES: QualityIssueType[] = ["evasive", "personal_attack", "procedural_dispute"];
export const OUTCOMES: QualityOutcome[] = ["new_information", "commitment", "proposal"];

export const FUNCTION_JA: Record<QualityFunction, string> = {
  legislation: "法案審査",
  oversight: "行政監視",
  policy: "政策論議",
  representation: "地域・団体の要望",
  procedural: "議事運営",
  none: "その他",
};

export const FUNCTION_DESC_JA: Record<QualityFunction, string> = {
  legislation: "法案の内容・穴・修正を審査する",
  oversight: "公金の使途、権限行使、行政の失敗、公職に関わる不祥事を監視する",
  policy: "政府が何をすべきかを議論する",
  representation: "特定の地域・集団の具体的な問題を政府に伝える",
  procedural: "時間・順番など議事の進行",
  none: "いずれでもない（私生活スキャンダル、雑談など）",
};

export const CONTRIBUTION_JA: Record<QualityContribution, string> = {
  substantive: "実質的な成果あり",
  limited: "成果は限定的",
  none: "成果なし",
};

export const CONTRIBUTION_SHORT_JA: Record<QualityContribution, string> = {
  substantive: "実質的",
  limited: "限定的",
  none: "成果なし",
};

export const CONTRIBUTION_DESC_JA: Record<QualityContribution, string> = {
  substantive: "事実が明らかになった、法案の問題点が検証された、具体的な約束が出た、まだ採られていない具体的な提案が記録に残った",
  limited: "一部に意味はあるが成果は限られる（質問が一般的・散漫で掘り下げがない等）",
  none: "政治を前に進める要素がほぼない",
};

export const ISSUE_JA: Record<QualityIssueType, string> = {
  private_scandal: "私生活スキャンダル",
  redundant: "同じ質問の繰り返し",
  evasive: "答弁のはぐらかし",
  procedural_dispute: "議事をめぐる争い",
  grandstanding: "演説・宣伝",
  softball: "お膳立て質問",
  personal_attack: "人格攻撃",
};

export const ISSUE_DESC_JA: Record<QualityIssueType, string> = {
  private_scandal: "公務と無関係な私生活への追及（公金・公的権限に関わる不祥事は行政監視であり該当しない）",
  redundant: "すでに答弁された質問を新しい角度や証拠なしに繰り返す（はぐらかされたための再質問は該当しない）",
  evasive: "具体的な質問への明らかなはぐらかし（正当な理由のない答弁拒否、紋切り型の読み上げ、別の質問への回答）",
  procedural_dispute: "時間をめぐる争い、発言撤回の要求、やじ、審議中断",
  grandstanding: "実質的な質問のない演説、党の宣伝",
  softball: "用意された好意的な答弁を引き出すだけの質問（称賛＋「御所見を」、「意義を説明してください」など）",
  personal_attack: "政策ではなく人格・能力への攻撃",
};

export const OUTCOME_JA: Record<QualityOutcome, string> = {
  new_information: "新事実が出た",
  commitment: "具体的な約束",
  proposal: "新しい提案",
};

export const OUTCOME_SHORT_JA: Record<QualityOutcome, string> = {
  new_information: "新事実",
  commitment: "約束",
  proposal: "提案",
};

export const RESPONSIBLE_JA: Record<QualityResponsible, string> = {
  questioner: "質問者",
  answerer: "答弁者",
  both: "双方",
  neither: "なし",
};

export const SIDE_JA: Record<QualitySide, string> = {
  questioner: "質問者",
  answerer: "答弁者",
  both: "双方",
};

export const EXTENT_JA: Record<QualityExtent, string> = {
  part: "一部",
  most: "大半",
};

export const TOPIC_JA: Record<string, string> = {
  Defence: "防衛",
  DecliningBirthrate: "少子化",
  NuclearPower: "原発",
  ClimateChange: "気候変動",
  Economy: "経済対策",
  LivingCostandTax: "物価高対策・減税と賃上げ",
  SocialSecurity: "社会保障全般（医療・介護）",
  Pension: "年金制度",
  FamilySeparate: "夫婦別姓",
  OnlineVoting: "オンライン投票",
  MyNumber: "マイナンバー",
  LGBT: "LGBT",
  other: "その他",
};

export function topicJa(topic: string | null | undefined): string {
  if (!topic) return "その他";
  return TOPIC_JA[topic] ?? topic;
}

/** Tailwind classes per contribution: bar fill, chip, list item accent; plus the ring colour for SVG. */
export const CONTRIBUTION_STYLE: Record<
  QualityContribution,
  { bar: string; chip: string; dot: string; item: string; ring: string; note: string }
> = {
  substantive: {
    bar: "bg-emerald-500/80",
    chip: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
    dot: "bg-emerald-500/80",
    item: "border-emerald-400/30 border-l-emerald-400/70 bg-emerald-500/10",
    ring: "rgba(16,185,129,0.55)",
    note: "border-emerald-400/25 bg-emerald-500/10",
  },
  limited: {
    bar: "bg-amber-500/80",
    chip: "border-amber-400/30 bg-amber-500/15 text-amber-100",
    dot: "bg-amber-500/80",
    item: "border-amber-400/30 border-l-amber-400/70 bg-amber-500/10",
    ring: "rgba(245,158,11,0.55)",
    note: "border-amber-400/25 bg-amber-500/10",
  },
  none: {
    bar: "bg-rose-500/80",
    chip: "border-rose-400/30 bg-rose-500/15 text-rose-100",
    dot: "bg-rose-500/80",
    item: "border-rose-400/30 border-l-rose-400/70 bg-rose-500/10",
    ring: "rgba(244,63,94,0.55)",
    note: "border-rose-400/25 bg-rose-500/10",
  },
};

export const FUNCTION_STYLE: Record<QualityFunction, { bar: string; chip: string; dot: string }> = {
  legislation: { bar: "bg-sky-500/80", chip: "border-sky-400/30 bg-sky-500/15 text-sky-100", dot: "bg-sky-500/80" },
  oversight: { bar: "bg-violet-500/80", chip: "border-violet-400/30 bg-violet-500/15 text-violet-100", dot: "bg-violet-500/80" },
  policy: { bar: "bg-cyan-500/80", chip: "border-cyan-400/30 bg-cyan-500/15 text-cyan-100", dot: "bg-cyan-500/80" },
  representation: { bar: "bg-teal-500/80", chip: "border-teal-400/30 bg-teal-500/15 text-teal-100", dot: "bg-teal-500/80" },
  procedural: { bar: "bg-slate-400/70", chip: "border-slate-400/30 bg-slate-500/15 text-slate-100", dot: "bg-slate-400/70" },
  none: { bar: "bg-gray-500/60", chip: "border-gray-400/30 bg-gray-500/15 text-gray-200", dot: "bg-gray-500/60" },
};

export const ISSUE_CHIP = "border-rose-400/30 bg-rose-500/10 text-rose-100";
export const ISSUE_CHIP_PART = "border-amber-400/30 bg-amber-500/10 text-amber-100";
export const OUTCOME_CHIP = "border-sky-400/30 bg-sky-500/10 text-sky-100";

export function rate(n: number | undefined | null, d: number | undefined | null): number {
  if (!n || !d || !Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return 0;
  return Math.max(0, Math.min(1, n / d));
}

export function pct(x: number, digits = 0): string {
  const f = Math.pow(10, digits);
  return `${Math.round(x * 100 * f) / f}%`;
}

export function issueTotal(c: { part: number; most: number } | undefined): number {
  return c ? (c.part ?? 0) + (c.most ?? 0) : 0;
}

export function issueLabel(i: QualityIssue): string {
  return `${ISSUE_JA[i.type] ?? i.type}（${SIDE_JA[i.by] ?? i.by}・${EXTENT_JA[i.extent] ?? i.extent}）`;
}

export function speechIdOf(issueId: string, order: number): string {
  return `${issueId}_${String(order).padStart(3, "0")}`;
}

/** speechID → the exchange it belongs to, for every exchange in a person's file. */
export function indexExchanges(exchanges: QualityExchange[] | null | undefined): Map<string, QualityExchange> {
  const map = new Map<string, QualityExchange>();
  for (const ex of exchanges ?? []) {
    for (const o of ex.orders ?? []) {
      const id = speechIdOf(ex.issue_id, o);
      if (!map.has(id)) map.set(id, ex);
    }
    if (!map.has(ex.start_speech_id)) map.set(ex.start_speech_id, ex);
  }
  return map;
}

export function yearMonth(d: string | null | undefined): string {
  if (!d) return "";
  const [y, m] = d.slice(0, 7).split("-");
  return `${y}年${Number(m)}月`;
}

/** Per-person metrics the explorer can rank by. Each returns null when the denominator is too small to mean anything. */
export type QualityMetricKey =
  | "substantive"
  | "flagged"
  | "softball"
  | "grandstanding"
  | "proposal"
  | "new_information"
  | "evasive";

export const QUALITY_METRICS: Array<{
  key: QualityMetricKey;
  label: string;
  role: "questioner" | "answerer";
  hint: string;
}> = [
  { key: "substantive", label: "実質的な成果があった割合", role: "questioner", hint: "質問者として始めたやり取りのうち、contribution が「実質的」のもの" },
  { key: "flagged", label: "問題点が指摘された割合", role: "questioner", hint: "質問者側に一つ以上の問題点が付いたやり取り" },
  { key: "softball", label: "お膳立て質問の割合", role: "questioner", hint: "用意された好意的な答弁を引き出すだけの質問が指摘されたやり取り" },
  { key: "grandstanding", label: "演説・宣伝の割合", role: "questioner", hint: "実質的な質問のない演説が指摘されたやり取り" },
  { key: "proposal", label: "新しい提案を示した割合", role: "questioner", hint: "政府がまだ採用していない具体的な提案が出たやり取り" },
  { key: "new_information", label: "新事実を引き出した割合", role: "questioner", hint: "公になっていなかった事実・数字が答弁で出たやり取り" },
  { key: "evasive", label: "答弁のはぐらかしの割合（答弁者として）", role: "answerer", hint: "答弁者として関わったやり取りのうち、はぐらかしが指摘されたもの" },
];

export function metricValue(p: QualityPerson, key: QualityMetricKey): { value: number; n: number } | null {
  const q: QualityCounts | null = p.as_questioner;
  const a: QualityAnswerCounts | null = p.as_answerer;
  switch (key) {
    case "substantive":
      return q ? { value: rate(q.contribution.substantive, q.n), n: q.n } : null;
    case "flagged":
      return q ? { value: rate(q.flagged?.any, q.n), n: q.n } : null;
    case "softball":
      return q ? { value: rate(issueTotal(q.issues.softball), q.n), n: q.n } : null;
    case "grandstanding":
      return q ? { value: rate(issueTotal(q.issues.grandstanding), q.n), n: q.n } : null;
    case "proposal":
      return q ? { value: rate(q.outcomes.proposal, q.n), n: q.n } : null;
    case "new_information":
      return q ? { value: rate(q.outcomes.new_information, q.n), n: q.n } : null;
    case "evasive":
      return a ? { value: rate(issueTotal(a.issues.evasive), a.n), n: a.n } : null;
  }
}

/** The questioner-side issue types a person was flagged for, most frequent first, as shares of their exchanges. */
export function topIssues(q: QualityCounts | null, limit = 2, minShare = 0.03): Array<{ type: QualityIssueType; share: number }> {
  if (!q || !q.n) return [];
  return QUESTIONER_ISSUE_TYPES.map((type) => ({ type, share: rate(issueTotal(q.issues[type]), q.n) }))
    .filter((x) => x.share >= minShare)
    .sort((a, b) => b.share - a.share)
    .slice(0, limit);
}
