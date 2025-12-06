"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/app/components/shared/Card";
import type { Topic } from "@/app/types";

interface TopicSelectorProps {
  topics: Topic[];
  selectedTopicId: string | null;
  selectedSubtopicId: string | null;
  onTopicChange: (topicId: string | null, subtopicId: string | null) => void;
}

export function TopicSelector({
  topics,
  selectedTopicId,
  selectedSubtopicId,
  onTopicChange,
}: TopicSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempTopicId, setTempTopicId] = useState(selectedTopicId || "");
  const [tempSubtopicId, setTempSubtopicId] = useState(selectedSubtopicId || "");

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);
  const selectedSubtopic = selectedTopic?.subtopics.find(
    (s) => s.id === selectedSubtopicId
  );

  const currentLabel = selectedTopic
    ? selectedSubtopic
      ? `${selectedTopic.label} → ${selectedSubtopic.label}`
      : selectedTopic.label
    : "all topics";

  const handleApply = () => {
    onTopicChange(tempTopicId || null, tempSubtopicId || null);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempTopicId("");
    setTempSubtopicId("");
    onTopicChange(null, null);
    setIsOpen(false);
  };

  const selectedTopicObj = topics.find((t) => t.id === tempTopicId);

  return (
    <Card>
      <CardHeader
        title="Topics of interest"
        subtitle="Focus the view on issues you care about (e.g. defence, welfare, climate)."
        action={
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              isOpen
                ? "border-blue-500/90 bg-blue-600/90 text-gray-50"
                : "border-slate-400/60 bg-slate-900/90 text-gray-200"
            }`}
          >
            Filter by topic
          </button>
        }
      />

      {isOpen && (
        <div className="mt-1.5 rounded-xl border border-slate-400/30 bg-[#020617] p-2">
          <div className="mb-1.5 flex flex-wrap gap-2">
            <select
              value={tempTopicId}
              onChange={(e) => {
                setTempTopicId(e.target.value);
                setTempSubtopicId("");
              }}
              className="min-w-[120px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1.5 text-[11px] text-gray-200 outline-none"
            >
              <option value="">All major topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={tempSubtopicId}
              onChange={(e) => setTempSubtopicId(e.target.value)}
              className="min-w-[120px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1.5 text-[11px] text-gray-200 outline-none"
            >
              <option value="">All sub topics</option>
              {selectedTopicObj?.subtopics.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-1 flex gap-1.5">
            <button
              onClick={handleApply}
              className="rounded-full border border-blue-500/90 bg-blue-600/90 px-2 py-0.5 text-[11px] text-gray-50 transition-colors hover:bg-blue-600"
            >
              Apply topic filter
            </button>
            <button
              onClick={handleClear}
              className="rounded-full border border-dashed border-slate-400/60 bg-slate-900/90 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:text-gray-200"
            >
              Clear
            </button>
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Showing: <strong className="text-gray-50">{currentLabel}</strong>
          </div>
        </div>
      )}
    </Card>
  );
}

