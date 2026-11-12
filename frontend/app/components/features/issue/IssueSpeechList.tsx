"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IssueSpeechRecord } from "@/app/types";
import type { SegmentKind } from "@/app/components/features/issue/speechSegmentation";
import { SEGMENT_PALETTES, type SpeechSegment } from "@/app/components/features/issue/speechSegmentation";
import { FiExternalLink } from "react-icons/fi";
import { ExchangeChips } from "@/app/components/features/QualityChips";
import { Button, ButtonLink } from "@/app/components/shared/Button";
import { listRowClass, rowTitleClass } from "@/app/components/shared/ListRow";
import { Empty } from "@/app/components/shared/states";
import { cx } from "@/app/components/shared/cx";

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

  // One header per labelled exchange, on its first speech: what it was for, what it produced, and why.
  const segmentNoteByStartIndex = useMemo(() => {
    const map = new Map<number, SpeechSegment>();
    for (const seg of segments ?? []) {
      if (seg.kind === "unknown" || !seg.quality) continue;
      if (seg.starterIndex !== undefined && seg.starterIndex !== seg.startIndex) continue; // a run split by an interjection
      map.set(seg.startIndex, seg);
    }
    return map;
  }, [segments]);

  useEffect(() => {
    const el = itemRefs.current[safeIndex];
    if (!el) return;
    // Keep the focused item in view while the dial is dragged.
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [safeIndex]);

  if (!speeches.length) {
    return <Empty message="この会議の発言はありません。" />;
  }

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <ul className="flex flex-col gap-2">
        {speeches.map((s, i) => {
          const active = i === safeIndex;
          const key = makeSpeechKey(s, i);
          const accent = accentByIndex?.[i] ?? null;
          const isExpanded = expandedKeys.has(key);
          const note = segmentNoteByStartIndex.get(i) ?? null;
          const textId = `${key}-text`;
          return (
            <li key={key} className="flex flex-col gap-2">
              {note && note.quality ? (
                <div
                  className={cx(
                    "rounded-lg border border-line border-l-2 p-3 text-body-sm",
                    SEGMENT_PALETTES[note.quality.contribution].itemClassName,
                    SEGMENT_PALETTES[note.quality.contribution].noteClassName,
                  )}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-label-sm">AI判定</span>
                    <ExchangeChips
                      fn={note.quality.function}
                      contribution={note.quality.contribution}
                      issues={note.quality.issues}
                      outcomes={note.quality.outcomes}
                      prefixed
                    />
                  </div>
                  <p>{note.quality.reason}</p>
                </div>
              ) : null}

              {/* The whole row selects the speech: a full-size button sits under the row's own controls. */}
              <div
                ref={(node) => {
                  itemRefs.current[i] = node;
                }}
                className={cx(
                  "relative p-3 text-body-md",
                  listRowClass(active),
                  !active && "text-ink",
                  accent && cx("border-l-2", SEGMENT_PALETTES[accent].itemClassName),
                )}
              >
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  aria-describedby={textId}
                  aria-label={`${i + 1}番目の発言：${s.speaker}`}
                  onClick={() => onSelectIndex(i)}
                  className="absolute inset-0 cursor-pointer rounded-lg"
                />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={rowTitleClass(active)}>{s.speaker}</span>
                      <span className="text-data text-ink-muted">#{s.speechOrder}</span>
                    </div>
                    {s.speakerGroup && <div className="text-caption text-ink-muted">{s.speakerGroup}</div>}
                  </div>

                  <div className="relative flex shrink-0 items-center gap-2">
                    {s.speechURL && (
                      <ButtonLink
                        href={s.speechURL}
                        variant="ghost"
                        size="sm"
                        icon={<FiExternalLink aria-hidden className="size-3.5" />}
                        title="国会会議録の原文ページを開く"
                      >
                        原文を開く
                      </ButtonLink>
                    )}
                    <span className="text-data text-ink-muted">{i + 1}</span>
                  </div>
                </div>

                <div id={textId} className={cx("mt-2 whitespace-pre-wrap", !isExpanded && "line-clamp-4")}>
                  {s.speech}
                </div>

                <div className="relative mt-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpandedKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                  >
                    {isExpanded ? "折りたたむ" : "全文を表示"}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
