import type { QualityExchange, SpeechRecord } from "@/app/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/app/components/shared/Button";
import { Heading } from "@/app/components/shared/Card";
import { Chip } from "@/app/components/shared/Chip";
import { Badge } from "@/app/components/shared/Badge";
import { Pager } from "@/app/components/shared/Pager";
import { Empty, ErrorState, Loading, Spinner } from "@/app/components/shared/states";
import { ExchangeChips } from "@/app/components/features/QualityChips";
import { HighlightedSpeech } from "@/app/components/features/HighlightedSpeech";
import { useSpeechTopics } from "@/app/lib/hooks/useSpeechTopics";
import { topicHighlightColor } from "@/app/lib/topicHighlightColors";

const TOPIC_NAME_JA_BY_EN: Record<string, string> = {
  // Fallback until /api/speeches/topics loads (`data/resource/experiment_config.json` topic_name_en -> topic_name)
  Defence: "防衛",
  DecliningBirthrate: "少子化",
  NuclearPower: "原発",
  ClimateChange: "気候変動",
  Economy: "経済対策",
  LivingCostandTax: "物価高対策・減税と賃上げ",
  SocialSecurity: "社会保障全般の見直し（医療・介護）",
  Pension: "年金制度改革・基礎年金底上げ",
  FamilySeparate: "夫婦別姓",
  OnlineVoting: "オンライン投票",
  MyNumber: "マイナンバー",
  LGBT: "LGBT",
};

function normalizeTopicLabelKey(raw: string): string {
  const t = String(raw ?? "").trim();
  const noExt = t.endsWith(".jsonl") ? t.slice(0, -".jsonl".length) : t;
  return noExt.replace(/\s+/g, "");
}

function isAllSpeechesKey(key: string): boolean {
  return key === "all_speeches" || key === "allSpeeches";
}

function translateTopicName(raw: string, namesFromApi?: Map<string, string>): string {
  const key = normalizeTopicLabelKey(raw);
  if (!key) return raw;

  if (isAllSpeechesKey(key)) return "全発言";

  const direct = namesFromApi?.get(key) ?? TOPIC_NAME_JA_BY_EN[key];
  if (direct) return direct;

  const lower = key.toLowerCase();
  const found = Object.entries(TOPIC_NAME_JA_BY_EN).find(([en]) => en.toLowerCase() === lower);
  if (found) return found[1];

  // Fallback: make it readable (e.g. snake_case -> "snake case")
  return key.replace(/_/g, " ");
}

/** "2025-08-05" → "2025年8月5日"; anything else is returned unchanged. */
export function formatJaDate(raw: string | null | undefined): string {
  const s = String(raw ?? "");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日` : s;
}

export type SpeechTopicState = {
  topic: string; // raw topic string from backend (often a filename)
  topicKey: string; // normalized key used for `/speeches/get`
  displayName: string;
  pagesByNumber: Record<number, SpeechRecord[]>;
  currentPage: number;
  totalPages: number | null;
};

interface SpeechRecordCardProps {
  speechTopics: SpeechTopicState[] | null;
  speechError: string | null;
  speechLoading: boolean;
  selectedTopicKey: string | null;
  setSelectedTopicKey: (topicKey: string) => void;
  selectedTopic: SpeechTopicState | null;
  ensureSpeechPage: (topicKey: string, pageNumber: number) => Promise<void>;
  onSelectIssueId?: (issueId: string, speechId?: string | null) => void;
  /** speechID → the labelled exchange it belongs to (specs/speech-quality-ui §4) */
  exchangeIndex?: Map<string, QualityExchange>;
  /** speeches a 立場 summary was built from, marked in the list (specs/stance-summaries-panel §6.3) */
  markedSpeeches?: { topicKey: string; topicJp: string; ids: Set<string> } | null;
  onClearMarked?: () => void;
  /** the list fills the whole pane (the pane hides its header and tabs); the toggle shows only when this is set */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function SpeechRecordCard({
  speechTopics,
  speechError,
  speechLoading,
  selectedTopicKey,
  setSelectedTopicKey,
  selectedTopic,
  ensureSpeechPage,
  onSelectIssueId,
  exchangeIndex,
  markedSpeeches,
  onClearMarked,
  expanded = false,
  onToggleExpanded,
}: SpeechRecordCardProps) {
  const showMarks = !!markedSpeeches && markedSpeeches.topicKey === selectedTopicKey;
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  // the page last asked for, so 再試行 can ask again after a failed page load
  const [requestedPage, setRequestedPage] = useState<{ topicKey: string; page: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const keywordTopics = useSpeechTopics();
  const topicNamesJa = useMemo(
    () => new Map((keywordTopics ?? []).map((t) => [t.topic_name_en, t.topic_name])),
    [keywordTopics]
  );
  const selectedKey = selectedTopic ? normalizeTopicLabelKey(selectedTopic.topicKey) : "";
  const highlightMode: "topic" | "all" = isAllSpeechesKey(selectedKey) ? "all" : "topic";
  // topic tab: that topic's words only; 全発言: every topic (specs/topic-keyword-highlight §6)
  const highlightTopics = useMemo(
    () => (highlightMode === "all" ? keywordTopics ?? [] : (keywordTopics ?? []).filter((t) => t.topic_name_en === selectedKey)),
    [keywordTopics, highlightMode, selectedKey]
  );

  // a new page or topic starts at the top of the list (the pager sits below it)
  const currentPage = selectedTopic?.currentPage ?? 0;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentPage, selectedTopicKey]);

  const topicsForTabs = [...(speechTopics ?? [])].sort((a, b) => {
    const aKey = normalizeTopicLabelKey(a.topicKey);
    const bKey = normalizeTopicLabelKey(b.topicKey);
    if (isAllSpeechesKey(aKey) !== isAllSpeechesKey(bKey)) return isAllSpeechesKey(aKey) ? -1 : 1;
    return translateTopicName(a.topicKey || a.displayName, topicNamesJa).localeCompare(
      translateTopicName(b.topicKey || b.displayName, topicNamesJa),
      "ja"
    );
  });

  const goToPage = (topicKey: string, page: number) => {
    setRequestedPage({ topicKey, page });
    void ensureSpeechPage(topicKey, page);
  };

  // A failed page load keeps the current page on screen (DESIGN.md "Lists and pagers").
  const pageError = !!speechError && speechTopics !== null;

  return (
    <section aria-labelledby="speech-card-heading" className="flex min-h-0 flex-1 flex-col" data-tour="speech-card">
      {/* expanded, the pane header is gone, so this row clears the pane's close button */}
      <div className={"flex items-center justify-between gap-2 pb-2" + (expanded ? " pr-10" : "")}>
        <Heading level={3} size="title-sm" id="speech-card-heading">
          発言（トピック別）
        </Heading>
        <span className="flex items-center gap-1">
          {speechLoading && (
            <span role="status" className="text-ink-muted">
              <Spinner />
              <span className="sr-only">読み込み中…</span>
            </span>
          )}
          {onToggleExpanded ? (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={expanded}
              onClick={onToggleExpanded}
              icon={<ExpandIcon expanded={expanded} />}
            >
              {expanded ? "元の表示に戻す" : "全体に広げる"}
            </Button>
          ) : null}
        </span>
      </div>

      {speechError && speechTopics === null && <ErrorState message={speechError} />}

      {!speechError && speechTopics === null && <Loading rows={4} label="発言を読み込み中…" />}

      {speechTopics !== null && speechTopics.length === 0 && <Empty message="この議員の発言データは見つかりませんでした。" />}

      {speechTopics && speechTopics.length > 0 && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {/* Sticky topic selection */}
          <div className="sticky top-0 z-(--z-sticky) border-b border-line-subtle bg-surface pb-2">
            <div role="group" aria-label="トピック" className="-mx-1 -mt-1 flex gap-1.5 overflow-x-auto p-1 max-md:flex-nowrap md:flex-wrap">
              {topicsForTabs.map((t) => {
                const active = t.topicKey === selectedTopicKey;
                const label = translateTopicName(t.topicKey || t.displayName, topicNamesJa);
                const tabKey = normalizeTopicLabelKey(t.topicKey);
                // colour dot = legend for the 全発言 highlights (the palette is Tailwind classes, so the dot is drawn here)
                const dot = !isAllSpeechesKey(tabKey) && keywordTopics?.length ? topicHighlightColor(tabKey).dot : null;
                return (
                  <Chip key={t.topicKey} selected={active} title={label} onClick={() => setSelectedTopicKey(t.topicKey)}>
                    {dot ? <span aria-hidden className={"mr-1.5 inline-block size-2 rounded-full align-middle " + dot} /> : null}
                    {label}
                  </Chip>
                );
              })}
            </div>

            {showMarks && markedSpeeches ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-primary-line bg-primary-soft py-1 pr-1 pl-3 text-body-sm text-on-primary-soft">
                <span>
                  「{markedSpeeches.topicJp}」の要約の根拠になった発言{markedSpeeches.ids.size.toLocaleString()}件に印を付けています
                </span>
                {onClearMarked ? (
                  <Button variant="ghost" size="sm" onClick={onClearMarked}>
                    解除
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Speech list */}
          {selectedTopic && (
            <ul className="grid gap-2 py-2">
              {(selectedTopic.pagesByNumber[selectedTopic.currentPage] ?? []).map((s, idx) => {
                const key = `${selectedTopic.topicKey}-${selectedTopic.currentPage}-${s.speechID ?? "speech"}-${idx}`;
                const isExpanded = expandedKeys.has(key);
                const speechText = String(s.speech ?? "");
                const isLong = speechText.length > 220;
                const isMarked = showMarks && !!s.speechID && !!markedSpeeches?.ids.has(String(s.speechID));
                const issueId = s.meta?.issueID ?? s.issueID ?? null;
                const ex = exchangeIndex?.get(String(s.speechID));

                return (
                  <li
                    key={key}
                    className={"rounded-lg border border-line bg-surface-raised p-3 " + (isMarked ? "edge-primary" : "")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-title-sm text-ink-strong">{s.speaker}</div>
                          {isMarked ? <Badge tone="accent">要約の根拠</Badge> : null}
                          {ex ? (
                            <div title={`AI判定：${ex.reason}`}>
                              <ExchangeChips fn={ex.function} contribution={ex.contribution} issues={ex.issues} outcomes={ex.outcomes} compact prefixed />
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-caption text-ink-muted">
                          {formatJaDate(s.meta?.date)}
                          {s.meta?.nameOfMeeting ? `・${s.meta.nameOfMeeting}` : ""}
                        </div>
                      </div>

                      {onSelectIssueId && (
                        <Button
                          size="sm"
                          disabled={!issueId}
                          onClick={() => {
                            if (!issueId) return;
                            onSelectIssueId(String(issueId), s.speechID ?? null);
                          }}
                          title={issueId ? "この発言が行われた会議を開く" : "この発言の会議情報が見つかりません"}
                        >
                          会議を閲覧する
                        </Button>
                      )}
                    </div>
                    <HighlightedSpeech
                      text={speechText}
                      topics={highlightTopics}
                      mode={highlightMode}
                      collapsed={isLong && !isExpanded}
                      className="mt-2 text-body-md text-ink"
                    />

                    {/* The collapsed view is a keyword-in-context excerpt, not a plain clamp, so the toggle
                        is ExpandableText's ghost button rather than ExpandableText itself. */}
                    {isLong && (
                      <div className="mt-1 flex justify-end">
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
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {pageError && speechError && (
            <ErrorState
              className="py-3"
              message={speechError}
              onRetry={
                requestedPage && selectedTopic && requestedPage.topicKey === selectedTopic.topicKey
                  ? () => goToPage(requestedPage.topicKey, requestedPage.page)
                  : undefined
              }
            />
          )}

          {selectedTopic && (
            <Pager
              className="pt-1 pb-3"
              page={selectedTopic.currentPage + 1}
              // totalPages is unknown only when the API leaves it out: then allow one more page
              pageCount={selectedTopic.totalPages ?? selectedTopic.currentPage + 2}
              busy={speechLoading}
              onChange={(p) => goToPage(selectedTopic.topicKey, p - 1)}
            />
          )}
        </div>
      )}
    </section>
  );
}

/** arrows out (expand) / arrows in (collapse) */
function ExpandIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {expanded ? (
        <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
      ) : (
        <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
      )}
    </svg>
  );
}
