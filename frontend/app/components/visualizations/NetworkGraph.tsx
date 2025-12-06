"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { Politician, NetworkEdge } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";

interface NetworkGraphProps {
  politicians: Politician[];
  edges: NetworkEdge[];
  selectedId: string | null;
  filteredIds: Set<string>;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function NetworkGraph({
  politicians,
  edges,
  selectedId,
  filteredIds,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = containerRef.current.clientWidth || 400;
    const height = 280;
    const margin = 20;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width - margin * 2, height - margin * 2) / 2 - 10;

    // Create container group for zoom/pan
    const container = svg.append("g").attr("class", "zoom-container");

    const nodePositions: Record<string, { x: number; y: number }> = {};
    const angleStep = (2 * Math.PI) / politicians.length;

    politicians.forEach((p, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodePositions[p.id] = { x, y };
    });

    // Draw edges
    edges.forEach((edge) => {
      const s = nodePositions[edge.source];
      const t = nodePositions[edge.target];
      if (!s || !t) return;

      container
        .append("line")
        .attr("x1", s.x)
        .attr("y1", s.y)
        .attr("x2", t.x)
        .attr("y2", t.y)
        .attr("class", "stroke-slate-400/50")
        .attr("stroke-width", 1)
        .style("opacity", 0.4 + Math.min(edge.weight, 4) * 0.12);
    });

    // Gradients
    const defs = svg.append("defs");

    const gradMajor = defs.append("radialGradient").attr("id", "networkMajorGradient");
    gradMajor.append("stop").attr("offset", "0%").attr("stop-color", "#38bdf8");
    gradMajor.append("stop").attr("offset", "100%").attr("stop-color", "#1e40af");

    const gradMinor = defs.append("radialGradient").attr("id", "networkMinorGradient");
    gradMinor.append("stop").attr("offset", "0%").attr("stop-color", "#fb7185");
    gradMinor.append("stop").attr("offset", "100%").attr("stop-color", "#b91c1c");

    // Draw nodes
    politicians.forEach((p) => {
      const pos = nodePositions[p.id];
      const isFiltered = filteredIds.size > 0 && !filteredIds.has(p.id);
      const isSelected = p.id === selectedId;
      const isDimmed = (selectedId && !isSelected) || isFiltered;

      const circle = container
        .append("circle")
        .attr("cx", pos.x)
        .attr("cy", pos.y)
        .attr("r", isSelected ? 10 : 7)
        .attr("fill", p.isMajor ? "url(#networkMajorGradient)" : "url(#networkMinorGradient)")
        .attr("class", "cursor-pointer transition-all duration-150")
        .style("opacity", isDimmed ? 0.15 : 1)
        .style("stroke", isSelected ? "#22d3ee" : "none")
        .style("stroke-width", isSelected ? 1.4 : 0);

      circle
        .on("mouseenter", function (event) {
          const connectionCount = edges.filter(
            (e) => e.source === p.id || e.target === p.id
          ).length;
          onTooltipShow(
            {
              title: p.name,
              meta: `${p.party} · connections: ${connectionCount} · trust ${p.trustScore}/100 · fact ${p.factScore}/100`,
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

      // Labels
      container
        .append("text")
        .attr("x", pos.x)
        .attr("y", pos.y + (isSelected ? 18 : 15))
        .attr("fill", "#9ca3af")
        .attr("font-size", "9px")
        .attr("text-anchor", "middle")
        .text(p.name.split(" ")[0]);
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
  }, [politicians, edges, selectedId, filteredIds, onPoliticianSelect, onTooltipShow, onTooltipHide]);

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
      <svg ref={svgRef} className="h-[280px] w-full" />
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

