import { EmptyState } from "@/app/components/shared/EmptyState";
import type { SpeechRecord } from "@/app/types";

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
}

export function SpeechRecordCard({
  speechTopics,
  speechError,
  speechLoading,
  selectedTopicKey,
  setSelectedTopicKey,
  selectedTopic,
  ensureSpeechPage,
}: SpeechRecordCardProps) {
  const topicsForTabs = (speechTopics ?? []).slice().sort((a, b) => {
    const aKey = normalizeTopicLabelKey(a.topicKey);
    const bKey = normalizeTopicLabelKey(b.topicKey);
    const aIsAll = aKey === "all_speeches" || aKey === "allSpeeches";
    const bIsAll = bKey === "all_speeches" || bKey === "allSpeeches";
    if (aIsAll && !bIsAll) return -1;
    if (!aIsAll && bIsAll) return 1;
    return 0;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-400/15 bg-slate-900/40">
      <div className="flex items-center justify-between px-2 pb-1 pt-2">
        <div className="text-[13px] font-semibold text-gray-50">発言（トピック別）</div>
        {speechLoading && <div className="text-[11px] text-gray-400">Loading…</div>}
      </div>

      {speechError && <div className="px-2 pb-2 text-xs text-red-300">Failed to load speeches: {speechError}</div>}

      {!speechError && speechTopics === null && (
        <div className="px-2 pb-2 text-xs text-gray-300">Loading…</div>
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
                    className={
                      "rounded-full border px-2 py-0.5 text-[11px] transition-colors " +
                      (active
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-400/20 bg-slate-950/20 text-gray-200 hover:border-slate-400/40")
                    }
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
                    Prev
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
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Speech list */}
          {selectedTopic && (
            <div className="grid gap-2 p-2">
              {(selectedTopic.pagesByNumber[selectedTopic.currentPage] ?? []).map((s, idx) => (
                <div
                  key={`${s.speechID ?? "speech"}-${idx}`}
                  className="rounded-lg border border-slate-400/15 bg-[#020617] p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-semibold text-gray-50">{s.speaker}</div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        {s.meta?.date ?? ""} {s.meta?.nameOfMeeting ? `・ ${s.meta.nameOfMeeting}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-gray-200">
                    {s.speech}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


