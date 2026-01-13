"use client";

/**
 * Client Component wrapper for Parliament Explorer
 * Handles all interactive state and user actions
 * Receives initial data from Server Component
 */

import { useState, useCallback, useEffect } from "react";
import { track } from "@vercel/analytics";

import { Header } from "@/app/components/layout/Header";
import { ResizableContainer } from "@/app/components/layout/ResizableContainer";
import { Card, CardHeader } from "@/app/components/shared/Card";
import { Tooltip } from "@/app/components/shared/Tooltip";
import { ModalManager } from "@/app/components/modal/ModalManager";
import { IdeologicalScatterPlot } from "@/app/components/visualizations/IdeologicalScatterPlot";
import { JapanMap } from "@/app/components/visualizations/JapanMap";
import { DetailPane } from "@/app/components/features/DetailPane";
import { HistoricalReprSearch } from "@/app/components/features/HistoricalReprSearch";
import { ModalProvider } from "@/app/lib/hooks/useModal";
import type { ParliamentMemberData, IdeologyData, AllParliamentMemberTableData } from "@/app/types";
import { SeatDistributionChart } from "@/app/components/visualizations/SeatDistributionCharts";
import { ProportionalReprList } from "@/app/components/visualizations/ProportionalReprList";
import { useModal } from "@/app/lib/hooks/useModal";

interface ParliamentExplorerClientProps {
  parliamentMemberData: ParliamentMemberData | null;
  votingDistrictGeoJsonData: any;
  initialSelectedPersonId?: string | null;
  ideologyData: IdeologyData | null;
  allParliamentMemberTable: AllParliamentMemberTableData[] | null;
}

export function ParliamentExplorerClient({
  parliamentMemberData,
  votingDistrictGeoJsonData,
  initialSelectedPersonId,
  ideologyData,	
  allParliamentMemberTable,
}: ParliamentExplorerClientProps) {
  return (
    <ModalProvider>
      <ParliamentExplorerClientInner
        parliamentMemberData={parliamentMemberData}
        votingDistrictGeoJsonData={votingDistrictGeoJsonData}
        initialSelectedPersonId={initialSelectedPersonId}
        ideologyData={ideologyData}
        allParliamentMemberTable={allParliamentMemberTable}
      />
    </ModalProvider>
  );
}

function ParliamentExplorerClientInner({
  parliamentMemberData,
  votingDistrictGeoJsonData,
  initialSelectedPersonId,
  ideologyData,
  allParliamentMemberTable,
}: ParliamentExplorerClientProps) {
  // Initialize state from server-provided initialSelectedId
  const [selectedPersonIdState, setSelectedPersonId] = useState<string | null>(initialSelectedPersonId ?? null);
  

  const [tooltipData, setTooltipData] = useState<{ title: string; meta?: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [mapPane, setMapPane] = useState<"districts" | "proportional">("districts");
  const { currentModals, addModal } = useModal();

  // Keep local selection in sync with browser back/forward without triggering Next.js navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const readFromUrl = () => new URLSearchParams(window.location.search).get("person_id");

    // On mount, prefer current URL (if present), else fall back to server-provided initial value.
    const initialFromUrl = readFromUrl();
    if (initialFromUrl !== null) setSelectedPersonId(initialFromUrl);
    else setSelectedPersonId(initialSelectedPersonId ?? null);

    const onPopState = () => {
      setSelectedPersonId(readFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialSelectedPersonId]);

  // Use selectedId from state (synced with URL)
  // This must be declared before it's used in useMemo hooks
  const selectedPersonId = selectedPersonIdState;


  const handlePoliticianSelect = useCallback(
    (
      id: string | null,
      meta?: { source?: string; queryLength?: number | null }
    ) => {
      const source = meta?.source ?? "unknown";

      if (id) {
        track("SelectPolitician", {
          source,
          personId: id,
          queryLength: meta?.queryLength ?? null,
        });
      } else {
        track("ClosePoliticianDetail", { source });
      }

    // Update local state
    setSelectedPersonId(id);

    // Update URL for shareable links WITHOUT triggering an App Router navigation (which refetches RSC).
    // Use replaceState to avoid adding a history entry for every click.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("person_id", id);
      else url.searchParams.delete("person_id");
      window.history.replaceState({}, "", url.toString());
    }
    },
    []
  );

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

  // Auto-open donation modal for first-time visitors or when URL requests it (e.g. from /payment-cancel).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ensureDonationModalOpen = () => {
      if (!currentModals.includes("donation")) addModal("donation");
    };

    const url = new URL(window.location.href);
    const open = url.searchParams.get("open");
    if (open === "donate") {
      if (!currentModals.includes("donation")) {
        track("OpenDonationModal", { location: "url_param_open=donate" });
      }
      ensureDonationModalOpen();
      // Remove the query param to avoid re-opening on refresh.
      url.searchParams.delete("open");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    const key = "kokkai_doc_seen_at";
    const lastSeenRaw = window.localStorage.getItem(key);
    const lastSeen = lastSeenRaw ? Number(lastSeenRaw) : NaN;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    const isFresh = Number.isFinite(lastSeen) && now - lastSeen < oneDayMs;
    if (!isFresh) {
      if (!currentModals.includes("donation")) {
        track("OpenDonationModal", { location: "auto_first_visit_or_return" });
      }
      ensureDonationModalOpen();
      window.localStorage.setItem(key, String(now));
    }
  }, [addModal, currentModals]);

  return (
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
                    title="歴代議員検索"
                    subtitle="漢字・かな表記で検索できます。クリックで選択します。"
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <HistoricalReprSearch
                      allParliamentMemberTable={allParliamentMemberTable}
                      selectedPersonId={selectedPersonId}
                      onSelect={(id, meta) =>
                        handlePoliticianSelect(id, {
                          source: "historical_search",
                          queryLength: meta?.queryLength ?? null,
                        })
                      }
                    />
                  </div>
                </Card>

                <Card>
                  <CardHeader
                    title="政治的な立場の推定"
                    subtitle="各点は政治家を表しています。クリックすると詳細パネルが開きます。"
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <IdeologicalScatterPlot
                      ideologyData={ideologyData}
                      selectedPersonId={selectedPersonId}
                      onPoliticianSelect={(id) =>
                        handlePoliticianSelect(id, { source: "ideology_scatter" })
                      }
                      onTooltipShow={handleTooltipShow}
                      onTooltipHide={handleTooltipHide}
                    />
                  </div>
                
                </Card>
                <Card>
                  <CardHeader
                    title="選挙区地図"
                    subtitle="選挙区を選択すると、その選挙区の政治家が表示されます。"
                    action={
                      <div className="flex items-center overflow-hidden rounded-full border border-slate-400/60 bg-slate-900/95">
                        <button
                          type="button"
                          onClick={() => {
                            if (mapPane !== "districts") {
                              track("MapPaneChange", { pane: "districts" });
                              setMapPane("districts");
                            }
                          }}
                          className={`px-3 py-1 text-[11px] ${
                            mapPane === "districts"
                              ? "bg-blue-600/90 text-white"
                              : "text-gray-200 hover:bg-white/5"
                          }`}
                        >
                          地図
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (mapPane !== "proportional") {
                              track("MapPaneChange", { pane: "proportional" });
                              setMapPane("proportional");
                            }
                          }}
                          className={`px-3 py-1 text-[11px] ${
                            mapPane === "proportional"
                              ? "bg-blue-600/90 text-white"
                              : "text-gray-200 hover:bg-white/5"
                          }`}
                        >
                          比例
                        </button>
                      </div>
                    }
                  />
                  <div className="relative rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    {mapPane === "districts" ? (
                      <JapanMap
                        votingDistrictGeoJsonData={votingDistrictGeoJsonData as any}
                        parliamentMemberData={parliamentMemberData}
                        selectedPersonId={selectedPersonId}
                        onPoliticianSelect={(id) =>
                          handlePoliticianSelect(id, { source: "district_map" })
                        }
                        onTooltipShow={handleTooltipShow}
                        onTooltipHide={handleTooltipHide}
                      />
                    ) : (
                      <ProportionalReprList
                        parliamentMemberData={parliamentMemberData}
                        onPoliticianSelect={(id) =>
                          handlePoliticianSelect(id, { source: "proportional_list" })
                        }
                      />
                    )}
                  </div>
                </Card>
              </>
            }
            right={
              <>
                <Card>
                  <CardHeader title="参議院 議席配分" subtitle="党派別（現職）" />
                  <div className="rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <SeatDistributionChart parliamentMemberData={parliamentMemberData} house="upper" />
                  </div>
                </Card>

                <Card>
                  <CardHeader title="衆議院 議席配分" subtitle="党派別（現職）" />
                  <div className="rounded-xl border border-slate-400/15 bg-[#020617] p-2">
                    <SeatDistributionChart parliamentMemberData={parliamentMemberData} house="lower" />
                  </div>
                </Card>
              </>
            }
          />
          </div>
        </div>

      <DetailPane
        personId={selectedPersonId ?? ""}
        isOpen={selectedPersonId !== null}
        onClose={() => handlePoliticianSelect(null, { source: "detail_pane_close" })}
        allParliamentMemberTable={allParliamentMemberTable}
      />

        <Tooltip data={tooltipData} x={tooltipPos.x} y={tooltipPos.y} />
      </div>
  );
}

