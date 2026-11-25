/** Helpers for the detail pane's 立場 tab (specs/stance-summaries-panel §6). */
import type { IdeologyData, IdeologySubTopic } from "@/app/types";

/** Under this many opinion sentences a position is marked 「根拠が少ない」 (pane and scatter tooltip). */
export const THIN_EVIDENCE_OPINIONS = 10;

const MODEL_NAMES: Record<string, string> = {
  "claude-sonnet-5-5": "Claude Sonnet 5.5",
  "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
};

export function modelDisplayName(model: string | null | undefined): string {
  if (!model) return "AI";
  return model
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => MODEL_NAMES[m] ?? m)
    .join(" / ");
}

/** "2026-10-22T23:58:49+09:00" → "2026-10" */
export function yearMonth(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 7) : "";
}

export interface SummaryItem {
  kind: "point" | "para";
  head: string;
  body: string[];
}

const NUMBERED = /^\s*(?:[０-９0-9]+)\s*[．.、)）]\s*/;
const BULLET = /^\s*[・•\-－]\s*/;

/** Numbered lines become items, 「・」 lines their sub-text; anything else is a plain paragraph. */
export function parseSummary(text: string): SummaryItem[] {
  const out: SummaryItem[] = [];
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (NUMBERED.test(line)) {
      out.push({ kind: "point", head: line.replace(NUMBERED, ""), body: [] });
    } else if (BULLET.test(line) && out.length && out[out.length - 1].kind === "point") {
      out[out.length - 1].body.push(line.replace(BULLET, ""));
    } else {
      out.push({ kind: "para", head: line.replace(BULLET, ""), body: [] });
    }
  }
  return out;
}

export interface SubTopicPosition {
  subTopic: string;
  label: string;
  pro: string;
  con: string;
  /** share of scaled people with x strictly below this person's, 0…1 */
  percentile: number;
  /** percentile of the split: the calibrated midpoint, or the median person on uncalibrated axes */
  cut: number;
  /** dot position on the bar, 0…1: rank rescaled so the split sits at the centre (0.5) */
  bar: number;
  /** neutral band in bar coordinates, calibrated axes only */
  band: [number, number] | null;
  /** share of this person's side that sits further toward that side's end, 0…1 */
  sideShare: number;
  /** which side of the calibrated midpoint this person is on; null on uncalibrated axes */
  side: "pro" | "con" | "neutral" | null;
  n: number;
}

function percentileOf(xs: number[], x: number): number {
  if (xs.length <= 1) return 0.5;
  let below = 0;
  for (const v of xs) if (v < x) below++;
  return below / (xs.length - 1);
}

/** Rank → bar: everyone below the split fills the left half, everyone above it the right half. */
function toBar(p: number, cut: number): number {
  if (p < cut) return cut > 0 ? (0.5 * p) / cut : 0;
  return cut < 1 ? 0.5 + (0.5 * (p - cut)) / (1 - cut) : 1;
}

function subTopicPosition(sub: IdeologySubTopic, personId: number): SubTopicPosition | null {
  const pts = (sub["1d"]?.data ?? []).filter((p) => p.person_id != null && p.ref_point === "none");
  const me = pts.find((p) => p.person_id === personId);
  if (!me) return null;
  const xs = pts.map((p) => p.x).sort((a, b) => a - b);
  const ax = sub.axis;
  const calibrated = ax?.midpoint != null && ax.neutral_from != null && ax.neutral_to != null;
  const median = xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2;
  const side = !calibrated ? null : me.x >= ax.neutral_to! ? "pro" : me.x < ax.neutral_from! ? "con" : "neutral";
  const percentile = percentileOf(xs, me.x);
  const cut = percentileOf(xs, calibrated ? ax.midpoint! : median);
  const onPro = side ? side === "pro" || (side === "neutral" && me.x >= ax!.midpoint!) : percentile >= cut;
  const sideShare = onPro ? (cut < 1 ? (1 - percentile) / (1 - cut) : 0) : cut > 0 ? percentile / cut : 0;
  return {
    subTopic: sub.sub_topic,
    label: sub.sub_topic_jp ?? sub.sub_topic,
    pro: sub.axis?.pro ?? "賛成",
    con: sub.axis?.con ?? "反対",
    percentile,
    cut,
    bar: toBar(percentile, cut),
    band: calibrated ? [toBar(percentileOf(xs, ax.neutral_from!), cut), toBar(percentileOf(xs, ax.neutral_to!), cut)] : null,
    sideShare: Math.min(1, Math.max(0, sideShare)),
    side,
    n: xs.length,
  };
}

/** topic slug → this person's positions on each sub-topic (topics where they are not plotted are absent). */
export function personPositions(ideology: IdeologyData | null, personId: number): Map<string, SubTopicPosition[]> {
  const out = new Map<string, SubTopicPosition[]>();
  for (const t of ideology?.data ?? []) {
    const rows = t.sub_topics.map((s) => subTopicPosition(s, personId)).filter((p): p is SubTopicPosition => !!p);
    if (rows.length) out.set(t.topic, rows);
  }
  return out;
}

/** First clause of an axis sentence, for the bar's end labels; the full text goes in the title. */
export function firstClause(text: string, max = 18): string {
  const cut = text.split(/[、。,（(]/)[0] ?? text;
  return cut.length > max ? cut.slice(0, max) + "…" : cut;
}
