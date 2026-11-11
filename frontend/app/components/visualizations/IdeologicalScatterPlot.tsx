"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { THIN_EVIDENCE_OPINIONS } from "@/app/lib/stances";
import * as d3 from "d3";
import type { IdeologyData, PersonIdeologyData } from "@/app/types";

const SCOPE_STORAGE_KEY = "kokkai.ideology.scope";
type Scope = "all" | "current";
import { ZoomControls } from "@/app/components/shared/ZoomControls";
import { Empty } from "@/app/components/shared/states";
import { Field, Select } from "@/app/components/shared/inputs";
import { SegmentedControl } from "@/app/components/shared/Tabs";
import { PartyLegend, type PartyLegendItem } from "@/app/components/shared/PartyLegend";
import availableConfig from "@/app/data/available.json";
import { PARTY2RGBCOLOR, canonicalParty, partyCss } from "@/app/lib/config/parties";

// Point colour comes from the site palette (specs/design-system §7 "Party palette"), not from the
// ideology file's `color` field. 民進 keeps sharing 国民's colour as it always has on this chart.
const SCATTER_LINEAGE: Record<string, string> = { 民進: "国民" };
const OTHER_COLOR = partyCss(null);

function pointColor(d: PersonIdeologyData): string {
  if (d.ref_point && d.ref_point !== "none") return d.color || OTHER_COLOR;
  const party = SCATTER_LINEAGE[d.party] ?? d.party;
  if (PARTY2RGBCOLOR[canonicalParty(party)]) return partyCss(party);
  // past parties the palette does not cover keep their own colour unless the file marks them grey
  if (d.color && d.color !== "grey") return d.color;
  return OTHER_COLOR;
}

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

/** 2025-08-05 → 2025年8月5日 (DESIGN.md "Content"). */
function jaDate(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-");
  if (!y || !m) return d;
  return day ? `${y}年${Number(m)}月${Number(day)}日` : `${y}年${Number(m)}月`;
}

interface IdeologicalScatterPlotProps {
  ideologyData: IdeologyData | null;
  selectedPersonId: string | null;
  /** `topic` is the plot's selected topic slug, so the detail pane can open on its 立場 card */
  onPoliticianSelect: (id: string, meta: { topic: string | null }) => void;
  onTooltipShow: (data: { title: string; meta: string; warning?: string }, x: number, y: number) => void;
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
  const fieldId = useId();
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
  // "all" = every representative scaled in the topic's window; "current" = sitting members only.
  const [scope, setScope] = useState<Scope>("all");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SCOPE_STORAGE_KEY);
      if (saved === "all" || saved === "current") setScope(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const changeScope = (next: Scope) => {
    setScope(next);
    try {
      window.localStorage.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

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
  const selectedTopicSlugRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTopicSlugRef.current = selectedTopic?.topic ?? null;
  }, [selectedTopic?.topic]);

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
    // Text from available.json; the calibrated midpoint comes from the data file.
    const dataAxis = selectedSubTopic?.axis;
    const axis = cfg?.axis
      ? {
          ...cfg.axis,
          midpoint: dataAxis?.midpoint,
          neutral_from: dataAxis?.neutral_from,
          neutral_to: dataAxis?.neutral_to,
        }
      : undefined;
    // default: show if not explicitly false
    const showSpectrum = cfg?.showSpectrum !== false && Boolean(axis);
    return { axis, showSpectrum };
  }, [selectedTopic?.topic, selectedSubTopic]);

  // v2 files flag each point with `current`; a v1 file has no flag, so the toggle is disabled.
  const hasScope = useMemo(
    () => Boolean(selectedSubTopic?.["1d"]?.data?.some((d) => typeof d.current === "boolean")),
    [selectedSubTopic],
  );
  const effectiveScope: Scope = hasScope ? scope : "all";

  const points: PersonIdeologyData[] = useMemo(() => {
    if (!selectedSubTopic) return [];
    if (mode === "2d" && effectiveScope === "current") {
      // the job precomputes a UMAP layout for current members only
      const cur = selectedSubTopic["2d_current"]?.data;
      if (cur && cur.length) return cur;
      return (selectedSubTopic["2d"]?.data ?? []).filter((d) => d.ref_point !== "none" || d.current !== false);
    }
    const bucket = selectedSubTopic[mode] as { data: PersonIdeologyData[] } | undefined;
    const all = bucket?.data ?? [];
    if (effectiveScope === "current") return all.filter((d) => d.current !== false);
    return all;
  }, [selectedSubTopic, mode, effectiveScope]);

  // Legend for the plotted points: one chip per colour. Several parties can share a colour
  // (e.g. 国民 and 民進); the chip lists them. Parties without a colour are shown as その他.
  const legendItems = useMemo<PartyLegendItem[]>(() => {
    const byColor = new Map<string, Map<string, number>>();
    for (const d of points) {
      if (d.ref_point && d.ref_point !== "none") continue; // reference points are not politicians
      const color = pointColor(d);
      const parties = byColor.get(color) ?? new Map<string, number>();
      const name = canonicalParty(d.party);
      parties.set(name, (parties.get(name) ?? 0) + 1);
      byColor.set(color, parties);
    }
    const items: PartyLegendItem[] = [];
    for (const [color, parties] of byColor) {
      const count = Array.from(parties.values()).reduce((a, b) => a + b, 0);
      const names = Array.from(parties.entries()).sort((a, b) => b[1] - a[1]).map(([p]) => p);
      const label = color === OTHER_COLOR ? "その他" : names.join("・");
      items.push({ label, color, count });
    }
    return items.sort((a, b) => (a.label === "その他" ? 1 : b.label === "その他" ? -1 : b.count! - a.count!));
  }, [points]);

  const windowLabel = useMemo(() => {
    const w = selectedTopic?.window;
    if (!w || !w.from) return "";
    const span = `${jaDate(w.from)}〜${w.to ? jaDate(w.to) : "現在"}`;
    const n = selectedTopic?.n_scaled;
    const c = selectedTopic?.n_current;
    const counts = n != null ? `・${n.toLocaleString()}人${c != null ? `（現職${c.toLocaleString()}人）` : ""}` : "";
    return `対象期間：${span}${counts}`;
  }, [selectedTopic]);

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
      const xLowLabel = selectedAxis.showSpectrum ? "反対" : "x 小";
      const xHighLabel = selectedAxis.showSpectrum ? "賛成" : "x 大";

      const labelY = innerHeight - 4;
      g.append("text")
        .attr("x", 0)
        .attr("y", labelY)
        .attr("class", "fill-ink-muted text-caption")
        .text(xLowLabel);

      g.append("text")
        .attr("x", innerWidth - 2)
        .attr("y", labelY)
        .attr("text-anchor", "end")
        .attr("class", "fill-ink-muted text-caption")
        .text(xHighLabel);

      // Where stances really switch from con to pro (hand-calibrated; raw x = 0 is not the political middle)
      const ax = selectedAxis.showSpectrum ? selectedAxis.axis : null;
      if (ax?.midpoint != null && ax.neutral_from != null && ax.neutral_to != null) {
        const x0 = xScale(ax.neutral_from);
        const x1 = xScale(ax.neutral_to);
        if (x1 - x0 > 0.5) {
          g.append("rect")
            .attr("x", x0)
            .attr("y", 0)
            .attr("width", x1 - x0)
            .attr("height", innerHeight)
            .attr("fill", "rgba(255,255,255,0.06)")
            .append("title")
            .text("中立帯：賛否が混在する範囲");
        }
        const xm = xScale(ax.midpoint);
        g.append("line")
          .attr("x1", xm)
          .attr("x2", xm)
          .attr("y1", 0)
          .attr("y2", innerHeight)
          .attr("stroke", "rgba(255,255,255,0.45)")
          .attr("stroke-dasharray", "4 3")
          .attr("stroke-width", 1);
        g.append("text")
          .attr("x", xm)
          .attr("y", 12)
          .attr("text-anchor", "middle")
          .attr("class", "fill-ink text-caption")
          .text("賛否の分かれ目");
      }
    }

    // Points
    const baseR = 4;
    const UNSELECTED_STROKE = "rgba(255,255,255,0.55)";
    const SELECTED_STROKE = "#22d3ee"; // primary: the cyan selection ring
    const circles = g
      .selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale(d.x))
      // In 1D mode we still use y for separation (prevents overlap / improves clickability)
      .attr("cy", (d) => yScale(d.y))
      .attr("r", baseR)
      .attr("fill", (d) => pointColor(d))
      .attr("opacity", 0.9)
      // Slightly brighter outline so dark/black dots remain visible.
      .attr("stroke", UNSELECTED_STROKE)
      .attr("stroke-width", 1.25)
      .style("cursor", "pointer")
      .on("mousemove", (event, d) => {
        const extra = [
          d.current === false ? "元議員" : "",
          d.n_opinions != null ? `意見 ${d.n_opinions}` : "",
          d.last_speech ? `最終発言 ${jaDate(d.last_speech)}` : "",
        ]
          .filter(Boolean)
          .join(" • ");
        const meta =
          (mode === "2d"
            ? `${d.party} • x:${d.x.toFixed(2)} y:${d.y.toFixed(2)}`
            : `${d.party} • x:${d.x.toFixed(2)}`) + (extra ? ` • ${extra}` : "");
        const warning = d.n_opinions != null && d.n_opinions < THIN_EVIDENCE_OPINIONS ? "根拠が少ない" : undefined;
        onTooltipShowRef.current({ title: d.repr, meta, warning }, event.clientX, event.clientY);
      })
      .on("mouseleave", () => onTooltipHideRef.current())
      .on("click", (_event, d) => {
        const id = d.person_id != null ? String(d.person_id) : d.repr;
        onPoliticianSelectRef.current(id, { topic: selectedTopicSlugRef.current });
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
  }, [points, mode, selectedAxis.showSpectrum, selectedAxis.axis]);

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
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <Field label="トピック" htmlFor={`${fieldId}-topic`} className="min-w-[8rem] flex-1">
          <Select
            id={`${fieldId}-topic`}
            size="sm"
            value={selectedTopicIdx}
            onChange={(e) => {
              setSelectedTopicIdx(Number(e.target.value));
              setSelectedSubTopicIdx(0);
            }}
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
          </Select>
        </Field>

        <Field label="論点" htmlFor={`${fieldId}-sub`} className="min-w-[9rem] flex-1">
          <Select
            id={`${fieldId}-sub`}
            size="sm"
            value={selectedSubTopicIdx}
            onChange={(e) => setSelectedSubTopicIdx(Number(e.target.value))}
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
          </Select>
        </Field>

        <SegmentedControl<"1d" | "2d">
          label="表示方法"
          items={[
            { value: "1d", label: "1D", disabled: !filteredTopics.length },
            { value: "2d", label: "2D", disabled: !filteredTopics.length },
          ]}
          value={mode}
          onChange={setMode}
        />

        <div title={hasScope ? "全議員（期間内）と現職のみを切り替え" : "このデータには現職フラグがありません"}>
          <SegmentedControl<Scope>
            label="表示する議員"
            items={[
              { value: "all", label: "全議員", disabled: !filteredTopics.length || !hasScope },
              { value: "current", label: "現職のみ", disabled: !filteredTopics.length || !hasScope },
            ]}
            value={effectiveScope}
            onChange={changeScope}
          />
        </div>
      </div>

      {windowLabel && <p className="mb-2 text-caption text-ink-muted">{windowLabel}</p>}

      {mode === "1d" && selectedAxis.showSpectrum && selectedAxis.axis && (
        <div className="mb-2 grid gap-2 rounded-lg bg-surface-raised p-3 text-body-sm text-ink sm:grid-cols-2">
          <div>
            <p className="mb-1 text-label-sm text-ink-muted">反対（左）</p>
            <p>{selectedAxis.axis.con}</p>
          </div>
          <div>
            <p className="mb-1 text-label-sm text-ink-muted">賛成（右）</p>
            <p>{selectedAxis.axis.pro}</p>
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative overflow-hidden">
        {(!ideologyData || !filteredTopics.length || !selectedSubTopic) ? (
          <Empty message="立場の推定データが見つかりませんでした。" className="h-[280px]" />
        ) : (
          <>
            {/* Keep zoom/pan drawing clipped to the plot area so it doesn't cover controls/header */}
            <svg ref={svgRef} className="h-[280px] w-full overflow-hidden" />
            <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
          </>
        )}
      </div>

      {ideologyData && filteredTopics.length > 0 && selectedSubTopic && (
        <p className="mt-1 text-caption text-ink-muted">
          {titleLabel ? `${titleLabel}・` : ""}
          スクロールでズーム、ドラッグでパン
        </p>
      )}

      {legendItems.length > 0 && (
        <PartyLegend items={legendItems} caption="色＝発言時の会派" unit="人" className="mt-2" />
      )}
    </div>
  );
}

