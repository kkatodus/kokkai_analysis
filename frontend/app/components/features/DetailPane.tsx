"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { track } from "@vercel/analytics";
import type {
  AllParliamentMemberTableData,
  ElectionHistoryData,
  IdeologyData,
  PersonStances,
  PersonStanceTopic,
  QualityAggregate,
  QualityExchange,
  SpeechRecord,
} from "@/app/types";
import { fetchElectionHistory } from "@/app/lib/services/electionHistoryService";
import { fetchPersonStances } from "@/app/lib/services/ideologyService";
import { fetchFirstPageOfAllTopics, fetchPersonQuality, fetchSpeechPage } from "@/app/lib/services/speechesService";
import { ElectionHistoryCard, electionHouse } from "@/app/components/features/ElectionHistoryCard";
import { SpeechRecordCard, type SpeechTopicState } from "@/app/components/features/SpeechRecordCard";
import { PersonQualityPanel } from "@/app/components/features/PersonQualityPanel";
import { PersonStancePanel } from "@/app/components/features/PersonStancePanel";
import { ContributionBar } from "@/app/components/visualizations/SpeechQualityBarList";
import { indexExchanges, issueTotal, pct, rate } from "@/app/lib/quality";
import { SidePane } from "@/app/components/shared/Dialog";
import { Tabs, TabPanel } from "@/app/components/shared/Tabs";
import { Badge } from "@/app/components/shared/Badge";
import { Heading } from "@/app/components/shared/Card";
import { ListRow } from "@/app/components/shared/ListRow";

interface DetailPaneProps {
  personId: string;
  isOpen: boolean;
  onClose: () => void;
  allParliamentMemberTable?: AllParliamentMemberTableData[] | null;
  qualityAggregate: QualityAggregate | null;
  /** the loaded ideology file: percentile bars and the stale-file guard for the 立場 tab */
  ideologyData?: IdeologyData | null;
  /** 立場 tab's 「手法と限界」 link: show the ideology card's methodology slides */
  onOpenMethodology?: () => void;
  setSelectedIssueId: (issueId: string | null) => void;
  setSelectedIssueSpeechId: (speechId: string | null) => void;
  /** the guided tour or the scatter plot asks for a tab; `nonce` changes on every request; `topic` (a topic
   * slug) scrolls the 立場 tab to that card */
  panelRequest?: { panel: (typeof PANEL_ORDER)[number]; nonce: number; topic?: string | null } | null;
  onPanelChange?: (panel: (typeof PANEL_ORDER)[number]) => void;
}

function normalizeTopicKey(topic: string): string {
  return topic.endsWith(".jsonl") ? topic.slice(0, -".jsonl".length) : topic;
}

function topicDisplayName(topic: string): string {
  const t = normalizeTopicKey(topic);
  return t.replace(/_/g, " ");
}


const PANEL_ORDER = ["speeches", "quality", "history", "stances"] as const;
const PANEL_COUNT = PANEL_ORDER.length;
/** each panel takes 1/N of the strip; written out so Tailwind sees the class */
const panelClass = "flex h-full w-1/4 min-w-0 flex-col gap-2 overflow-hidden";
const PANEL_LABEL: Record<(typeof PANEL_ORDER)[number], string> = {
  speeches: "発言",
  quality: "やり取り",
  history: "選挙履歴",
  stances: "立場",
};
/** Initial pane width: DESIGN.md side-pane width. */
const DEFAULT_PANE_W = 420;

export function DetailPane({
  personId,
  isOpen,
  onClose,
  allParliamentMemberTable,
  qualityAggregate,
  ideologyData = null,
  onOpenMethodology,
  setSelectedIssueId,
  setSelectedIssueSpeechId,
  panelRequest,
  onPanelChange,
}: DetailPaneProps) {
  const [paneWidthPx, setPaneWidthPx] = useState<number>(DEFAULT_PANE_W);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(DEFAULT_PANE_W);
  const headingId = useId();
  const tabsId = useId();
  const resizingRef = useRef<boolean>(false);

  const [activePanel, setActivePanel] = useState<(typeof PANEL_ORDER)[number]>("speeches");

  const [stanceFocus, setStanceFocus] = useState<{ topic: string | null; nonce: number } | null>(null);
  const handledRequestRef = useRef<number | null>(null);
  const lastPersonRef = useRef<string | null>(null);
  // One effect decides the tab, so a new person opened together with a request (a scatter click) lands on
  // the requested tab, and any other new person resets to 発言.
  useEffect(() => {
    if (!isOpen || !personId) {
      lastPersonRef.current = null;
      return;
    }
    if (panelRequest && panelRequest.nonce !== handledRequestRef.current) {
      handledRequestRef.current = panelRequest.nonce;
      setActivePanel(panelRequest.panel);
      if (panelRequest.panel === "stances") setStanceFocus({ topic: panelRequest.topic ?? null, nonce: panelRequest.nonce });
    } else if (lastPersonRef.current !== personId) {
      setActivePanel("speeches");
    }
    lastPersonRef.current = personId;
  }, [isOpen, personId, panelRequest]);
  useEffect(() => {
    onPanelChange?.(activePanel);
  }, [activePanel, onPanelChange]);
  useEffect(() => {
    if (isOpen && personId) track("DetailPanelView", { panel: activePanel });
  }, [activePanel, isOpen, personId]);
  const [history, setHistory] = useState<ElectionHistoryData[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [speechTopics, setSpeechTopics] = useState<SpeechTopicState[] | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [selectedTopicKey, setSelectedTopicKey] = useState<string | null>(null);
  const [speechLoading, setSpeechLoading] = useState(false);
  // 発言 list fills the pane: header, やり取り summary and tabs hide while the 発言 tab shows
  const [speechesExpanded, setSpeechesExpanded] = useState(false);

  const [exchanges, setExchanges] = useState<QualityExchange[] | null>(null);
  const [exchangesError, setExchangesError] = useState<string | null>(null);
  const [exchangesLoading, setExchangesLoading] = useState(false);

  const [stances, setStances] = useState<PersonStances | null>(null);
  const [stancesError, setStancesError] = useState<string | null>(null);
  const [stancesLoading, setStancesLoading] = useState(false);
  const [markedSpeeches, setMarkedSpeeches] = useState<{ topicKey: string; topicJp: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    const clampWidth = (w: number) => {
      const max = Math.min(980, Math.max(320, window.innerWidth - 32));
      return Math.max(320, Math.min(w, max));
    };
    const onResize = () => setPaneWidthPx((w) => clampWidth(w));
    onResize();
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
    setStances(null);
    setStancesError(null);
    setStancesLoading(true);
    setMarkedSpeeches(null);
    (async () => {
      try {
        const data = await fetchPersonStances(personId);
        if (!cancelled) setStances(data);
      } catch (e) {
        if (!cancelled) setStancesError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setStancesLoading(false);
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
      } catch {
        // shown as is; never the exception message (DESIGN.md "Loading, empty and error states")
        if (!cancelled) setSpeechError("発言データを読み込めませんでした。時間をおいて開き直してください。");
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
      setSpeechError(null);
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
    } catch {
      setSpeechError("このページの発言を読み込めませんでした。");
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

  // 「元になった発言を見る」: switch to 発言 on that topic, first page, with the contributing speeches marked
  const showStanceSpeeches = (topic: PersonStanceTopic) => {
    track("StanceProvenanceClick", { topic: topic.topic });
    setMarkedSpeeches({ topicKey: topic.topic_en, topicJp: topic.topic_jp, ids: new Set(topic.speech_ids ?? []) });
    setSelectedTopicKey(topic.topic_en);
    setActivePanel("speeches");
    void ensureSpeechPage(topic.topic_en, 0);
  };

  // Identity for the header (DESIGN.md "Cards, panels, side panes"): party, house and district come from
  // the most recent election in the history, the only per-person source the pane loads.
  const latest = sorted?.[0] ?? null;
  const identity = latest
    ? [latest.party, electionHouse(latest), latest.district].filter((x): x is string => !!x && x.trim() !== "")
    : [];

  if (!isOpen || !personId) {
    return null;
  }

  const q = qualityPerson?.as_questioner;
  const a = qualityPerson?.as_answerer;
  const hasQuality = !!(q?.n || a?.n);
  const expanded = speechesExpanded && activePanel === "speeches";

  return (
    <SidePane
      width={paneWidthPx}
      onClose={onClose}
      labelledBy={headingId}
      resizeLabel="詳細パネルの幅を変える"
      onResizeStart={(e) => {
        if (e.button !== 0) return;
        resizingRef.current = true;
        resizeStartXRef.current = e.clientX;
        resizeStartWidthRef.current = paneWidthPx;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "ew-resize";
      }}
      data-tour="detail-pane"
    >
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <header className="mb-3 pr-10" hidden={expanded}>
          <Heading level={2} size="headline-sm" id={headingId}>
            {personMeta?.name_kanji ?? "（氏名不明）"}
          </Heading>
          <p className="text-body-sm text-ink-muted">{personMeta?.name_kana ?? "（かな不明）"}</p>
          {identity.length ? (
            <p className="mt-1 text-body-sm text-ink">
              {identity.join("・")}
              <span className="text-caption text-ink-muted">（直近の選挙）</span>
            </p>
          ) : null}
        </header>

        {qualityPerson && hasQuality && !expanded ? (
          <ListRow
            onClick={() => setActivePanel("quality")}
            // the やり取り tab is one tap away, so the sheet below md keeps its height for the list
            className="mb-3 hidden md:block"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-title-sm text-ink-strong">やり取りの評価（AI判定）</span>
              <Badge tone={activePanel === "quality" ? "accent" : "neutral"}>
                {activePanel === "quality" ? "表示中" : "タブを開く"}
              </Badge>
            </span>
            <span className="mb-2 block text-data text-ink-muted">
              {q?.n ? `質問${q.n.toLocaleString()}件` : ""}
              {q?.n && a?.n ? "・" : ""}
              {a?.n ? `答弁${a.n.toLocaleString()}件` : ""}
            </span>
            {(() => {
              // summarise the role this person mostly plays
              if (q && q.n > 0 && q.n >= (a?.n ?? 0)) {
                return (
                  <>
                    <ContributionBar counts={q.contribution} className="h-2.5" />
                    <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
                      <span className="flex items-center gap-1">
                        <span aria-hidden className="inline-block size-2 rounded-full bg-success" />
                        成果あり {pct(rate(q.contribution.substantive, q.n))}
                      </span>
                      <span className="flex items-center gap-1">
                        <span aria-hidden className="inline-block size-2 rounded-full bg-warning" />
                        限定的 {pct(rate(q.contribution.limited, q.n))}
                      </span>
                      <span className="flex items-center gap-1">
                        <span aria-hidden className="inline-block size-2 rounded-full bg-error" />
                        成果なし {pct(rate(q.contribution.none, q.n))}
                      </span>
                      <span className="ml-auto">問題点の指摘 {pct(rate(q.flagged?.any, q.n))}</span>
                    </span>
                  </>
                );
              }
              if (a && a.n > 0) {
                return (
                  <span className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
                    <span>答弁者として</span>
                    <span>答弁のはぐらかし {pct(rate(issueTotal(a.issues.evasive), a.n), 1)}</span>
                    <span>新事実が出た答弁 {pct(rate(a.outcomes.new_information, a.n), 1)}</span>
                    <span>具体的な約束 {pct(rate(a.outcomes.commitment, a.n), 1)}</span>
                  </span>
                );
              }
              return null;
            })()}
          </ListRow>
        ) : null}

        {/* a wrapper, since the tab track's inline-flex would override a `hidden` class */}
        <div className="mb-3 self-start" hidden={expanded}>
          <Tabs
            items={PANEL_ORDER.map((p) => ({ value: p, label: PANEL_LABEL[p] }))}
            value={activePanel}
            onChange={setActivePanel}
            label="詳細パネルの表示内容"
            idBase={tabsId}
          />
        </div>

        {/* The views sit side by side and slide, so switching reads as a tab change, not a collapse. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <div
            className="flex h-full transition-transform duration-200 ease-out motion-reduce:transition-none"
            style={{ width: `${PANEL_COUNT * 100}%`, transform: `translateX(-${PANEL_ORDER.indexOf(activePanel) * (100 / PANEL_COUNT)}%)` }}
          >
            <div className={panelClass} aria-hidden={activePanel !== "speeches"} inert={activePanel !== "speeches"}>
              <TabPanel idBase={tabsId} value="speeches" className="flex h-full min-h-0 flex-col">
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
                  markedSpeeches={markedSpeeches}
                  onClearMarked={() => setMarkedSpeeches(null)}
                  expanded={expanded}
                  onToggleExpanded={() => {
                    track("SpeechListExpandToggle", { expanded: !speechesExpanded });
                    setSpeechesExpanded((v) => !v);
                  }}
                />
              </TabPanel>
            </div>
            <div className={panelClass} aria-hidden={activePanel !== "quality"} inert={activePanel !== "quality"}>
              <TabPanel idBase={tabsId} value="quality" className="flex h-full min-h-0 flex-col">
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
              </TabPanel>
            </div>
            <div className={panelClass} aria-hidden={activePanel !== "history"} inert={activePanel !== "history"}>
              <TabPanel idBase={tabsId} value="history" className="flex h-full min-h-0 flex-col">
                <ElectionHistoryCard history={history} historyError={historyError} sorted={sorted} />
              </TabPanel>
            </div>
            <div className={panelClass} aria-hidden={activePanel !== "stances"} inert={activePanel !== "stances"}>
              <TabPanel idBase={tabsId} value="stances" className="flex h-full min-h-0 flex-col">
                <PersonStancePanel
                  key={personId}
                  personId={personId}
                  stances={stances}
                  loading={stancesLoading}
                  error={stancesError}
                  ideologyData={ideologyData}
                  focus={stanceFocus}
                  onShowSpeeches={showStanceSpeeches}
                  onOpenMethodology={onOpenMethodology}
                />
              </TabPanel>
            </div>
          </div>
        </div>
      </div>
    </SidePane>
  );
}
