"use client";

import { useState, useMemo, useCallback } from "react";
import { Header } from "@/app/components/layout/Header";
import { ResizableContainer } from "@/app/components/layout/ResizableContainer";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { Tooltip } from "@/app/components/shared/Tooltip";
import { IdeologicalScatterPlot } from "@/app/components/visualizations/IdeologicalScatterPlot";
import { NetworkGraph } from "@/app/components/visualizations/NetworkGraph";
import { JapanMap } from "@/app/components/visualizations/JapanMap";
import { TopicSelector } from "@/app/components/features/TopicSelector";
import { SearchList } from "@/app/components/features/SearchList";
import { Rankings } from "@/app/components/features/Rankings";
import { DetailPane } from "@/app/components/features/DetailPane";
import {
  usePoliticians,
  useTopics,
  usePrefectures,
  useNetworkEdges,
  useComments,
} from "@/app/lib/hooks/useParliamentData";
import type { Politician, RankingMetric, Medium, Comment } from "@/app/types";
import { isUsingMockData } from "@/app/lib/services/dataService";

export default function ParliamentExplorerPage() {
  // Fetch data using hooks
  const { data: politicians, loading: politiciansLoading } = usePoliticians();
  const { data: topics, loading: topicsLoading } = useTopics();
  const { data: prefectures, loading: prefecturesLoading } = usePrefectures();
  const { data: edges, loading: edgesLoading } = useNetworkEdges();
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: comments } = useComments(selectedId);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string | null>(null);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>("trust");
  const [rankingTopic, setRankingTopic] = useState("");
  const [medium, setMedium] = useState<Medium>("parliament");
  const [tooltipData, setTooltipData] = useState<{ title: string; meta?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [localComments, setLocalComments] = useState<Comment[]>([]);

  // Use fetched data or fallback to empty arrays
  const politiciansData = politicians || [];
  const topicsData = topics || [];
  const prefecturesData = prefectures || [];
  const edgesData = edges || [];
  const allComments = [...(comments || []), ...localComments];

  // Filter politicians based on topic
  const filteredPoliticians = useMemo(() => {
    let filtered = politiciansData;

    // Topic filter
    if (selectedTopicId || selectedSubtopicId) {
      filtered = filtered.filter((p) => {
        const corpus = [
          ...p.speeches.map((s) => `${s.topic} ${s.excerpt}`),
          ...p.tweets.map((t) => `${t.topic} ${t.content}`),
          ...p.keyPositions.map((kp) => `${kp.topic} ${kp.stance}`),
        ]
          .join(" ")
          .toLowerCase();

        const topic = topicsData.find((t) => t.id === selectedTopicId);
        if (topic) {
          const kw = topic.keyword.toLowerCase();
          if (!corpus.includes(kw)) return false;
        }

        if (selectedSubtopicId) {
          const subtopic = topic?.subtopics.find((s) => s.id === selectedSubtopicId);
          if (subtopic) {
            const kw = subtopic.keyword.toLowerCase();
            if (!corpus.includes(kw)) return false;
          }
        }

        return true;
      });
    }

    return filtered;
  }, [selectedTopicId, selectedSubtopicId]);

  const filteredIds = useMemo(
    () => new Set(filteredPoliticians.map((p) => p.id)),
    [filteredPoliticians]
  );

  const selectedPolitician = useMemo(
    () => politiciansData.find((p) => p.id === selectedId) || null,
    [selectedId, politiciansData]
  );

  const handlePoliticianSelect = useCallback((id: string) => {
    setSelectedId(id);
    setMedium("parliament");
  }, []);

  const handleTooltipShow = useCallback(
    (data: { title: string; meta?: string }, x: number, y: number) => {
      setTooltipData(data);
      setTooltipPos({ x, y });
    },
    []
  );

  const handleTooltipHide = useCallback(() => {
    setTooltipData(null);
  }, []);

  const handleAddComment = useCallback(
    (politicianId: string, targetType: "speech" | "tweet", targetId: string) => {
      const text = prompt("Add your comment (mock, stored only in this session):");
      if (!text || !text.trim()) return;

      const now = new Date();
      const newComment: Comment = {
        id: `c${allComments.length + 1}`,
        politicianId,
        targetType,
        targetId,
        userName: "You",
        handle: "@anonymous",
        text: text.trim(),
        createdAt: now.toISOString().slice(0, 16).replace("T", " "),
      };

      setLocalComments([...localComments, newComment]);
    },
    [allComments.length, localComments]
  );

  // Show loading state
  if (politiciansLoading || topicsLoading || prefecturesLoading || edgesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#111827] to-[#020617]">
        <div className="text-center">
          <div className="mb-4 text-lg text-gray-400">Loading parliament data...</div>
          <div className="text-sm text-gray-500">
            {isUsingMockData() ? "Using mock data" : "Fetching from API"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4">
          <Header />

          <ResizableContainer
            left={
              <>
                <Card>
                  <CardHeader
                    title="Ideological scatter plot"
                    subtitle="Each point is a politician. Click to open the detail pane."
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <IdeologicalScatterPlot
                      politicians={politiciansData}
                      selectedId={selectedId}
                      filteredIds={filteredIds}
                      onPoliticianSelect={handlePoliticianSelect}
                      onTooltipShow={handleTooltipShow}
                      onTooltipHide={handleTooltipHide}
                    />
                  </div>
                  <div className="mt-1.5 flex gap-3 text-[11px] text-gray-400">
                    <div className="flex items-center gap-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-cyan-400 to-blue-700" />
                      <span>Main parties</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-pink-500 to-orange-600" />
                      <span>Minor / independents</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Speech interaction network"
                    subtitle="Nodes are politicians, edges summarise interjections / Q&A."
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <NetworkGraph
                      politicians={politiciansData}
                      edges={edgesData}
                      selectedId={selectedId}
                      filteredIds={filteredIds}
                      onPoliticianSelect={handlePoliticianSelect}
                      onTooltipShow={handleTooltipShow}
                      onTooltipHide={handleTooltipHide}
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="Electoral map (Japan, mock, D3)"
                    subtitle="Selecting a representative highlights their prefecture."
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <JapanMap
                      prefectures={prefecturesData}
                      politicians={politiciansData}
                      selectedId={selectedId}
                      onPoliticianSelect={handlePoliticianSelect}
                      onTooltipShow={handleTooltipShow}
                      onTooltipHide={handleTooltipHide}
                    />
                  </div>
                </Card>
              </>
            }
            right={
              <>
                <TopicSelector
                  topics={topicsData}
                  selectedTopicId={selectedTopicId}
                  selectedSubtopicId={selectedSubtopicId}
                  onTopicChange={(topicId, subtopicId) => {
                    setSelectedTopicId(topicId);
                    setSelectedSubtopicId(subtopicId);
                  }}
                />

                <SearchList
                  politicians={politiciansData}
                  selectedId={selectedId}
                  onPoliticianSelect={handlePoliticianSelect}
                />

                <Rankings
                  politicians={filteredPoliticians}
                  metric={rankingMetric}
                  topic={rankingTopic}
                  onPoliticianSelect={handlePoliticianSelect}
                  onMetricChange={setRankingMetric}
                  onTopicChange={setRankingTopic}
                />
              </>
            }
          />
        </div>
      </div>

        <DetailPane
          politician={selectedPolitician}
          isOpen={selectedPolitician !== null}
          medium={medium}
          selectedTopicId={selectedTopicId}
          selectedSubtopicId={selectedSubtopicId}
          comments={allComments}
          onClose={() => setSelectedId(null)}
          onMediumChange={setMedium}
          onAddComment={handleAddComment}
        />

      <Tooltip data={tooltipData} x={tooltipPos.x} y={tooltipPos.y} />
    </div>
  );
}
