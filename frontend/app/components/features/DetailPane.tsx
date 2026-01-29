"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AllParliamentMemberTableData, ElectionHistoryData, RelevanceAndProductivityData, SpeechRecord } from "@/app/types";
import { fetchElectionHistory } from "@/app/lib/services/electionHistoryService";
import { fetchFirstPageOfAllTopics, fetchSpeechPage } from "@/app/lib/services/speechesService";
import { ElectionHistoryCard } from "@/app/components/features/ElectionHistoryCard";
import { SpeechRecordCard, type SpeechTopicState } from "@/app/components/features/SpeechRecordCard";

interface DetailPaneProps {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
  relevanceAndProductivityData: RelevanceAndProductivityData[] | null;
  setSelectedIssueId: (issueId: string | null) => void;
  setSelectedIssueSpeechId: (speechId: string | null) => void;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function normalizeProp(raw: number): number {
  // Expected 0..1, but tolerate 0..100.
  if (!Number.isFinite(raw)) return 0;
  const n = raw > 1.00001 ? raw / 100 : raw;
  return clamp01(n);
}

function percentLabel(n01: number): string {
  return `${Math.round(clamp01(n01) * 1000) / 10}%`;
}

function normalizeTopicKey(topic: string): string {
  return topic.endsWith(".jsonl") ? topic.slice(0, -".jsonl".length) : topic;
}

function topicDisplayName(topic: string): string {
  const t = normalizeTopicKey(topic);
  return t.replace(/_/g, " ");
}


export function DetailPane({
  personId,
  isOpen,
  onClose,
  allParliamentMemberTable,
  relevanceAndProductivityData,
  setSelectedIssueId,
  setSelectedIssueSpeechId,
}: DetailPaneProps) {
  const [paneWidthPx, setPaneWidthPx] = useState<number>(380);
  const [isNarrow, setIsNarrow] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(380);
  const resizingRef = useRef<boolean>(false);

  const [activePanel, setActivePanel] = useState<"speeches" | "history">("speeches");
  const [history, setHistory] = useState<ElectionHistoryData[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [speechTopics, setSpeechTopics] = useState<SpeechTopicState[] | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);
  const [speechLoading, setSpeechLoading] = useState(false);

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
      const next = clampWidth(resizeStartWidthRef.current - dx);
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

  const personIndex = useMemo(() => {
    const map = new Map<number, AllParliamentMemberTableData>();
    for (const row of allParliamentMemberTable ?? []) {
      if (row?.person_id) map.set(Number(row.person_id), row);
    }
    return map;
  }, [allParliamentMemberTable]);

  const personMeta = useMemo(() => {
    if (!personId) return null;
    return personIndex.get(Number(personId)) ?? null;
  }, [personIndex, personId]);

  const relevanceStats = useMemo(() => {
    const arr = relevanceAndProductivityData ?? [];
    return arr.find((d) => String(d.person_id) === String(personId)) ?? null;
  }, [relevanceAndProductivityData, personId]);

  useEffect(() => {
    if (!isOpen || !personId) return;
    let cancelled = false;
    setHistory(null);
    setHistoryError(null);
    (async () => {
      try {
        const data = await fetchElectionHistory(personId);
        if (!cancelled) setHistory(data);
      } catch (e) {
        if (!cancelled) setHistoryError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, personId]);

  useEffect(() => {
    if (!isOpen || !personId) return;
    let cancelled = false;
    setSpeechTopics(null);
    setSpeechError(null);
    setSelectedTopicKey(null);
    setActivePanel("speeches");
    (async () => {
      try {
        const data = await fetchFirstPageOfAllTopics(personId);
        const rawTopics = Array.isArray((data as any)?.first_pages_of_all_topics)
          ? ((data as any).first_pages_of_all_topics as Array<{
              topic: string;
              page: SpeechRecord[];
              number_of_pages?: number;
            }>)
          : [];

        const topics: SpeechTopicState[] = rawTopics.map((t) => {
          const topicKey = normalizeTopicKey(String(t.topic ?? ""));
          const totalPages =
            typeof t.number_of_pages === "number" && Number.isFinite(t.number_of_pages) ? t.number_of_pages : null;
          return {
            topic: String(t.topic ?? ""),
            topicKey,
            displayName: topicDisplayName(String(t.topic ?? "")),
            pagesByNumber: { 0: Array.isArray(t.page) ? (t.page as SpeechRecord[]) : [] },
            currentPage: 0,
            totalPages,
          };
        });

        topics.sort((a, b) => {
          const aIsAll = a.topicKey === "all_speeches";
          const bIsAll = b.topicKey === "all_speeches";
          if (aIsAll && !bIsAll) return -1;
          if (!aIsAll && bIsAll) return 1;
          return 0;
        });

        if (!cancelled) {
          setSpeechTopics(topics);
          setSelectedTopicKey(topics[0]?.topicKey ?? null);
        }
      } catch (e) {
        if (!cancelled) setSpeechError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, personId]);

  const selectedTopic = useMemo(() => {
    if (!speechTopics || !selectedTopicKey) return null;
    return speechTopics.find((t) => t.topicKey === selectedTopicKey) ?? null;
  }, [speechTopics, selectedTopicKey]);

  async function ensureSpeechPage(topicKey: string, pageNumber: number) {
    if (!speechTopics) return;
    const topic = speechTopics.find((t) => t.topicKey === topicKey);
    if (!topic) return;
    if (topic.pagesByNumber[pageNumber]) {
      setSpeechTopics((prev) =>
        (prev ?? []).map((t) => (t.topicKey === topicKey ? { ...t, currentPage: pageNumber } : t))
      );
      return;
    }

    setSpeechLoading(true);
    setSpeechError(null);
    try {
      const data = await fetchSpeechPage(personId, topicKey, pageNumber);
      setSpeechTopics((prev) =>
        (prev ?? []).map((t) => {
          if (t.topicKey !== topicKey) return t;
          return {
            ...t,
            currentPage: data.page_number,
            totalPages: Number.isFinite(data.total_pages) ? data.total_pages : t.totalPages,
            pagesByNumber: { ...t.pagesByNumber, [data.page_number]: Array.isArray(data.page) ? data.page : [] },
          };
        })
      );
    } catch (e) {
      setSpeechError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSpeechLoading(false);
    }
  }

  const sorted = useMemo(() => {
    if (!history) return null;
    const num = (s: string) => {
      const m = String(s ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };
    const toKey = (h: ElectionHistoryData) => {
      const y = num(h.year);
      const m = num(h.month);
      const d = num(h.day);
      return y * 10000 + m * 100 + d;
    };
    // Newest first
    return [...history].sort((a, b) => toKey(b) - toKey(a));
  }, [history]);

  const setSelectedTopicKeySafe = (topicKey: string) => setSelectedTopicKey(topicKey);

  if (!isOpen || !personId) {
    return null;
  }

  return (
      <div
        className="fixed inset-y-4 right-4 z-40 max-w-[calc(100%-32px)] translate-x-0 opacity-100 transition-all duration-200 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[70%] max-md:w-full max-md:max-w-full max-md:translate-y-0"
        style={{ width: isNarrow ? "100%" : `${paneWidthPx}px` }}
      >
      <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-400/35 bg-linear-to-br from-[#020617] to-[#020617] p-3.5 shadow-2xl">
        {/* Left resize handle (desktop only) */}
        <div
          className="absolute inset-y-4 left-0 z-50 hidden w-2 cursor-ew-resize rounded-l-[18px] hover:bg-slate-400/10 md:block"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize detail pane"
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
        <div className="mb-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-base font-semibold text-gray-50">
              {personMeta?.name_kanji ?? "（氏名不明）"}
            </div>

            <div
              className="flex shrink-0 items-center rounded-full border border-slate-400/20 bg-slate-950/30 p-0.5"
              role="tablist"
              aria-label="Detail pane view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "speeches"}
                onClick={() => setActivePanel("speeches")}
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                  (activePanel === "speeches"
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-gray-300 hover:bg-slate-900/50")
                }
              >
                発言
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePanel === "history"}
                onClick={() => setActivePanel("history")}
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                  (activePanel === "history"
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-gray-300 hover:bg-slate-900/50")
                }
              >
                選挙履歴
              </button>
            </div>
          </div>
          <div className="text-[11px] text-gray-400">
            {personMeta?.name_kana ?? "（かな不明）"}
          </div>

          <div className="mt-2 rounded-xl border border-slate-400/15 bg-slate-950/20 p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-[11px] font-semibold text-gray-200">関連度・生産性（割合・AI判定）</div>
              <div className="text-[11px] text-gray-400">
                分類された発言数:{" "}
                {relevanceStats && Number.isFinite(relevanceStats.Total_Count) ? relevanceStats.Total_Count : "—"}
              </div>
            </div>

            {relevanceStats ? (
              (() => {
                const tt = normalizeProp(relevanceStats.prop_R_True_P_True);
                const tf = normalizeProp(relevanceStats.prop_R_True_P_False);
                const ff = normalizeProp(relevanceStats.prop_R_False_P_False);
                return (
                  <>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-900/70 ring-1 ring-slate-400/10">
                      <div className="flex h-full w-full">
                        <div
                          className="h-full bg-emerald-500/80"
                          style={{ width: `${Math.round(tt * 10000) / 100}%` }}
                          title={`関連×生産性あり: ${percentLabel(tt)}`}
                        />
                        <div
                          className="h-full bg-amber-500/80"
                          style={{ width: `${Math.round(tf * 10000) / 100}%` }}
                          title={`関連×生産性なし: ${percentLabel(tf)}`}
                        />
                        <div
                          className="h-full bg-rose-500/80"
                          style={{ width: `${Math.round(ff * 10000) / 100}%` }}
                          title={`非関連×生産性なし: ${percentLabel(ff)}`}
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
                        関連×生産性あり: {percentLabel(tt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
                        関連×生産性なし: {percentLabel(tf)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-rose-500/80" />
                        非関連×生産性なし: {percentLabel(ff)}
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="text-[11px] text-gray-500">関連度・生産性データがありません。</div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pr-1">
          {activePanel === "history" ? (
            <ElectionHistoryCard history={history} historyError={historyError} sorted={sorted} />
          ) : (
            <SpeechRecordCard
              speechTopics={speechTopics}
              speechError={speechError}
              speechLoading={speechLoading}
              selectedTopicKey={selectedTopicKey}
              setSelectedTopicKey={setSelectedTopicKeySafe}
              selectedTopic={selectedTopic}
              ensureSpeechPage={ensureSpeechPage}
              onSelectIssueId={(issueId, speechId) => {
                setSelectedIssueId(issueId);
                setSelectedIssueSpeechId(speechId ?? null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

