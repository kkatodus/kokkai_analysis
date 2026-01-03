"use client";

import { useMemo } from "react";
import type { ParliamentMemberData } from "@/app/types";
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
		console.log("parliamentMemberData", parliamentMemberData);
		  for (const repr of (parliamentMemberData?.shugiin.reprs || [])) {
			map[repr.district] = { name: repr.name, yomikata: repr.yomikata, kaiha: repr.kaiha };
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

