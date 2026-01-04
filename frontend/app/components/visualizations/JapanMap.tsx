"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParliamentMemberData } from "@/app/types";
import VoteDistrictMap from "./components/VoteDistrictMap";
import PoliticianPreviewWindow from "./components/PoliticianPreviewWindow";

interface JapanMapProps {
  votingDistrictGeoJsonData: any;
  parliamentMemberData: ParliamentMemberData | null;
  selectedPersonId?: string | null;
  onPoliticianSelect?: (id: string) => void;
  onTooltipShow?: (data: { title: string; meta?: string }, x: number, y: number) => void;
  onTooltipHide?: () => void;
}


export function JapanMap({
  votingDistrictGeoJsonData,
  parliamentMemberData,
  selectedPersonId,
  onPoliticianSelect,
  onTooltipShow,
  onTooltipHide,
}: JapanMapProps) {

	const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

	// If a person is selected elsewhere (e.g. from search / scatter / list),
	// and that person exists in the map's underlying district data (Shugiin),
	// sync the highlighted district + preview window to match.
	useEffect(() => {
		if (!selectedPersonId) {
			setSelectedDistrict(null);
			return;
		}
		const repr = parliamentMemberData?.shugiin?.reprs?.find(
			(r) => Number(r.person_id) === Number(selectedPersonId)
		);
		if (!repr?.district) return;
		const normalized = repr.district.replace("区", "");
		setSelectedDistrict(normalized);
	}, [selectedPersonId, parliamentMemberData]);

	const currentSangiinPoliticians = useMemo(() => {
		return parliamentMemberData?.sangiin.reprs.filter((repr) => selectedDistrict?.includes(repr.district));
	}, [parliamentMemberData, selectedDistrict]);
	const currentShugiinPoliticians = useMemo(() => {
		return parliamentMemberData?.shugiin.reprs.filter((repr) => repr.district.includes(selectedDistrict || ''));
	}, [parliamentMemberData, selectedDistrict]);


	const ku2Party = useMemo(() => {
		const map: Record<string, { name: string; yomikata: string; kaiha: string }> = {};
		  for (const repr of (parliamentMemberData?.shugiin.reprs || [])) {
			map[repr.district] = { name: repr.name, yomikata: repr.yomikata, kaiha: repr.kaiha };
		  }
		return map;
	  }, [parliamentMemberData]);

  return (
    <div className="relative" id="japan-map">
		<PoliticianPreviewWindow
			selectedDistrict={selectedDistrict}
			shugiinPoliticians={currentShugiinPoliticians}
			sangiinPoliticians={currentSangiinPoliticians || []}
			onPoliticianSelect={onPoliticianSelect}
			selectedPersonId={selectedPersonId}
		/>

		<VoteDistrictMap
			selectedDistrict={selectedDistrict}
			geoJsonData={votingDistrictGeoJsonData}
			setCurrentDistrict={setSelectedDistrict}
			ku2Party={ku2Party}
		/>
    </div>
  );
}

