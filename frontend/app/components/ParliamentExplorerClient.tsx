"use client";

/**
 * Client Component wrapper for Parliament Explorer
 * Handles all interactive state and user actions
 * Receives initial data from Server Component
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Header } from "@/app/components/layout/Header";
import { ResizableContainer } from "@/app/components/layout/ResizableContainer";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { Tooltip } from "@/app/components/shared/Tooltip";
import { ModalManager } from "@/app/components/modal/ModalManager";
import { IdeologicalScatterPlot } from "@/app/components/visualizations/IdeologicalScatterPlot";
import { NetworkGraph } from "@/app/components/visualizations/NetworkGraph";
import { JapanMap } from "@/app/components/visualizations/JapanMap";
import { TopicSelector } from "@/app/components/features/TopicSelector";
import { ModalProvider } from "@/app/lib/hooks/useModal";
import { useComments } from "@/app/lib/hooks/useParliamentData";
import type { Politician, RankingMetric, Medium, Comment, Topic, NetworkEdge, Prefecture, ParliamentMemberData } from "@/app/types";

interface ParliamentExplorerClientProps {
  parliamentMemberData: ParliamentMemberData | null;
  initialTopics: Topic[];
  votingDistrictGeoJsonData: any;
  initialEdges: NetworkEdge[];
  initialSelectedId?: string | null;
  donors: string[];
}

export function ParliamentExplorerClient({
  parliamentMemberData,
  initialTopics,
  votingDistrictGeoJsonData,
  initialEdges,
  initialSelectedId,
}: ParliamentExplorerClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  console.log('Client ParliamentExplorerClient component');
  // Initialize state from server-provided initialSelectedId
  const [selectedIdState, setSelectedIdState] = useState<string | null>(initialSelectedId ?? null);
  
  // Fetch comments for selected politician (client-side for dynamic updates)
  const { data: comments } = useComments(selectedIdState);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string | null>(null);
  const [medium, setMedium] = useState<Medium>("parliament");
  const [tooltipData, setTooltipData] = useState<{ title: string; meta?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [localComments, setLocalComments] = useState<Comment[]>([]);

  // Sync selectedId with URL changes (e.g., browser back/forward)
  // This handles cases where the URL changes externally (browser navigation)
  useEffect(() => {
    const urlId = searchParams.get("id");
    setSelectedIdState((currentId) => {
      // Only update if URL differs from current state
      if (urlId !== currentId) {
        if (urlId) {
          setMedium("parliament");
        }
        return urlId;
      }
      return currentId;
    });
  }, [searchParams]);

  // Use selectedId from state (synced with URL)
  // This must be declared before it's used in useMemo hooks
  const selectedId = selectedIdState;

  // Use initial data (could be enhanced with client-side refetching if needed)
  const topicsData = initialTopics;
  const edgesData = initialEdges;
  const allComments = [...(comments || []), ...localComments];

  // Filter politicians based on topic
//   const filteredPoliticians = useMemo(() => {
//     let filtered = politiciansData;

//     // Topic filter
//     if (selectedTopicId || selectedSubtopicId) {
//       filtered = filtered.filter((p) => {
//         const corpus = [
//           ...p.speeches.map((s) => `${s.topic} ${s.excerpt}`),
//           ...p.tweets.map((t) => `${t.topic} ${t.content}`),
//           ...p.keyPositions.map((kp) => `${kp.topic} ${kp.stance}`),
//         ]
//           .join(" ")
//           .toLowerCase();

//         const topic = topicsData.find((t) => t.id === selectedTopicId);
//         if (topic) {
//           const kw = topic.keyword.toLowerCase();
//           if (!corpus.includes(kw)) return false;
//         }

//         if (selectedSubtopicId) {
//           const subtopic = topic?.subtopics.find((s) => s.id === selectedSubtopicId);
//           if (subtopic) {
//             const kw = subtopic.keyword.toLowerCase();
//             if (!corpus.includes(kw)) return false;
//           }
//         }

//         return true;
//       });
//     }

//     return filtered;
//   }, [politiciansData, topicsData, selectedTopicId, selectedSubtopicId]);

//   const filteredIds = useMemo(
//     () => new Set(filteredPoliticians.map((p) => p.id)),
//     [filteredPoliticians]
//   );

//   const selectedPolitician = useMemo(
//     () => politiciansData.find((p) => p.id === selectedId) || null,
//     [selectedId, politiciansData]
//   );

  const handlePoliticianSelect = useCallback((id: string | null) => {
    // Update local state
    setSelectedIdState(id);
    setMedium("parliament");
    
    // Update URL for shareable links
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("id", id);
    } else {
      params.delete("id");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

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

  return (
    <ModalProvider>
      <div className="min-h-screen bg-linear-to-b from-[#111827] to-[#020617] p-4">
        <div className="w-full">
          <div className="flex flex-col gap-4">
            <Header />
            <ModalManager />

          <ResizableContainer
            left={
              <>
                <Card>
                  <CardHeader
                    title="Ideological scatter plot"
                    subtitle="Each point is a politician. Click to open the detail pane."
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    {/* <IdeologicalScatterPlot
                      politicians={politiciansData}
                      selectedId={selectedId}
                      filteredIds={filteredIds}
                      onPoliticianSelect={handlePoliticianSelect}
                      onTooltipShow={handleTooltipShow}
                      onTooltipHide={handleTooltipHide}
                    /> */}
                  </div>
                
                </Card>

                {/* <Card>
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
                </Card> */}

                <Card>
                  <CardHeader
                    title="選挙区地図"
                    subtitle="選挙区を選択すると、その選挙区の政治家が表示されます。"
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <JapanMap
                      votingDistrictGeoJsonData={votingDistrictGeoJsonData as any}
                      parliamentMemberData={parliamentMemberData}
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
{/* 
                <SearchList
                  politicians={politiciansData}
                  selectedId={selectedId}
                  onPoliticianSelect={handlePoliticianSelect}
                /> */}

                {/* <Rankings
                  politicians={filteredPoliticians}
                  metric={rankingMetric}
                  topic={rankingTopic}
                  onPoliticianSelect={handlePoliticianSelect}
                  onMetricChange={setRankingMetric}
                  onTopicChange={setRankingTopic}
                /> */}
              </>
            }
          />
          </div>
        </div>
{/* 
      <DetailPane
        politician={selectedPolitician}
        isOpen={selectedPolitician !== null}
        medium={medium}
        selectedTopicId={selectedTopicId}
        selectedSubtopicId={selectedSubtopicId}
        comments={allComments}
        onClose={() => handlePoliticianSelect(null)}
        onMediumChange={setMedium}
      /> */}

        <Tooltip data={tooltipData} x={tooltipPos.x} y={tooltipPos.y} />
      </div>
    </ModalProvider>
  );
}

