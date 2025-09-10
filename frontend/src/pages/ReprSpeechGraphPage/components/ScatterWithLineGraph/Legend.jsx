import React from 'react';
import { Party2ColorList } from 'resource/resources';
import useDisplaySize from 'state/useDisplayType';

function RenderLegend() {
	const { type: DisplayType } = useDisplaySize();
	const isMobile = DisplayType === 'mobile';
	return (
	<div className="flex flex-wrap">
		{Party2ColorList.map((d) => (
		<div key={d.party} className="flex px-2">
			<h1 className={`${isMobile ? 'text-xs' : ''}`}>{d.party}</h1>
			<div
			className={`w-5 h-5 rounded-full ml-2 ${isMobile ? 'w-4 h-4' : ''}`}
			style={{ backgroundColor: d.color }}
			/>
		</div>
		))}
	</div>
	);
}

export default RenderLegend;
