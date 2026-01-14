"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { IdeologyData, PersonIdeologyData } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";
import { EmptyState } from "@/app/components/shared/EmptyState";
import availableConfig from "@/app/data/available.json";

type AvailableAxis = { pro: string; con: string };
type AvailableSubtopic = {
  name: string;
  jpn: string;
  disabled?: boolean;
  showSpectrum?: boolean;
  axis?: AvailableAxis;
};
type AvailableTopic = {
  name: string;
  jpn: string;
  disabled?: boolean;
  data: AvailableSubtopic[];
};
type AvailableConfig = { availability: AvailableTopic[] };

interface IdeologicalScatterPlotProps {
  ideologyData: IdeologyData | null;
  selectedPersonId: string | null;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function IdeologicalScatterPlot({
  ideologyData,
  selectedPersonId,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: IdeologicalScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Keep callback refs so D3 handlers don't force a full redraw when parent re-renders.
  const onPoliticianSelectRef = useRef(onPoliticianSelect);
  const onTooltipShowRef = useRef(onTooltipShow);
  const onTooltipHideRef = useRef(onTooltipHide);

  useEffect(() => {
    onPoliticianSelectRef.current = onPoliticianSelect;
  }, [onPoliticianSelect]);
  useEffect(() => {
    onTooltipShowRef.current = onTooltipShow;
  }, [onTooltipShow]);
  useEffect(() => {
    onTooltipHideRef.current = onTooltipHide;
  }, [onTooltipHide]);

  const availability = (availableConfig as AvailableConfig).availability;

  const findTopicCfg = (topicKey: string | null | undefined): AvailableTopic | undefined => {
    if (!topicKey) return undefined;
    return availability.find((t) => t.name === topicKey || t.jpn === topicKey);
  };

  const findSubtopicCfg = (
    topicKey: string | null | undefined,
    subKey: string | null | undefined
  ): AvailableSubtopic | undefined => {
    if (!subKey) return undefined;
    const topicCfg = findTopicCfg(topicKey);
    if (topicCfg) {
      return topicCfg.data.find((s) => s.name === subKey || s.jpn === subKey);
    }
    // Fallback: search globally if the topic key doesn't match
    for (const t of availability) {
      const hit = t.data.find((s) => s.name === subKey || s.jpn === subKey);
      if (hit) return hit;
    }
    return undefined;
  };

  const topics = ideologyData?.data ?? [];
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number>(0);
  const [selectedSubTopicIdx, setSelectedSubTopicIdx] = useState<number>(0);
  const [mode, setMode] = useState<"2d" | "1d">("1d");

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      const cfg = findTopicCfg(t.topic);
      return Boolean(cfg) && !cfg?.disabled;
    });
  }, [topics]);

  // Keep selection indexes valid when ideologyData changes
  useEffect(() => {
    if (!filteredTopics.length) return;
    setSelectedTopicIdx((idx) => Math.min(Math.max(idx, 0), filteredTopics.length - 1));
  }, [filteredTopics.length]);

  useEffect(() => {
    const currentTopic = filteredTopics[selectedTopicIdx];
    const base = currentTopic?.sub_topics ?? [];
    const allowed = base.filter((s) => {
      const cfg = findSubtopicCfg(s.topic ?? currentTopic?.topic, s.sub_topic);
      return Boolean(cfg) && !cfg?.disabled;
    });
    setSelectedSubTopicIdx((idx) => Math.min(Math.max(idx, 0), Math.max(0, allowed.length - 1)));
  }, [selectedTopicIdx, filteredTopics]);

  const selectedTopic = filteredTopics[selectedTopicIdx] ?? null;

  const filteredSubTopics = useMemo(() => {
    const base = selectedTopic?.sub_topics ?? [];
    return base.filter((s) => {
      const cfg = findSubtopicCfg(s.topic ?? selectedTopic?.topic, s.sub_topic);
      return Boolean(cfg) && !cfg?.disabled;
    });
  }, [selectedTopic]);

  const selectedSubTopic = filteredSubTopics[selectedSubTopicIdx] ?? null;

  const selectedTopicLabel = useMemo(() => {
    const raw = selectedTopic?.topic;
    const cfg = findTopicCfg(raw);
    return cfg?.jpn ?? raw ?? "";
  }, [selectedTopic?.topic]);

  const selectedSubTopicLabel = useMemo(() => {
    const rawTopic = selectedSubTopic?.topic ?? selectedTopic?.topic;
    const rawSub = selectedSubTopic?.sub_topic;
    const cfg = findSubtopicCfg(rawTopic, rawSub);
    return cfg?.jpn ?? rawSub ?? "";
  }, [selectedTopic?.topic, selectedSubTopic?.topic, selectedSubTopic?.sub_topic]);

  const selectedAxis = useMemo(() => {
    const rawTopic = selectedSubTopic?.topic ?? selectedTopic?.topic;
    const rawSub = selectedSubTopic?.sub_topic;
    const cfg = findSubtopicCfg(rawTopic, rawSub);
    const axis = cfg?.axis;
    // default: show if not explicitly false
    const showSpectrum = cfg?.showSpectrum !== false && Boolean(axis);
    return { axis, showSpectrum };
  }, [selectedTopic?.topic, selectedSubTopic?.topic, selectedSubTopic?.sub_topic]);

  const points: PersonIdeologyData[] = useMemo(() => {
    if (!selectedSubTopic) return [];
    const bucket = (selectedSubTopic as any)[mode] as { data: PersonIdeologyData[] } | undefined;
    return bucket?.data ?? [];
  }, [selectedSubTopic, mode]);

  const titleLabel = useMemo(() => {
    if (!selectedSubTopic) return "";
    const top = selectedTopicLabel || selectedSubTopic.topic || selectedTopic?.topic || "";
    const sub = selectedSubTopicLabel || selectedSubTopic.sub_topic || "";
    return sub ? `${top} → ${sub}` : top;
  }, [selectedSubTopic, selectedTopic, selectedTopicLabel, selectedSubTopicLabel]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth || 400;
    const height = 280;
    const margin = { top: 10, right: 10, bottom: 25, left: 25 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create container group for zoom/pan
    const zoomContainer = svg.append("g").attr("class", "zoom-container");

    const g = zoomContainer
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .attr("class", "plot-content");

    // Scales
    const padDomain = (extent: [number, number] | [undefined, undefined]) => {
      const a = extent[0] ?? -1;
      const b = extent[1] ?? 1;
      if (a === b) return [a - 1, b + 1] as [number, number];
      const pad = (b - a) * 0.08;
      return [a - pad, b + pad] as [number, number];
    };

    const xDomain = padDomain(d3.extent(points, (d) => d.x) as any);
    const yDomain = padDomain(d3.extent(points, (d) => d.y) as any);

    const xScale = d3.scaleLinear().domain(xDomain).range([0, innerWidth]);
    const yScale = d3.scaleLinear().domain(yDomain).range([innerHeight, 0]);

    // Axis chrome:
    // - 1D: show only left/right labels (no y-axis labels/lines)
    // - 2D: show no axes at all (clean scatter)
    if (mode === "1d") {
      const xLowLabel = selectedAxis.showSpectrum ? "反対" : "x (low)";
      const xHighLabel = selectedAxis.showSpectrum ? "賛成" : "x (high)";

      const labelY = innerHeight - 4;
      g.append("text")
        .attr("x", 0)
        .attr("y", labelY)
        .attr("class", "fill-gray-400 text-[10px]")
        .text(xLowLabel);

      g.append("text")
        .attr("x", innerWidth - 2)
        .attr("y", labelY)
        .attr("text-anchor", "end")
        .attr("class", "fill-gray-400 text-[10px]")
        .text(xHighLabel);
    }

    // Points
    const baseR = 4;
    const UNSELECTED_STROKE = "rgba(255,255,255,0.55)";
    const SELECTED_STROKE = "rgba(255,255,255,0.95)";
    const circles = g
      .selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.x))
      // In 1D mode we still use y for separation (prevents overlap / improves clickability)
      .attr("cy", (d) => yScale(d.y))
      .attr("r", baseR)
      .attr("fill", (d) => d.color || "#38bdf8")
      .attr("opacity", 0.9)
      // Slightly brighter outline so dark/black dots remain visible.
      .attr("stroke", UNSELECTED_STROKE)
      .attr("stroke-width", 1.25)
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const meta =
          mode === "2d"
            ? `${d.party} • x:${d.x.toFixed(2)} y:${d.y.toFixed(2)}`
            : `${d.party} • x:${d.x.toFixed(2)}`;
        onTooltipShowRef.current({ title: d.repr, meta }, event.clientX, event.clientY);
      })
      .on("mouseleave", () => onTooltipHideRef.current())
      .on("click", (_event, d) => {
        const id = d.person_id != null ? String(d.person_id) : d.repr;
        onPoliticianSelectRef.current(id);
      });

    // Zoom behavior (pan/zoom the points + guides)
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.8, 15])
      .on("zoom", (event) => {
        zoomContainer.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoom;
    svg.call(zoom as any);

    // Prevent wheel from scrolling the page while zooming the plot
    svg.on("wheel", (event) => {
      event.preventDefault();
    });

    // Cleanup tooltip on unmount / rerender
    return () => {
      onTooltipHideRef.current();
      circles.on("mousemove", null).on("mouseleave", null).on("click", null);
    };
  }, [points, mode, selectedAxis.showSpectrum]);

  // Important: update selection styling WITHOUT rebuilding the SVG.
  // Rebuilding the SVG resets the d3-zoom transform, which feels like an "automatic zoom-out"
  // right after clicking a dot.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const circles = svg.selectAll<SVGCircleElement, PersonIdeologyData>(".plot-content circle");

    circles
      .attr("r", (d) => {
        const id = d.person_id != null ? String(d.person_id) : d.repr;
        return selectedPersonId && selectedPersonId === id ? 6 : 4;
      })
      .attr("stroke", (d) => {
        const id = d.person_id != null ? String(d.person_id) : d.repr;
        return selectedPersonId && selectedPersonId === id
          ? "rgba(255,255,255,0.95)"
          : "rgba(255,255,255,0.55)";
      })
      .attr("stroke-width", (d) => {
        const id = d.person_id != null ? String(d.person_id) : d.repr;
        return selectedPersonId && selectedPersonId === id ? 2.5 : 1.25;
      });
  }, [selectedPersonId]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(zoomRef.current.scaleBy, 1.5);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(zoomRef.current.scaleBy, 1 / 1.5);
  };

  const handleReset = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(zoomRef.current.transform, d3.zoomIdentity);
  };

  return (
    <div className="relative">
      {/* Controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <select
          value={selectedTopicIdx}
          onChange={(e) => {
            setSelectedTopicIdx(Number(e.target.value));
            setSelectedSubTopicIdx(0);
          }}
          className="min-w-[120px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1.5 text-[11px] text-gray-200 outline-none"
          disabled={!filteredTopics.length}
        >
          {filteredTopics.map((t, idx) => {
            const cfg = findTopicCfg(t.topic);
            const label = cfg?.jpn ?? t.topic;
            return (
              <option key={`${t.topic}-${idx}`} value={idx}>
                {label}
              </option>
            );
          })}
        </select>

        <select
          value={selectedSubTopicIdx}
          onChange={(e) => setSelectedSubTopicIdx(Number(e.target.value))}
          className="min-w-[140px] flex-1 rounded-full border border-slate-400/60 bg-slate-900/95 px-2 py-1.5 text-[11px] text-gray-200 outline-none"
          disabled={!filteredSubTopics.length}
        >
          {filteredSubTopics.map((s, idx) => {
            const cfg = findSubtopicCfg(s.topic ?? selectedTopic?.topic, s.sub_topic);
            const label = cfg?.jpn ?? (s.sub_topic || s.topic);
            return (
              <option key={`${s.topic}-${s.sub_topic}-${idx}`} value={idx}>
                {label}
              </option>
            );
          })}
        </select>

        <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-slate-400/60 bg-slate-900/95">
          <button
            onClick={() => setMode("1d")}
            className={`px-3 py-1 text-[11px] ${
              mode === "1d" ? "bg-blue-600/90 text-white" : "text-gray-200 hover:bg-white/5"
            }`}
            disabled={!filteredTopics.length}
          >
            1D
          </button>
          <button
            onClick={() => setMode("2d")}
            className={`px-3 py-1 text-[11px] ${
              mode === "2d" ? "bg-blue-600/90 text-white" : "text-gray-200 hover:bg-white/5"
            }`}
            disabled={!filteredTopics.length}
          >
            2D
          </button>
        </div>
      </div>

      {mode === "1d" && selectedAxis.showSpectrum && selectedAxis.axis && (
        <div className="mb-2 grid gap-2 rounded-xl border border-slate-400/15 bg-slate-900/40 p-2 text-[11px] text-gray-200 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] font-semibold text-gray-300">反対（左）</div>
            <div className="leading-relaxed text-gray-200">{selectedAxis.axis.con}</div>
          </div>
          <div>
            <div className="mb-1 text-[10px] font-semibold text-gray-300">賛成（右）</div>
            <div className="leading-relaxed text-gray-200">{selectedAxis.axis.pro}</div>
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative overflow-hidden">
        {(!ideologyData || !filteredTopics.length || !selectedSubTopic) ? (
          <div className="flex h-[280px] items-center justify-center">
            <EmptyState message="政治思想データが見つかりませんでした" />
          </div>
        ) : (
          <>
            {/* Keep zoom/pan drawing clipped to the plot area so it doesn't cover controls/header */}
            <svg ref={svgRef} className="h-[280px] w-full overflow-hidden" />
            <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
            <div className="absolute bottom-2 left-2 text-[10px] text-gray-400">
              {titleLabel ? `${titleLabel} • ` : ""}
              {mode === "2d" ? "スクロールでズーム、ドラッグでパン" : "スクロールでズーム、ドラッグでパン"}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

