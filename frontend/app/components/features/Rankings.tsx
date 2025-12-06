"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { EmptyState } from "@/app/components/shared/EmptyState";
import type { Politician, RankingMetric } from "@/app/types";

interface RankingsProps {
  politicians: Politician[];
  metric: RankingMetric;
  topic: string;
  onPoliticianSelect: (id: string) => void;
  onMetricChange: (metric: RankingMetric) => void;
  onTopicChange: (topic: string) => void;
}

export function Rankings({
  politicians,
  metric,
  topic,
  onPoliticianSelect,
  onMetricChange,
  onTopicChange,
}: RankingsProps) {
  const getIndicatorValue = (p: Politician): number => {
    if (metric === "trust") return p.trustScore;
    if (metric === "fact") return p.factScore;
    if (metric === "econ") return p.ideology.econ;
    if (metric === "social") return p.ideology.social;
    if (metric === "topic") {
      if (!topic) return 0;
      return p.topicScores[topic] ?? 0;
    }
    return 0;
  };

  const { sorted, metricLabel, dimensionLabel, topDirection, bottomDirection } =
    useMemo(() => {
      const withValues = politicians.map((p) => ({
        ...p,
        indicator: getIndicatorValue(p),
      }));

      withValues.sort((a, b) => b.indicator - a.indicator);

      let metricLabel = "";
      let dimensionLabel = "All / N/A";
      let topDirection = "Highest values";
      let bottomDirection = "Lowest values";

      if (metric === "trust") {
        metricLabel = "Trust / consistency score";
        topDirection = "Most consistent";
        bottomDirection = "Least consistent";
      } else if (metric === "fact") {
        metricLabel = "Fact accuracy score";
        topDirection = "Most factually accurate";
        bottomDirection = "Most frequently disputed";
      } else if (metric === "econ") {
        metricLabel = "Economic axis";
        topDirection = "Most right-leaning";
        bottomDirection = "Most left-leaning";
      } else if (metric === "social") {
        metricLabel = "Social axis";
        topDirection = "Most conservative";
        bottomDirection = "Most liberal";
      } else if (metric === "topic") {
        metricLabel = "Topic-specific stance";
        if (topic === "defense") dimensionLabel = "Defense stance";
        else if (topic === "welfare") dimensionLabel = "Welfare stance";
      }

      return {
        sorted: withValues,
        metricLabel,
        dimensionLabel,
        topDirection,
        bottomDirection,
      };
    }, [politicians, metric, topic]);

  const top10 = sorted.slice(0, 10);
  const bottom10 = sorted.slice(-10).reverse();

  const formatValue = (value: number): string => {
    if (metric === "trust" || metric === "fact") {
      return `${value.toFixed(0)}/100`;
    }
    return value.toFixed(2);
  };

  return (
    <Card>
      <CardHeader
        title="Rankings by indicator"
        subtitle="Compare top and bottom 10 politicians by consistency, stance, or factual accuracy."
      />

      <div className="mb-1.5 flex flex-wrap gap-1.5">
        <select
          value={metric}
          onChange={(e) => onMetricChange(e.target.value as RankingMetric)}
          className="min-w-[140px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1 text-[11px] text-gray-200 outline-none"
        >
          <option value="trust">Trust / consistency score</option>
          <option value="fact">Fact accuracy score</option>
          <option value="econ">Economic axis (rightmost vs leftmost)</option>
          <option value="social">Social axis (liberal vs conservative)</option>
          <option value="topic">Topic-specific stance</option>
        </select>
        <select
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          className="min-w-[140px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1 text-[11px] text-gray-200 outline-none"
        >
          <option value="">All / N/A</option>
          <option value="defense">Defense stance</option>
          <option value="welfare">Welfare stance</option>
        </select>
      </div>

      <div className="mb-1 text-[11px] text-gray-400">
        Metric: {metricLabel} · Dimension: {dimensionLabel}
      </div>
      <div className="mb-1.5 text-[11px] text-gray-400">
        Ranking among {politicians.length} politicians (based on current filters).
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-slate-400/30 bg-[#020617] p-2 text-[11px]">
          <div className="mb-1 flex justify-between gap-1 text-[11px] uppercase tracking-wider text-gray-400">
            <span>Top 10</span>
            <span>{topDirection}</span>
          </div>
          <div className="max-h-40 overflow-y-auto pr-0.5">
            {top10.length === 0 ? (
              <EmptyState message="No politicians in current filter." className="p-1" />
            ) : (
              top10.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => onPoliticianSelect(p.id)}
                  className="flex cursor-pointer justify-between border-b border-gray-800/60 py-0.5 transition-colors hover:bg-blue-700/20 last:border-b-0"
                >
                  <div>
                    <div className="text-[11px]">{p.name}</div>
                    <div className="text-[10px] text-gray-400">{p.party}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px]">{formatValue(p.indicator)}</div>
                    <div className="text-[9px] text-gray-400">#{idx + 1}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-400/30 bg-[#020617] p-2 text-[11px]">
          <div className="mb-1 flex justify-between gap-1 text-[11px] uppercase tracking-wider text-gray-400">
            <span>Bottom 10</span>
            <span>{bottomDirection}</span>
          </div>
          <div className="max-h-40 overflow-y-auto pr-0.5">
            {bottom10.length === 0 ? (
              <EmptyState message="No politicians in current filter." className="p-1" />
            ) : (
              bottom10.map((p, idx) => (
                <div
                  key={p.id}
                  onClick={() => onPoliticianSelect(p.id)}
                  className="flex cursor-pointer justify-between border-b border-gray-800/60 py-0.5 transition-colors hover:bg-blue-700/20 last:border-b-0"
                >
                  <div>
                    <div className="text-[11px]">{p.name}</div>
                    <div className="text-[10px] text-gray-400">{p.party}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px]">{formatValue(p.indicator)}</div>
                    <div className="text-[9px] text-gray-400">#{idx + 1}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

