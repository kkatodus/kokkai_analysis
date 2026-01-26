import { EmptyState } from "@/app/components/shared/EmptyState";
import { LoadingIndicator } from "@/app/components/shared/LoadingIndicator";
import type { SpeechRecord } from "@/app/types";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useState } from "react";


const TOPIC_NAME_JA_BY_EN: Record<string, string> = {
  // From `data/resource/experiment_config.json` (topic_name_en -> topic_name)
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
  Unproductive: "生産性のない発言",
  Irrelevant: "関連性のない発言",
};

function normalizeTopicLabelKey(raw: string): string {
  const t = String(raw ?? "").trim();
  const noExt = t.endsWith(".jsonl") ? t.slice(0, -".jsonl".length) : t;
  return noExt.replace(/\s+/g, "");
}

function translateTopicName(raw: string): string {
  const key = normalizeTopicLabelKey(raw);
  if (!key) return raw;

  if (key === "all_speeches" || key === "allSpeeches") return "全発言";

  const direct = TOPIC_NAME_JA_BY_EN[key];
  if (direct) return direct;

  const lower = key.toLowerCase();
  const found = Object.entries(TOPIC_NAME_JA_BY_EN).find(([en]) => en.toLowerCase() === lower);
  if (found) return found[1];

  // Fallback: make it readable (e.g. snake_case -> "snake case")
  return key.replace(/_/g, " ");
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
}: SpeechRecordCardProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const topicsForTabs = (speechTopics ?? []).slice().sort((a, b) => {
    const aKey = normalizeTopicLabelKey(a.topicKey);
    const bKey = normalizeTopicLabelKey(b.topicKey);

    const priority = (k: string) => {
      // Order: All speeches → Unproductive → Irrelevant → everything else
      if (k === "all_speeches" || k === "allSpeeches") return 0;
      if (k === "Unproductive") return 1;
      if (k === "Irrelevant") return 2;
      return 3;
    };

    const ap = priority(aKey);
    const bp = priority(bKey);
    if (ap !== bp) return ap - bp;

    // Stable ordering for the rest
    const al = translateTopicName(a.topicKey || a.displayName);
    const bl = translateTopicName(b.topicKey || b.displayName);
    return al.localeCompare(bl, "ja");
  });

  const topicTabClassName = (topicKey: string, active: boolean) => {
    const key = normalizeTopicLabelKey(topicKey);
    const isAll = key === "all_speeches" || key === "allSpeeches";
    const isUnproductive = key === "Unproductive";
    const isIrrelevant = key === "Irrelevant";

    const base =
      "rounded-full border px-2 py-0.5 text-[11px] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/30 ";

    if (active) {
      if (isUnproductive) return base + "border-amber-400/60 bg-amber-500/20 text-amber-100";
      if (isIrrelevant) return base + "border-rose-400/60 bg-rose-500/20 text-rose-100";
      // Default active (incl. all speeches)
      return base + (isAll ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100" : "border-cyan-400/60 bg-cyan-500/15 text-cyan-100");
    }

    if (isUnproductive) return base + "border-amber-400/25 bg-amber-500/10 text-amber-100 hover:border-amber-400/40 hover:bg-amber-500/15";
    if (isIrrelevant) return base + "border-rose-400/25 bg-rose-500/10 text-rose-100 hover:border-rose-400/40 hover:bg-rose-500/15";

    return base + "border-slate-400/20 bg-slate-950/20 text-gray-200 hover:border-slate-400/40 hover:bg-white/5";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-400/15 bg-slate-900/40">
      <div className="flex items-center justify-between px-2 pb-1 pt-2">
        <div className="text-[13px] font-semibold text-gray-50">発言（トピック別）</div>
        {speechLoading && <LoadingIndicator variant="dots" size="sm" />}
      </div>

      {speechError && <div className="px-2 pb-2 text-xs text-red-300">発言データが見つかりませんでした</div>}

      {!speechError && speechTopics === null && (
        <div className="px-2 pb-2">
          <LoadingIndicator label="読み込み中" size="sm" />
        </div>
      )}

      {!speechError && speechTopics !== null && speechTopics.length === 0 && (
        <div className="px-2 pb-2">
          <EmptyState message="発言データが見つかりません。" className="py-2" />
        </div>
      )}

      {!speechError && speechTopics && speechTopics.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Sticky topic selection + paging */}
          <div className="sticky top-0 z-10 border-b border-slate-400/15 bg-slate-900/85 px-2 pb-2 pt-2 backdrop-blur">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {topicsForTabs.map((t) => {
                const active = t.topicKey === selectedTopicKey;
                const label = translateTopicName(t.topicKey || t.displayName);
                return (
                  <button
                    key={t.topicKey}
                    type="button"
                    onClick={() => setSelectedTopicKey(t.topicKey)}
                    className={topicTabClassName(t.topicKey, active)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {selectedTopic && (
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-gray-400">
                  Page {selectedTopic.currentPage + 1}
                  {selectedTopic.totalPages !== null ? ` / ${selectedTopic.totalPages}` : ""}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded border border-slate-400/20 bg-slate-950/20 px-2 py-0.5 text-[11px] text-gray-200 disabled:opacity-50"
                    disabled={selectedTopic.currentPage <= 0 || speechLoading}
                    onClick={() => {
                      const prev = Math.max(0, selectedTopic.currentPage - 1);
                      void ensureSpeechPage(selectedTopic.topicKey, prev);
                    }}
                  >
                    <FaArrowLeft />
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-400/20 bg-slate-950/20 px-2 py-0.5 text-[11px] text-gray-200 disabled:opacity-50"
                    disabled={
                      speechLoading ||
                      (selectedTopic.totalPages !== null && selectedTopic.currentPage >= selectedTopic.totalPages - 1)
                    }
                    onClick={() => {
                      const next = selectedTopic.currentPage + 1;
                      void ensureSpeechPage(selectedTopic.topicKey, next);
                    }}
                  >
                    <FaArrowRight />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Speech list */}
          {selectedTopic && (
            <div className="grid gap-2 p-2">
              {(selectedTopic.pagesByNumber[selectedTopic.currentPage] ?? []).map((s, idx) => (
                (() => {
                  const key = `${selectedTopic.topicKey}-${selectedTopic.currentPage}-${s.speechID ?? "speech"}-${idx}`;
                  const isExpanded = expandedKeys.has(key);
                  const speechText = String(s.speech ?? "");
                  const isLong = speechText.length > 220;

                  return (
                <div
                  key={key}
                  className="rounded-lg border border-slate-400/15 bg-[#020617] p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-[12px] font-semibold text-gray-50">{s.speaker}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {s.is_relevant && (
                            <span
                              className={
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                                (s.is_relevant === "True"
                                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                                  : "border-rose-400/30 bg-rose-500/10 text-rose-100")
                              }
                              title={s.quality_reason ? `関連: ${s.quality_reason}` : undefined}
                            >
                              関連: {s.is_relevant === "True" ? "あり" : "なし"}
                            </span>
                          )}
                          {s.is_productive && (
                            <span
                              className={
                                "rounded-full border px-2 py-0.5 text-[10px] font-semibold " +
                                (s.is_productive === "True"
                                  ? "border-sky-400/30 bg-sky-500/15 text-sky-100"
                                  : "border-amber-400/30 bg-amber-500/10 text-amber-100")
                              }
                              title={s.quality_reason ? `生産性: ${s.quality_reason}` : undefined}
                            >
                              生産性: {s.is_productive === "True" ? "あり" : "なし"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {s.meta?.date ?? ""} {s.meta?.nameOfMeeting ? `・ ${s.meta.nameOfMeeting}` : ""}
                      </div>
                    </div>

                    {onSelectIssueId && (
                      <button
                        type="button"
                        onClick={() => {
                          const issueId = s.meta?.issueID ?? s.issueID ?? null;
                          if (!issueId) return;
                          onSelectIssueId(String(issueId), s.speechID ?? null);
                        }}
                        disabled={!(s.meta?.issueID ?? s.issueID)}
                        className={
                          "shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 " +
                          (s.meta?.issueID ?? s.issueID
                            ? "cursor-pointer border-slate-400/20 bg-slate-950/20 text-gray-200 hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-50 hover:shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_18px_rgba(34,211,238,0.18)]"
                            : "cursor-not-allowed border-slate-400/10 bg-slate-950/10 text-gray-500 opacity-60")
                        }
                        title={
                          s.meta?.issueID ?? s.issueID
                            ? `この発言の issueID を選択: ${String(s.meta?.issueID ?? s.issueID)}`
                            : "issueID が見つかりません"
                        }
                      >
                        会議を閲覧する
                      </button>
                    )}
                  </div>
                  <div
                    className={
                      "mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-200 " +
                      (isExpanded ? "" : "line-clamp-6")
                    }
                  >
                    {speechText}
                  </div>

                  {isLong && (
                    <div className="mt-2 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => {
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
                  )}
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


