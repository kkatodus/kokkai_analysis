"use client";

import type { IssueSpeechRecord, QualityContribution, SpeechQuality } from "@/app/types";

export type SegmentKind = QualityContribution | "unknown";

export type SpeechSegment = {
  startIndex: number; // inclusive
  endIndex: number; // exclusive
  kind: SegmentKind;
  /** The exchange label, on labelled segments. */
  quality?: SpeechQuality;
  /** Index of the speech that carries the label (the exchange's first speech). */
  starterIndex?: number;
};

export type SegmentPalette = {
  ringCss: string; // CSS colour for SVG strokes (the dial ring)
  itemClassName: string; // leading edge of the list rows in the exchange
  noteClassName: string; // the AI判定 note above the exchange
};

// Quality scale on the semantic tokens (DESIGN.md "Quality scale"): success / warning / error.
export const SEGMENT_PALETTES: Record<Exclude<SegmentKind, "unknown">, SegmentPalette> = {
  substantive: { ringCss: "var(--color-success)", itemClassName: "border-l-success", noteClassName: "bg-success-soft text-on-success-soft" },
  limited: { ringCss: "var(--color-warning)", itemClassName: "border-l-warning", noteClassName: "bg-warning-soft text-on-warning-soft" },
  none: { ringCss: "var(--color-error)", itemClassName: "border-l-error", noteClassName: "bg-error-soft text-on-error-soft" },
};

function qualityOf(s: IssueSpeechRecord): SpeechQuality | null {
  const q = s.quality;
  if (!q || typeof q !== "object") return null;
  if (!q.contribution || !Array.isArray(q.speech_ids)) return null;
  return q;
}

/**
 * Build segments from the `quality` objects on exchange-starting speeches (specs/speech-quality-ui §2.3).
 *
 * Every speech listed in a label's `speech_ids` belongs to that exchange; speeches that no label
 * covers (opening remarks, meetings before the labelled window, plenary) stay `unknown`.
 * Segments are the maximal runs of consecutive speeches with the same label.
 */
export function buildSpeechSegments(speeches: IssueSpeechRecord[]): SpeechSegment[] {
  const n = speeches.length;
  if (!n) return [];

  const indexById = new Map<string, number>();
  speeches.forEach((s, i) => indexById.set(String(s.speechID), i));

  // which label (by starter index) owns each speech
  const owner: Array<number | null> = Array.from({ length: n }, () => null);
  const labels = new Map<number, SpeechQuality>();
  speeches.forEach((s, i) => {
    const q = qualityOf(s);
    if (!q) return;
    labels.set(i, q);
    owner[i] = i;
    for (const id of q.speech_ids) {
      const j = indexById.get(String(id));
      if (j !== undefined && owner[j] === null) owner[j] = i;
    }
  });

  const segments: SpeechSegment[] = [];
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || owner[i] !== owner[start]) {
      const o = owner[start];
      if (o === null) {
        segments.push({ startIndex: start, endIndex: i, kind: "unknown" });
      } else {
        const q = labels.get(o)!;
        segments.push({ startIndex: start, endIndex: i, kind: q.contribution, quality: q, starterIndex: o });
      }
      start = i;
    }
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
