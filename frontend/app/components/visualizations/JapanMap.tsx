"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { ParliamentMemberData, Politician, Prefecture } from "@/app/types";
import { ZoomControls } from "@/app/components/shared/ZoomControls";
import VoteDistrictMap from "./components/VoteDistrictMap";

interface JapanMapProps {
  votingDistrictGeoJsonData: any;
  parliamentMemberData: ParliamentMemberData | null;
  selectedId: string | null;
  onPoliticianSelect: (id: string) => void;
  onTooltipShow: (data: { title: string; meta: string }, x: number, y: number) => void;
  onTooltipHide: () => void;
}

export function JapanMap({
  votingDistrictGeoJsonData,
  parliamentMemberData,
  selectedId,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: JapanMapProps) {

	const ku2Party = useMemo(() => {
		const map: Record<string, { name: string; yomikata: string; kaiha: string }> = {};
		for (const party in parliamentMemberData?.shugiin.reprs) {
		  for (const repr of parliamentMemberData?.shugiin.reprs[party]) {
			map[repr.district] = { name: repr.name, yomikata: repr.yomikata, kaiha: repr.kaiha };
		  }
		}
		return map;
	  }, [parliamentMemberData]);

  return (
    <div className="relative">
		<VoteDistrictMap
			geoJsonData={votingDistrictGeoJsonData}
			selectedDistrict={selectedId}
			setCurrentDistrict={onPoliticianSelect}
			ku2Party={ku2Party}
		/>
    </div>
  );
}

