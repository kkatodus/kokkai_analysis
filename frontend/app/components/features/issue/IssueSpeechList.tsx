"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IssueSpeechRecord } from "@/app/types";
import type { SegmentKind } from "@/app/components/features/issue/speechSegmentation";
import { SEGMENT_PALETTES, type SpeechSegment } from "@/app/components/features/issue/speechSegmentation";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function makeSpeechKey(s: IssueSpeechRecord, index: number): string {
  return `${s.speechID ?? "speech"}-${index}`;
}

export function IssueSpeechList({
  speeches,
  selectedIndex,
  onSelectIndex,
  accentByIndex,
  segments,
}: {
  speeches: IssueSpeechRecord[];
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  accentByIndex?: Array<Exclude<SegmentKind, "unknown"> | null>;
  segments?: SpeechSegment[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const safeIndex = useMemo(() => clamp(selectedIndex, 0, Math.max(0, speeches.length - 1)), [selectedIndex, speeches]);

  const segmentNoteByStartIndex = useMemo(() => {
    const map = new Map<number, { kind: Exclude<SegmentKind, "unknown">; reason: string }>();
    for (const seg of segments ?? []) {
      if (seg.kind === "unknown") continue;
      if (seg.kind === "rt_pt") continue; // skip productive+relevant segments
      const starter = speeches[seg.startIndex];
      const reason = String(starter?.quality_reason ?? "").trim();
      if (!reason) continue;
      map.set(seg.startIndex, { kind: seg.kind, reason });
    }
    return map;
  }, [segments, speeches]);

  useEffect(() => {
    const el = itemRefs.current[safeIndex];
    if (!el) return;
    // Keep the focused item in view while the dial is dragged.
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [safeIndex]);

  if (!speeches.length) {
    return <div className="p-2 text-[12px] text-gray-400">発言がありません。</div>;
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-400/15 bg-slate-950/20"
    >
      <div className="grid gap-2 p-2">
        {speeches.map((s, i) => {
          const active = i === safeIndex;
          const key = makeSpeechKey(s, i);
          const accent = accentByIndex?.[i] ?? null;
          const accentClasses = accent ? SEGMENT_PALETTES[accent].itemClassName : "";
          const isExpanded = expandedKeys.has(key);
          const note = segmentNoteByStartIndex.get(i) ?? null;
          return (
            <div key={key} className="grid gap-1.5">
              {note ? (
                <div
                  className={
                    "rounded-lg border px-2 py-1 text-[11px] text-gray-200 " +
                    (note.kind === "rt_pf"
                      ? "border-amber-400/25 bg-amber-500/10"
                      : "border-rose-400/25 bg-rose-500/10")
                  }
                >
                  <span className="mr-2 font-semibold">判定理由</span>
                  <span className="text-gray-100/90">{note.reason}</span>
                </div>
              ) : null}

              <div
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                className={
                  "rounded-lg border border-l-4 p-2 transition-colors " +
                  (accent
                    ? ` ${accentClasses} `
                    : " border-slate-400/15 border-l-slate-400/10 bg-[#020617] hover:bg-white/5 ") +
                  (active ? " ring-2 ring-cyan-400/35" : "")
                }
                role="button"
                tabIndex={0}
                onClick={() => onSelectIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectIndex(i);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[12px] font-semibold text-gray-50">{s.speaker}</div>
                      <div className="text-[10px] text-gray-400">#{s.speechOrder}</div>
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-400">{s.speakerGroup}</div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <a
                      href={s.speechURL}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer rounded-lg border border-slate-400/20 bg-slate-950/20 px-2 py-1 text-[11px] font-semibold text-gray-200 transition-all hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-50 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_18px_rgba(34,211,238,0.18)] focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                      title="国会会議録の原文ページを開く"
                    >
                      原文を開く
                    </a>
                    <div className="text-[10px] text-gray-400">{i + 1}</div>
                  </div>
                </div>

                <div
                  className={
                    "mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-200 " + (isExpanded ? "" : "line-clamp-4")
                  }
                >
                  {s.speech}
                </div>

                <div className="mt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                    className="cursor-pointer rounded-lg border border-slate-400/20 bg-slate-950/20 px-2 py-1 text-[11px] font-semibold text-gray-200 hover:bg-white/5"
                  >
                    {isExpanded ? "折りたたむ" : "全文を表示"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

