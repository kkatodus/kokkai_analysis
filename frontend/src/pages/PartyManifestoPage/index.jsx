import React, { useState } from 'react';
import BasePageLayoutV2 from 'layouts/BasePageLayoutV2';
import useDisplaySize from 'state/useDisplayType';
import PartySelector from './components/PartySelector';
import ManifestoDisplay from './components/ManifestoDisplay';
import CoherenceMonitor from './components/CoherenceMonitor';

const PARTIES = [
	"日本共産党",
	"日本維新の会",
	"無所属連合",
	"日本保守党",
	"立憲民主党",
	"参政党",
	"国民民主党",
	"チームみらい",
	"日本誠真会",
	"社会民主党",
	"れいわ新選組",
	"日本改革党",
	"自由民主党",
	"再生の道",
	"公明党",
	"NHK党"
]

const PARTY_COLORS = {
	"日本共産党": "red-600",
	"日本維新の会": "blue-600",
	"無所属連合": "green-600",
	"日本保守党": "yellow-500",
	"立憲民主党": "purple-600",
	"参政党": "orange-600",
	"国民民主党": "pink-600",
	"チームみらい": "amber-700",
	"日本誠真会": "gray-600",
	"社会民主党": "teal-600",
	"れいわ新選組": "lime-600",
	"日本改革党": "cyan-600",
	"自由民主党": "gray-900",
	"再生の道": "red-500",
	"公明党": "blue-500",
	"NHK党": "green-500",
}

function PartyManifestoPage() {
	const [selectedParty, setSelectedParty] = useState('自由民主党');
	

	const { type: DisplayType } = useDisplaySize();
	const isMobile = DisplayType === 'mobile';
	

	return (
	<BasePageLayoutV2
		pageTitle="政党の政策分析"
		backTo="/"
	>
		<div className="h-full w-full flex flex-col">
			{/* Party Selector - Fixed at top */}
			<div className="flex-shrink-0 sticky top-0 z-10 bg-white shadow-md">
				<PartySelector availableParties={PARTIES} partyColors={PARTY_COLORS} selectedParty={selectedParty} setSelectedParty={setSelectedParty} />
			</div>
			
			{/* Content Area - Takes remaining space */}
			<div className={`flex-1 flex ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden`}>
				<div className={`${isMobile ? 'h-1/2 w-full border-b-4 border-gray-300' : 'w-1/2 h-full border-r-2 border-gray-300'} flex flex-col`}>
					<ManifestoDisplay selectedParty={selectedParty} />
				</div>
				<div className={`${isMobile ? 'h-1/2 w-full' : 'w-1/2 h-full'} flex flex-col`}>
					<CoherenceMonitor selectedParty={selectedParty} />
				</div>
			</div>
		</div>
	</BasePageLayoutV2>
	);
}

export default PartyManifestoPage;