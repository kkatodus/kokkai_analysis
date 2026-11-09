"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AllParliamentMemberTableData, ElectionHistoryData, QualityAggregate, QualityExchange, SpeechRecord } from "@/app/types";
import { fetchElectionHistory } from "@/app/lib/services/electionHistoryService";
import { fetchFirstPageOfAllTopics, fetchPersonQuality, fetchSpeechPage } from "@/app/lib/services/speechesService";
import { ElectionHistoryCard } from "@/app/components/features/ElectionHistoryCard";
import { SpeechRecordCard, type SpeechTopicState } from "@/app/components/features/SpeechRecordCard";
import { PersonQualityPanel } from "@/app/components/features/PersonQualityPanel";
import { ContributionBar } from "@/app/components/visualizations/SpeechQualityBarList";
import { indexExchanges, issueTotal, pct, rate } from "@/app/lib/quality";

interface DetailPaneProps {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
  qualityAggregate: QualityAggregate | null;
  setSelectedIssueId: (issueId: string | null) => void;
  setSelectedIssueSpeechId: (speechId: string | null) => void;
}

function normalizeTopicKey(topic: string): string {
  return topic.endsWith(".jsonl") ? topic.slice(0, -".jsonl".length) : topic;
}

function topicDisplayName(topic: string): string {
  const t = normalizeTopicKey(topic);
  return t.replace(/_/g, " ");
}


const PANEL_ORDER = ["speeches", "quality", "history"] as const;

export function DetailPane({
  personId,
  isOpen,
  onClose,
  allParliamentMemberTable,
  qualityAggregate,
  setSelectedIssueId,
  setSelectedIssueSpeechId,
}: DetailPaneProps) {
  const [paneWidthPx, setPaneWidthPx] = useState<number>(380);
  const [isNarrow, setIsNarrow] = useState(false);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(380);
  const resizingRef = useRef<boolean>(false);

  const [activePanel, setActivePanel] = useState<(typeof PANEL_ORDER)[number]>("speeches");
  const [history, setHistory] = useState<ElectionHistoryData[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [speechTopics, setSpeechTopics] = useState<SpeechTopicState[] | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);
  const [speechLoading, setSpeechLoading] = useState(false);

  const [exchanges, setExchanges] = useState<QualityExchange[] | null>(null);
  const [exchangesError, setExchangesError] = useState<string | null>(null);
  const [exchangesLoading, setExchangesLoading] = useState(false);

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

  const qualityPerson = useMemo(() => {
    const arr = qualityAggregate?.persons ?? [];
    return arr.find((d) => String(d.person_id) === String(personId)) ?? null;
  }, [qualityAggregate, personId]);

  const exchangeIndex = useMemo(() => indexExchanges(exchanges), [exchanges]);

  useEffect(() => {
    if (!isOpen || !personId) return;
    let cancelled = false;
    setExchanges(null);
    setExchangesError(null);
    setExchangesLoading(true);
    (async () => {
      try {
        const data = await fetchPersonQuality(personId);
        if (!cancelled) setExchanges(data);
      } catch (e) {
        if (!cancelled) setExchangesError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setExchangesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, personId]);

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
                aria-selected={activePanel === "quality"}
                onClick={() => setActivePanel("quality")}
                className={
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors " +
                  (activePanel === "quality"
                    ? "bg-cyan-500/20 text-cyan-100"
                    : "text-gray-300 hover:bg-slate-900/50")
                }
              >
                やり取り
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

          {qualityPerson && (qualityPerson.as_questioner?.n || qualityPerson.as_answerer?.n) ? (
            <button
              type="button"
              onClick={() => setActivePanel("quality")}
              className="mt-2 w-full rounded-xl border border-slate-400/15 bg-slate-950/20 p-2 text-left transition-colors hover:bg-white/5"
              title="やり取りの評価を見る"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[11px] font-semibold text-gray-200">やり取りの評価（AI判定）</div>
                <div className="text-[11px] text-gray-400">
                  {qualityPerson.as_questioner?.n ? `質問 ${qualityPerson.as_questioner.n} 件` : ""}
                  {qualityPerson.as_questioner?.n && qualityPerson.as_answerer?.n ? "・" : ""}
                  {qualityPerson.as_answerer?.n ? `答弁 ${qualityPerson.as_answerer.n} 件` : ""}
                  <span className={"ml-2 rounded-full border px-1.5 py-0.5 text-[10px] " + (activePanel === "quality" ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100" : "border-slate-400/25 text-gray-300")}>
                    {activePanel === "quality" ? "表示中" : "タブを開く →"}
                  </span>
                </div>
              </div>
              {(() => {
                const q = qualityPerson.as_questioner;
                const a = qualityPerson.as_answerer;
                // summarise the role this person mostly plays
                if (q && q.n > 0 && q.n >= (a?.n ?? 0)) {
                  return (
                    <>
                      <ContributionBar counts={q.contribution} className="h-2.5" />
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500/80" />
                          実質的な成果あり {pct(rate(q.contribution.substantive, q.n))}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-500/80" />
                          限定的 {pct(rate(q.contribution.limited, q.n))}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-full bg-rose-500/80" />
                          成果なし {pct(rate(q.contribution.none, q.n))}
                        </div>
                        <div className="ml-auto">問題点の指摘 {pct(rate(q.flagged?.any, q.n))}</div>
                      </div>
                    </>
                  );
                }
                if (a && a.n > 0) {
                  return (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-400">
                      <div>答弁者として</div>
                      <div>答弁のはぐらかし {pct(rate(issueTotal(a.issues.evasive), a.n), 1)}</div>
                      <div>新事実が出た答弁 {pct(rate(a.outcomes.new_information, a.n), 1)}</div>
                      <div>具体的な約束 {pct(rate(a.outcomes.commitment, a.n), 1)}</div>
                    </div>
                  );
                }
                return null;
              })()}
            </button>
          ) : null}
        </div>

        {/* The three views sit side by side and slide, so switching reads as a tab change, not a collapse. */}
        <div className="min-h-0 flex-1 overflow-hidden pr-1">
          <div
            className="flex h-full w-[300%] transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${PANEL_ORDER.indexOf(activePanel) * (100 / 3)}%)` }}
          >
            <div className="flex h-full w-1/3 min-w-0 flex-col gap-2 overflow-hidden" aria-hidden={activePanel !== "speeches"} inert={activePanel !== "speeches"}>
              <SpeechRecordCard
                exchangeIndex={exchangeIndex}
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
            </div>
            <div className="flex h-full w-1/3 min-w-0 flex-col gap-2 overflow-hidden" aria-hidden={activePanel !== "quality"} inert={activePanel !== "quality"}>
              <PersonQualityPanel
                person={qualityPerson}
                totals={qualityAggregate?.totals ?? null}
                exchanges={exchanges}
                loading={exchangesLoading}
                error={exchangesError}
                onSelectIssueId={(issueId, speechId) => {
                  setSelectedIssueId(issueId);
                  setSelectedIssueSpeechId(speechId ?? null);
                }}
              />
            </div>
            <div className="flex h-full w-1/3 min-w-0 flex-col gap-2 overflow-hidden" aria-hidden={activePanel !== "history"} inert={activePanel !== "history"}>
              <ElectionHistoryCard history={history} historyError={historyError} sorted={sorted} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

