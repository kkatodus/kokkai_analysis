"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParliamentMemberData } from "@/app/types";
import VoteDistrictMap from "./components/VoteDistrictMap";
import PoliticianPreviewWindow from "./components/PoliticianPreviewWindow";
import { PartyLegend, type PartyLegendItem } from "@/app/components/shared/PartyLegend";
import { PARTY2RGBCOLOR, PARTY_FALLBACK_RGB } from "@/app/lib/config/parties";

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
		setSelectedDistrict(normalized);
	}, [selectedPersonId, parliamentMemberData]);

	const currentSangiinPoliticians = useMemo(() => {
		return parliamentMemberData?.sangiin.reprs.filter((repr) => repr.district.includes(selectedDistrict?.replace(/\d+/g, '') || ''));
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

	// Legend: one chip per party colour on the map, counted in single-member districts.
	// Parties without a configured colour share the fallback colour and are grouped as その他.
	const legendItems = useMemo<PartyLegendItem[]>(() => {
		const rgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
		const counts = new Map<string, number>();
		let other = 0;
		for (const [district, { kaiha }] of Object.entries(ku2Party)) {
			if (/比例|[（(]比[）)]/.test(district)) continue; // proportional blocks (e.g. 「（比）北関東」) are not on the map
			if (PARTY2RGBCOLOR[kaiha]) counts.set(kaiha, (counts.get(kaiha) ?? 0) + 1);
			else other += 1;
		}
		const items = Array.from(counts, ([label, count]) => ({ label, color: rgb(PARTY2RGBCOLOR[label]), count }))
			.sort((a, b) => b.count - a.count);
		if (other) items.push({ label: "その他", color: rgb(PARTY_FALLBACK_RGB), count: other });
		return items;
	}, [ku2Party]);

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
		<PartyLegend items={legendItems} caption="色＝小選挙区の当選者の会派" className="mt-2" />
    </div>
  );
}

