"use client";

import { useEffect, useRef, useState } from "react";
import type { IssueSpeechRecord, IssueMeta } from "@/app/types";
import { DialSelector } from "@/app/components/features/issue/DialSelector";
import { IssueSpeechList } from "@/app/components/features/issue/IssueSpeechList";
import { IssueLegend } from "@/app/components/features/issue/IssueLegend";
import {
  buildAccentByIndex,
  buildSpeechSegments,
  SEGMENT_PALETTES,
  type SpeechSegment,
} from "@/app/components/features/issue/speechSegmentation";

interface IssuePaneProps {
  issueId: string;
  isOpen: boolean;
  onClose: () => void;
  initialSelectedSpeechId?: string | null;
}

type IssueByIdResponse = {
  speeches: IssueSpeechRecord[] | null;
  meta: IssueMeta | null;
};

export function IssuePane({ issueId, isOpen, onClose, initialSelectedSpeechId }: IssuePaneProps) {
  const [paneWidthPx, setPaneWidthPx] = useState<number>(420);
  const [isNarrow, setIsNarrow] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(420);
  const resizingRef = useRef<boolean>(false);
  const initAppliedRef = useRef<string | null>(null);

  const [issueData, setIssueData] = useState<IssueByIdResponse | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [selectedSpeechIndex, setSelectedSpeechIndex] = useState<number>(0);

  const orderedSpeeches: IssueSpeechRecord[] = (() => {
    const speeches = issueData?.speeches;
    if (!Array.isArray(speeches) || !speeches.length) return [];
    // Ensure a stable meeting timeline: everything (dial, list, segments) uses the same order.
    return [...speeches].sort((a, b) => {
      const ao = Number.isFinite(a.speechOrder) ? a.speechOrder : 0;
      const bo = Number.isFinite(b.speechOrder) ? b.speechOrder : 0;
      if (ao !== bo) return ao - bo;
      return String(a.speechID ?? "").localeCompare(String(b.speechID ?? ""));
    });
  })();

  const segments: SpeechSegment[] = (() => {
    if (!orderedSpeeches.length) return [];
    return buildSpeechSegments(orderedSpeeches);
  })();

  const ringSegments = (() => {
    if (!orderedSpeeches.length) return [];
    return segments
      .filter((s) => s.kind !== "unknown")
      .map((s) => ({
        startIndex: s.startIndex,
        endIndex: s.endIndex,
        ringCss: SEGMENT_PALETTES[s.kind as Exclude<typeof s.kind, "unknown">].ringCss,
      }));
  })();

  const accentByIndex = (() => {
    if (!orderedSpeeches.length) return undefined;
    return buildAccentByIndex(orderedSpeeches, segments);
  })();

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mql.matches);
    update();
    // Safari fallback
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  // Fetch issue detail when opened / issueId changes.
  useEffect(() => {
    if (!isOpen || !issueId) return;
    let cancelled = false;
    setIssueLoading(true);
    setIssueError(null);
    setIssueData(null);
    setSelectedSpeechIndex(0);
    initAppliedRef.current = null;

    (async () => {
      try {
        const res = await fetch(`/api/speeches/get_issue_by_id?issue_id=${encodeURIComponent(issueId)}`, {
          cache: "no-store",
        });
        const text = await res.text().catch(() => "");
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`);
        }
        const json = JSON.parse(text) as IssueByIdResponse;
        if (!cancelled) setIssueData(json);
      } catch (e) {
        if (!cancelled) setIssueError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setIssueLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, issueId]);

  // Preselect the originating speech (from DetailPane) once we have the meeting speeches loaded.
  useEffect(() => {
    if (!isOpen) return;
    const speechId = initialSelectedSpeechId ?? null;
    const key = `${issueId}:${speechId ?? ""}`;
    if (initAppliedRef.current === key) return;
    if (!speechId) {
      initAppliedRef.current = key;
      return;
    }
    if (!orderedSpeeches.length) return;
    const idx = orderedSpeeches.findIndex((s) => String(s.speechID) === String(speechId));
    if (idx >= 0) setSelectedSpeechIndex(idx);
    initAppliedRef.current = key;
  }, [isOpen, issueId, initialSelectedSpeechId, orderedSpeeches]);

  useEffect(() => {
    const clampWidth = (w: number) => {
      const max = Math.min(980, Math.max(320, window.innerWidth - 32));
      return Math.max(320, Math.min(w, max));
    };
    const onResize = () => setPaneWidthPx((w) => clampWidth(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const clampWidth = (w: number) => {
      const max = Math.min(980, Math.max(320, window.innerWidth - 32));
      return Math.max(320, Math.min(w, max));
    };

    const onMove = (e: PointerEvent) => {
      if (!resizingRef.current) return;
      const dx = e.clientX - resizeStartXRef.current;
      const next = clampWidth(resizeStartWidthRef.current + dx);
      setPaneWidthPx(next);
    };

    const onUp = () => {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  if (!isOpen || !issueId) return null;

  return (
    <div
      className="fixed inset-y-4 left-4 z-40 max-w-[calc(100%-32px)] translate-x-0 opacity-100 transition-all duration-200 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[70%] max-md:w-full max-md:max-w-full max-md:translate-y-0"
      style={{ width: isNarrow ? "100%" : `${paneWidthPx}px` }}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-400/35 bg-linear-to-br from-[#020617] to-[#020617] p-3.5 shadow-2xl">
        {/* Right resize handle (desktop only) */}
        <div
          className="absolute inset-y-4 right-0 z-50 hidden w-2 cursor-ew-resize rounded-r-[18px] hover:bg-slate-400/10 md:block"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize issue pane"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            resizingRef.current = true;
            resizeStartXRef.current = e.clientX;
            resizeStartWidthRef.current = paneWidthPx;
            document.body.style.userSelect = "none";
            document.body.style.cursor = "ew-resize";
          }}
        />

        <div className="mb-1 flex items-center justify-end">
          <button
            onClick={onClose}
            className="flex h-5.5 w-5.5 items-center justify-center rounded-full border-0 bg-slate-900/90 text-sm text-gray-400 transition-colors hover:bg-blue-700/90 hover:text-gray-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-2">
          <div className="flex flex-col gap-1">
            <div className="text-base font-semibold text-gray-50">会議：{issueData?.meta?.nameOfMeeting}</div>
            <div className="text-[11px] text-gray-400">会議ID: {issueId}</div>
            <IssueLegend />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden text-[12px] text-gray-300">
          {issueLoading ? (
            <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-2 text-gray-400">読み込み中…</div>
          ) : issueError ? (
            <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-2 text-red-300">{issueError}</div>
          ) : issueData && issueData.meta && Array.isArray(issueData.speeches) ? (
            <div className="flex h-full flex-col gap-3 md:flex-row">
              <div className="flex shrink-0 flex-col items-center justify-start gap-3 md:w-[220px]">
                <DialSelector
                  count={orderedSpeeches.length}
                  selectedIndex={selectedSpeechIndex}
                  onChangeIndex={setSelectedSpeechIndex}
                  label="発言セレクター"
                  segments={ringSegments}
                />
              </div>

              <IssueSpeechList
                speeches={orderedSpeeches}
                selectedIndex={selectedSpeechIndex}
                onSelectIndex={setSelectedSpeechIndex}
                accentByIndex={accentByIndex}
                segments={segments}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-2 text-gray-400">データなし</div>
          )}
        </div>
      </div>
    </div>
  );
}

