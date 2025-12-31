"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { Politician, Prefecture } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";
import VoteDistrictMap from "./components/VoteDistrictMap";

interface JapanMapProps {
  votingDistrictGeoJsonData: any;
  politicians: Politician[];
  selectedId: string | null;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function JapanMap({
  votingDistrictGeoJsonData,
  politicians,
  selectedId,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: JapanMapProps) {




  return (
    <div className="relative">
		<VoteDistrictMap
			geoJsonData={votingDistrictGeoJsonData}
			selectedDistrict={selectedId}
			setCurrentDistrict={onPoliticianSelect}
		/>
    </div>
  );
}

