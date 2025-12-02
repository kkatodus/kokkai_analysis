"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Politician } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";

interface IdeologicalScatterPlotProps {
  politicians: Politician[];
  selectedId: string | null;
  filteredIds: Set<string>;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function IdeologicalScatterPlot({
  politicians,
  selectedId,
  filteredIds,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: IdeologicalScatterPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

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
    const container = svg.append("g").attr("class", "zoom-container");

    const g = container
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .attr("class", "plot-content");

    const centerX = innerWidth / 2;
    const centerY = innerHeight / 2;

    // Axes
    g.append("line")
      .attr("x1", 0)
      .attr("y1", centerY)
      .attr("x2", innerWidth)
      .attr("y2", centerY)
      .attr("stroke", "rgba(148,163,184,0.7)")
      .attr("stroke-width", 1);

    g.append("line")
      .attr("x1", centerX)
      .attr("y1", 0)
      .attr("x2", centerX)
      .attr("y2", innerHeight)
      .attr("stroke", "rgba(148,163,184,0.7)")
      .attr("stroke-width", 1);

    // Labels
    g.append("text")
      .attr("x", 0)
      .attr("y", centerY - 4)
      .attr("class", "fill-gray-400 text-[10px]")
      .text("Economic left");

    g.append("text")
      .attr("x", innerWidth - 2)
      .attr("y", centerY - 4)
      .attr("text-anchor", "end")
      .attr("class", "fill-gray-400 text-[10px]")
      .text("Economic right");

    g.append("text")
      .attr("x", centerX + 4)
      .attr("y", 8)
      .attr("class", "fill-gray-400 text-[10px]")
      .text("Social liberal");

    g.append("text")
      .attr("x", centerX + 4)
      .attr("y", innerHeight - 3)
      .attr("class", "fill-gray-400 text-[10px]")
      .text("Social conservative");

    // Gradients
    const defs = svg.append("defs");

    const gradMajor = defs.append("radialGradient").attr("id", "scatterMajorGradient");
    gradMajor.append("stop").attr("offset", "0%").attr("stop-color", "#38bdf8");
    gradMajor.append("stop").attr("offset", "100%").attr("stop-color", "#1d4ed8");

    const gradMinor = defs.append("radialGradient").attr("id", "scatterMinorGradient");
    gradMinor.append("stop").attr("offset", "0%").attr("stop-color", "#fb7185");
    gradMinor.append("stop").attr("offset", "100%").attr("stop-color", "#ea580c");

    // Points
    politicians.forEach((p) => {
      const x = ((p.ideology.econ + 1) / 2) * innerWidth;
      const y = (1 - (p.ideology.social + 1) / 2) * innerHeight;

      const isFiltered = filteredIds.size > 0 && !filteredIds.has(p.id);
      const isSelected = p.id === selectedId;
      const isDimmed = (selectedId && !isSelected) || isFiltered;

      const circle = g
        .append("circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("r", isSelected ? 7 : 5)
        .attr("fill", p.isMajor ? "url(#scatterMajorGradient)" : "url(#scatterMinorGradient)")
        .attr("class", "cursor-pointer transition-all duration-150")
        .style("opacity", isDimmed ? 0.15 : 1)
        .style("stroke", isSelected ? "#22d3ee" : "none")
        .style("stroke-width", isSelected ? 1.4 : 0);

      circle
        .on("mouseenter", function (event) {
          onTooltipShow(
            {
              title: p.name,
              meta: `${p.party} · econ ${p.ideology.econ.toFixed(2)}, social ${p.ideology.social.toFixed(2)} · trust ${p.trustScore}/100 · fact ${p.factScore}/100`,
            },
            event.clientX,
            event.clientY
          );
        })
        .on("mouseleave", onTooltipHide)
        .on("click", (event) => {
          event.stopPropagation();
          onPoliticianSelect(p.id);
        });
    });

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoom;
    svg.call(zoom);
  }, [politicians, selectedId, filteredIds, onPoliticianSelect, onTooltipShow, onTooltipHide]);

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
    <div ref={containerRef} className="relative">
      <svg ref={svgRef} className="h-[280px] w-full overflow-visible" />
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-gray-400">
        Scroll to zoom, drag to pan
      </div>
    </div>
  );
}

