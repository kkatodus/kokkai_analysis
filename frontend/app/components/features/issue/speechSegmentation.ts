"use client";

import type { IssueSpeechRecord } from "@/app/types";

export type SegmentKind = "rt_pt" | "rt_pf" | "rf_pf" | "unknown";

export type SpeechSegment = {
  startIndex: number; // inclusive
  endIndex: number; // exclusive
  kind: SegmentKind;
};

export type SegmentPalette = {
  ringCss: string; // for SVG strokes
  itemClassName: string; // tailwind classes for list items
};

export const SEGMENT_PALETTES: Record<Exclude<SegmentKind, "unknown">, SegmentPalette> = {
  // Match colors used in RelevanceProductivityBarList:
  // emerald = 関連×生産性あり
  rt_pt: {
    ringCss: "rgba(16,185,129,0.55)", // emerald-500-ish
    itemClassName: "border-emerald-400/30 border-l-emerald-400/70 bg-emerald-500/10",
  },
  // amber = 関連×生産性なし
  rt_pf: {
    ringCss: "rgba(245,158,11,0.55)", // amber-500-ish
    itemClassName: "border-amber-400/30 border-l-amber-400/70 bg-amber-500/10",
  },
  // rose = 非関連×生産性なし
  rf_pf: {
    ringCss: "rgba(244,63,94,0.55)", // rose-500-ish
    itemClassName: "border-rose-400/30 border-l-rose-400/70 bg-rose-500/10",
  },
};

function hasLabel(s: IssueSpeechRecord): boolean {
  // Only treat explicit booleans (encoded as "True"/"False") as segment starters.
  // Undefined/missing and null should NOT start a new segment.
  return s.is_productive === "True" || s.is_productive === "False" || s.is_relevant === "True" || s.is_relevant === "False";
}

function toBool(v: IssueSpeechRecord["is_productive"] | IssueSpeechRecord["is_relevant"]): boolean | null {
  if (v === "True") return true;
  if (v === "False") return false;
  return null;
}

export function classifySegmentKind(s: IssueSpeechRecord): SegmentKind {
  const r = toBool(s.is_relevant);
  const p = toBool(s.is_productive);
  if (r === true && p === true) return "rt_pt";
  if (r === true && p === false) return "rt_pf";
  if (r === false && p === false) return "rf_pf";
  return "unknown";
}

/**
 * Build continuous segments using sparse flags.
 *
 * Rule:
 * - Until the first occurrence of labels, keep default (kind=unknown).
 * - After first occurrence, each labeled speech defines the segment kind until the next labeled speech.
 */
export function buildSpeechSegments(speeches: IssueSpeechRecord[]): SpeechSegment[] {
  const n = speeches.length;
  if (!n) return [];

  const labeledIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (hasLabel(speeches[i])) labeledIndices.push(i);
  }

  if (!labeledIndices.length) {
    return [{ startIndex: 0, endIndex: n, kind: "unknown" }];
  }

  const segments: SpeechSegment[] = [];
  const first = labeledIndices[0];
  if (first > 0) segments.push({ startIndex: 0, endIndex: first, kind: "unknown" });

  for (let k = 0; k < labeledIndices.length; k++) {
    const start = labeledIndices[k];
    const end = k + 1 < labeledIndices.length ? labeledIndices[k + 1] : n;
    const kind = classifySegmentKind(speeches[start]);
    segments.push({ startIndex: start, endIndex: end, kind });
  }

  return segments;
}

export function buildAccentByIndex(
  speeches: IssueSpeechRecord[],
  segments: SpeechSegment[]
): Array<Exclude<SegmentKind, "unknown"> | null> {
  const n = speeches.length;
  const out: Array<Exclude<SegmentKind, "unknown"> | null> = Array.from({ length: n }, () => null);
  for (const seg of segments) {
    if (seg.kind === "unknown") continue;
    for (let i = seg.startIndex; i < seg.endIndex; i++) out[i] = seg.kind;
  }
  return out;
}

