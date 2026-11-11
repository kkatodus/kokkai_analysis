/**
 * Highlight palette keyed by topic_name_en (specs/topic-keyword-highlight §3 #6).
 * Class strings are literal so Tailwind keeps them. Topics without an entry get a hashed pick.
 */

export type TopicHighlightColor = { mark: string; dot: string };

const PALETTE: TopicHighlightColor[] = [
  { mark: "bg-rose-400/20 text-rose-100", dot: "bg-rose-400" },
  { mark: "bg-pink-400/20 text-pink-100", dot: "bg-pink-400" },
  { mark: "bg-orange-400/20 text-orange-100", dot: "bg-orange-400" },
  { mark: "bg-lime-400/20 text-lime-100", dot: "bg-lime-400" },
  { mark: "bg-sky-400/20 text-sky-100", dot: "bg-sky-400" },
  { mark: "bg-yellow-400/20 text-yellow-100", dot: "bg-yellow-400" },
  { mark: "bg-emerald-400/20 text-emerald-100", dot: "bg-emerald-400" },
  { mark: "bg-teal-400/20 text-teal-100", dot: "bg-teal-400" },
  { mark: "bg-fuchsia-400/20 text-fuchsia-100", dot: "bg-fuchsia-400" },
  { mark: "bg-indigo-400/20 text-indigo-100", dot: "bg-indigo-400" },
  { mark: "bg-violet-400/20 text-violet-100", dot: "bg-violet-400" },
  { mark: "bg-red-400/20 text-red-100", dot: "bg-red-400" },
];

export const TOPIC_HIGHLIGHT_COLORS: Record<string, TopicHighlightColor> = {
  Defence: PALETTE[0],
  DecliningBirthrate: PALETTE[1],
  NuclearPower: PALETTE[2],
  ClimateChange: PALETTE[3],
  Economy: PALETTE[4],
  LivingCostandTax: PALETTE[5],
  SocialSecurity: PALETTE[6],
  Pension: PALETTE[7],
  FamilySeparate: PALETTE[8],
  OnlineVoting: PALETTE[9],
  MyNumber: PALETTE[10],
  LGBT: PALETTE[11],
};

/** Topic tab: one topic, the primary tint (amber is left to warnings and 参政). */
export const TOPIC_TAB_MARK = "bg-primary-soft text-on-primary-soft";
/** 全発言: a span whose words belong to more than one topic. */
export const SHARED_MARK = "bg-surface-hover text-ink-strong underline decoration-dashed decoration-ink-muted underline-offset-2";

export function topicHighlightColor(topicEn: string): TopicHighlightColor {
  const known = TOPIC_HIGHLIGHT_COLORS[topicEn];
  if (known) return known;
  let h = 0;
  for (const ch of topicEn) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
