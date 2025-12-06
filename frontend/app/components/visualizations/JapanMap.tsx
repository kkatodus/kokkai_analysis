"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Politician, Prefecture } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";

interface JapanMapProps {
  prefectures: Prefecture[];
  politicians: Politician[];
  selectedId: string | null;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function JapanMap({
  prefectures,
  politicians,
  selectedId,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: JapanMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const selectedPolitician = selectedId
      ? politicians.find((p) => p.id === selectedId)
      : null;
    const selectedPrefectureId = selectedPolitician?.district?.prefectureId;

    // Gradients
    const defs = svg.append("defs");
    const grad = defs.append("radialGradient").attr("id", "mapHighlightGradient");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#22d3ee");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#1d4ed8");

    // Create container group for zoom/pan
    const container = svg.append("g").attr("class", "zoom-container");

    // Main island backbone (mock)
    container
      .append("path")
      .attr(
        "d",
        "M140 40 L150 70 L155 100 L155 130 L150 160 L145 185 L135 210 L130 230"
      )
      .attr("fill", "none")
      .attr("stroke", "rgba(148,163,184,0.45)")
      .attr("stroke-width", 5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    const g = container.append("g");

    // Prefecture shapes
    g.selectAll("path.prefecture-shape")
      .data(prefectures)
      .enter()
      .append("path")
      .attr("class", "prefecture-shape cursor-pointer transition-all duration-150")
      .classed("is-selected", (d) => d.id === selectedPrefectureId)
      .attr("d", (d) => d.path)
      .attr("fill", (d) =>
        d.id === selectedPrefectureId
          ? "url(#mapHighlightGradient)"
          : "rgba(15, 23, 42, 0.9)"
      )
      .attr("stroke", (d) =>
        d.id === selectedPrefectureId ? "#22d3ee" : "rgba(148,163,184,0.5)"
      )
      .attr("stroke-width", (d) => (d.id === selectedPrefectureId ? 1.6 : 1.2))
      .on("mouseenter", function (event, d) {
        const reps = politicians.filter(
          (p) => p.district?.prefectureId === d.id
        );
        const names =
          reps.map((p) => p.name).join(", ") || "No representatives in mock data";
        onTooltipShow(
          {
            title: d.name,
            meta: `Representatives here: ${names}`,
          },
          event.clientX,
          event.clientY
        );
      })
      .on("mouseleave", onTooltipHide)
      .on("click", (event, d) => {
        event.stopPropagation();
        const rep = politicians.find(
          (p) => p.district?.prefectureId === d.id
        );
        if (rep) {
          onPoliticianSelect(rep.id);
        }
      });

    // Prefecture dots and labels
    g.selectAll("circle.prefecture-dot")
      .data(prefectures)
      .enter()
      .append("circle")
      .attr("class", (d) =>
        `prefecture-dot ${d.id === selectedPrefectureId ? "selected" : ""}`
      )
      .attr("cx", (d) => d.labelX)
      .attr("cy", (d) => d.labelY)
      .attr("r", 4)
      .attr("fill", (d) =>
        d.id === selectedPrefectureId ? "#22d3ee" : "rgba(148,163,184,0.8)"
      )
      .attr("stroke", (d) => (d.id === selectedPrefectureId ? "#0ea5e9" : "none"))
      .attr("stroke-width", (d) => (d.id === selectedPrefectureId ? 1 : 0));

    g.selectAll("text.map-label")
      .data(prefectures)
      .enter()
      .append("text")
      .attr("class", "map-label fill-gray-400 text-[9px] pointer-events-none")
      .attr("x", (d) => d.labelX + 7)
      .attr("y", (d) => d.labelY + 3)
      .text((d) => d.name);

    // Set up zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform.toString());
      });

    zoomRef.current = zoom;
    svg.call(zoom);
  }, [prefectures, politicians, selectedId, onPoliticianSelect, onTooltipShow, onTooltipHide]);

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

  const selectedPolitician = selectedId
    ? politicians.find((p) => p.id === selectedId)
    : null;

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox="0 0 260 260" className="h-[280px] w-full" />
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleReset}
      />
      <div className="absolute bottom-2 left-2 text-[10px] text-gray-400">
        Scroll to zoom, drag to pan
      </div>
      {selectedPolitician?.district ? (
        <div className="mt-1.5 text-xs text-gray-50">
          <strong>{selectedPolitician.name}</strong>
          <br />
          Electoral district: <strong>{selectedPolitician.district.name}</strong> (
          {selectedPolitician.district.prefectureName})
        </div>
      ) : (
        <div className="mt-1.5 text-xs text-gray-400">
          Select a politician to see their prefecture and electoral district highlighted.
        </div>
      )}
      <div className="mt-1 text-[11px] text-gray-400">
        Simplified prefecture shapes (mock layout) rendered with D3; replace with real
        GeoJSON later.
      </div>
    </div>
  );
}

