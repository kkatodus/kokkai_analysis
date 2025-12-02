"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Card } from "@/app/components/shared/Card";
import { ScoreBar } from "@/app/components/shared/ScoreBar";
import { Badge } from "@/app/components/shared/Badge";
import { EmptyState } from "@/app/components/shared/EmptyState";
import type { Politician, Medium, FactStatus, Comment } from "@/app/types";

interface DetailPaneProps {
  politician: Politician | null;
  isOpen: boolean;
  medium: Medium;
  selectedTopicId: string | null;
  selectedSubtopicId: string | null;
  comments: Comment[];
  onClose: () => void;
  onMediumChange: (medium: Medium) => void;
  onAddComment: (politicianId: string, targetType: "speech" | "tweet", targetId: string) => void;
}

function FactPill({ status }: { status: FactStatus }) {
  const styles = {
    accurate: "bg-emerald-500/15 border-emerald-500/70 text-emerald-200",
    misleading: "bg-amber-500/18 border-amber-500/80 text-amber-200",
    false: "bg-red-500/20 border-red-500/90 text-red-200",
  };

  const labels = {
    accurate: "Fact check: accurate",
    misleading: "Fact check: needs context",
    false: "Fact check: factually incorrect",
  };

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${styles[status]}`}
    >
      {labels[status]}
    </div>
  );
}

function CommentsSection({
  politicianId,
  targetType,
  targetId,
  comments,
  onAddComment,
}: {
  politicianId: string;
  targetType: "speech" | "tweet";
  targetId: string;
  comments: Comment[];
  onAddComment: (politicianId: string, targetType: "speech" | "tweet", targetId: string) => void;
}) {
  const filteredComments = comments.filter(
    (c) => c.targetType === targetType && c.targetId === targetId
  );

  return (
    <div className="mt-1">
      <div className="mb-0.5 text-[11px] uppercase tracking-wider text-gray-400">
        Public comments (mock data)
      </div>
      <div className="max-h-20 overflow-y-auto pr-0.5 text-[11px]">
        {filteredComments.length === 0 ? (
          <div className="py-1 text-[11px] text-gray-400">
            No comments yet. Be the first to comment (mock).
          </div>
        ) : (
          filteredComments.map((c) => (
            <div key={c.id} className="flex gap-1.5 border-t border-gray-800/70 pt-0.5 mt-0.5">
              <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-slate-400/40 bg-slate-900/90 text-[9px] text-gray-400">
                {c.userName
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-[11px] text-gray-400">
                  {c.userName} ({c.handle}) · {c.createdAt}
                </div>
                <div>{c.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-0.5 flex justify-end">
        <button
          onClick={() => onAddComment(politicianId, targetType, targetId)}
          className="rounded-full border border-dashed border-slate-400/60 bg-transparent px-1.5 py-0.5 text-[10px] text-gray-400 transition-colors hover:border-solid hover:text-gray-200"
        >
          Add comment (mock)
        </button>
      </div>
    </div>
  );
}

export function DetailPane({
  politician,
  isOpen,
  medium,
  selectedTopicId,
  selectedSubtopicId,
  comments,
  onClose,
  onMediumChange,
  onAddComment,
}: DetailPaneProps) {
  const filteredUtterances = useMemo(() => {
    if (!politician) return [];

    const utterances = medium === "parliament" ? politician.speeches : politician.tweets;

    if (!selectedTopicId && !selectedSubtopicId) return utterances;

    return utterances.filter((u) => {
      const text = (medium === "parliament" 
        ? ("excerpt" in u ? u.excerpt : "") 
        : ("content" in u ? u.content : "")).toLowerCase();
      const topic = selectedTopicId?.toLowerCase();
      const subtopic = selectedSubtopicId?.toLowerCase();

      if (topic && !text.includes(topic)) return false;
      if (subtopic && !text.includes(subtopic)) return false;
      return true;
    });
  }, [politician, medium, selectedTopicId, selectedSubtopicId]);

  if (!isOpen || !politician) {
    return null;
  }

  return (
      <div className="fixed inset-y-4 right-4 z-40 w-[380px] max-w-[calc(100%-32px)] translate-x-0 opacity-100 transition-all duration-200 max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[70%] max-md:w-full max-md:max-w-full max-md:translate-y-0">
      <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-slate-400/35 bg-linear-to-br from-[#020617] to-[#020617] p-3.5 shadow-2xl">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Politician profile, trust & facts
          </div>
          <button
            onClick={onClose}
            className="flex h-5.5 w-5.5 items-center justify-center rounded-full border-0 bg-slate-900/90 text-sm text-gray-400 transition-colors hover:bg-blue-700/90 hover:text-gray-200"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="mb-1.5 text-[11px] text-gray-400">
          Multi-platform utterances, trust and factual accuracy scores, topic-specific views, and
          public commentary.
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* Header with photo and scores */}
          <div className="mb-2 grid grid-cols-[auto_1fr] gap-2.5">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-400/40">
              {politician.photoUrl ? (
                <Image
                  src={politician.photoUrl}
                  alt={politician.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-full w-full bg-slate-800" />
              )}
            </div>

            <div>
              <div className="mb-1 flex items-start justify-between gap-1.5">
                <div>
                  <div className="text-base font-semibold">{politician.name}</div>
                  <div className="text-[11px] text-gray-400">
                    {politician.party}
                    {politician.district && ` · ${politician.district.name}`}
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <ScoreBar
                    value={politician.trustScore}
                    label={`${politician.trustLabel} · trust ${politician.trustScore}/100`}
                    variant="trust"
                  />
                  <ScoreBar
                    value={politician.factScore}
                    label={`${politician.factLabel} · fact ${politician.factScore}/100`}
                    variant="fact"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="mt-1 text-xs leading-relaxed">
                <div className="mb-0.5 text-[11px] uppercase tracking-wider text-gray-400">
                  Summary stance (for voters)
                </div>
                <div>{politician.summary}</div>
              </div>

              <div className="mt-1 flex flex-wrap gap-1.5">
                {politician.keyPositions.map((kp, idx) => (
                  <div
                    key={idx}
                    className="rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[11px]"
                  >
                    <strong>{kp.topic}:</strong> {kp.stance}
                  </div>
                ))}
              </div>

              <div className="mt-1.5">
                <div className="mb-0.5 text-[11px] uppercase tracking-wider text-gray-400">
                  Career record
                </div>
                <div className="text-[11px] text-gray-400">
                  {politician.career.map((c, idx) => (
                    <div key={idx} className="mb-0.5">
                      <span>{c.period}:</span> <span className="font-medium text-gray-50">{c.role}</span> – {c.note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ideology badges */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <div className="rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[11px]">
              Economic axis: <span className="font-medium text-cyan-400">{politician.ideology.econ.toFixed(2)}</span>
            </div>
            <div className="rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[11px]">
              Social axis: <span className="font-medium text-cyan-400">{politician.ideology.social.toFixed(2)}</span>
            </div>
            <div className="rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[11px]">
              Defense stance: <span className="font-medium text-cyan-400">{(politician.topicScores.defense ?? 0).toFixed(2)}</span>
            </div>
            <div className="rounded-full border border-slate-400/40 px-1.5 py-0.5 text-[11px]">
              Welfare stance: <span className="font-medium text-cyan-400">{(politician.topicScores.welfare ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-1 inline-flex rounded-full bg-slate-900/90 p-0.5">
            <button
              onClick={() => onMediumChange("parliament")}
              className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                medium === "parliament"
                  ? "bg-blue-600/90 text-gray-50"
                  : "bg-transparent text-gray-400"
              }`}
            >
              Parliament speeches
            </button>
            <button
              onClick={() => onMediumChange("twitter")}
              className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                medium === "twitter"
                  ? "bg-blue-600/90 text-gray-50"
                  : "bg-transparent text-gray-400"
              }`}
            >
              Twitter / X posts
            </button>
          </div>

          {/* Utterances list */}
          <div className="max-h-[200px] overflow-auto rounded-lg border border-slate-400/20 bg-[#020617] pr-1">
            {filteredUtterances.length === 0 ? (
              <EmptyState
                message={
                  selectedTopicId || selectedSubtopicId
                    ? "No items for the current topic filter."
                    : "No items."
                }
                className="p-2"
              />
            ) : (
              filteredUtterances.map((u) => {
                const isFalse = u.factStatus === "false";
                const isMisleading = u.factStatus === "misleading";

                return (
                  <div
                    key={u.id}
                    className={`border-b border-gray-800/60 p-2 text-xs last:border-b-0 ${
                      isFalse || isMisleading
                        ? "border-l-2 bg-linear-to-r from-slate-50/2 to-transparent"
                        : ""
                    } ${isFalse ? "border-l-red-500/90 bg-linear-to-r from-red-500/10 to-transparent" : ""}`}
                  >
                    <div className="mb-0.5 flex justify-between gap-2 text-[11px] text-gray-400">
                      <span>{u.topic}</span>
                      <span>{u.date}</span>
                    </div>
                    <div className="mb-1">
                      <FactPill status={u.factStatus} />
                    </div>
                    {u.factNote && (
                      <div className="mb-0.5 text-[11px] text-gray-400">{u.factNote}</div>
                    )}
                    <div className="mb-1 leading-relaxed">
                      {medium === "parliament" 
                        ? ("excerpt" in u ? u.excerpt : "") 
                        : ("content" in u ? u.content : "")}
                    </div>
                    {medium === "twitter" && "url" in u && u.url && (
                      <a
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        Open on Twitter
                      </a>
                    )}
                    <CommentsSection
                      politicianId={politician.id}
                      targetType={medium === "parliament" ? "speech" : "tweet"}
                      targetId={u.id}
                      comments={comments}
                      onAddComment={onAddComment}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

