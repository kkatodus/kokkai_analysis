"use client";

import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FiExternalLink } from "react-icons/fi";
import type { IssueSpeechRecord, IssueMeta } from "@/app/types";
import { DialSelector } from "@/app/components/features/issue/DialSelector";
import { IssueSpeechList } from "@/app/components/features/issue/IssueSpeechList";
import { IssueLegend } from "@/app/components/features/issue/IssueLegend";
import { SidePane } from "@/app/components/shared/Dialog";
import { ButtonLink } from "@/app/components/shared/Button";
import { Empty, ErrorState, Loading } from "@/app/components/shared/states";
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
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(420);
  const resizingRef = useRef<boolean>(false);
  const initAppliedRef = useRef<string | null>(null);

  const [issueData, setIssueData] = useState<IssueByIdResponse | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [selectedSpeechIndex, setSelectedSpeechIndex] = useState<number>(0);
  const [reloadKey, setReloadKey] = useState(0);
  const titleId = useId();

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
  }, [isOpen, issueId, reloadKey]);

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

  const meta = issueData?.meta ?? null;

  const onResizeStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    resizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = paneWidthPx;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  };

  return (
    <SidePane
      side="left"
      width={paneWidthPx}
      onClose={onClose}
      labelledBy={titleId}
      onResizeStart={onResizeStart}
      resizeLabel="会議パネルの幅を変える"
      data-tour="issue-pane"
    >
      <div className="@container flex min-h-0 flex-1 flex-col gap-3 p-4">
        <header className="flex flex-col gap-2 pr-10">
          <h2 id={titleId} className="text-headline-sm text-ink-strong">
            {meta?.nameOfMeeting ? `会議：${meta.nameOfMeeting}` : "会議"}
          </h2>
          {(meta?.date || meta?.pdfURL) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {meta?.date && <span className="text-body-sm text-ink-muted">会議日：{formatDateJa(meta.date)}</span>}
              {meta?.pdfURL && (
                <ButtonLink
                  href={meta.pdfURL}
                  size="sm"
                  icon={<FiExternalLink aria-hidden className="size-3.5" />}
                  title="国会会議録の会議録ページを開く"
                >
                  会議録を開く
                </ButtonLink>
              )}
            </div>
          )}
          <IssueLegend />
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {issueLoading ? (
            <Loading rows={4} label="会議の発言を読み込み中…" />
          ) : issueError ? (
            <ErrorState message="会議の発言を読み込めませんでした。" onRetry={() => setReloadKey((k) => k + 1)} />
          ) : issueData && issueData.meta && Array.isArray(issueData.speeches) ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 @xl:flex-row">
              <div className="flex shrink-0 flex-col items-center justify-start gap-3 @xl:w-55">
                <DialSelector
                  count={orderedSpeeches.length}
                  selectedIndex={selectedSpeechIndex}
                  onChangeIndex={setSelectedSpeechIndex}
                  label="発言ダイアル"
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
            <Empty message="この会議のデータが見つかりませんでした。" />
          )}
        </div>
      </div>
    </SidePane>
  );
}

/** "2026-07-16" → "2026年7月16日"; anything else is shown as given. */
function formatDateJa(date: string): string {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(date);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : date;
}
