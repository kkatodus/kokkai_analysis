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
	const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>(null);
	
	const [mapResetCounter, setMapResetCounter] = useState(0);

	// If a person is selected elsewhere (e.g. from search / scatter / list),
	// and that person exists in the map's underlying district data (Shugiin),
	// sync the highlighted district + preview window to match.
	useEffect(() => {
		if (!selectedPersonId) {
			setSelectedDistrict(null);
			setSelectedPrefecture(null);
			return;
		}
		const repr = parliamentMemberData?.shugiin?.reprs?.find(
			(r) => Number(r.person_id) === Number(selectedPersonId)
		);
		if (!repr?.district) return;
		const normalized = repr.district.replace("区", "");
		const prefecture = repr.district.replace(/\d/g, '')
		setSelectedDistrict(normalized);
		setSelectedPrefecture(prefecture);
	}, [selectedPersonId, parliamentMemberData]);

	const currentSangiinPoliticians = useMemo(() => {
		return parliamentMemberData?.sangiin.reprs.filter((repr) => repr.district.includes(selectedPrefecture || ''));
	}, [parliamentMemberData, selectedPrefecture]);
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
		<div className="absolute right-3 top-3 z-30">
			<button
				type="button"
				onClick={() => setMapResetCounter((c) => c + 1)}
				className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-100 shadow-sm backdrop-blur hover:bg-slate-900"
			>
				地図をリセット
			</button>
		</div>
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
			resetCounter={mapResetCounter}
		/>
    </div>
  );
}

