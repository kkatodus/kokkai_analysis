import React from 'react';

export default function ScreenSizeDisclaimer() {
	return (
		<div className="h-full w-full flex flex-col justify-center items-center overflow-y-scroll">
			<h1 className="text-2xl font-bold">画面サイズについて</h1>
			<div className="mx-2">
				<p>このページはスマートフォンなどの小さい画面だと構成が崩れてしまうため、グラフの点の位置関係などを読み解きやすいPCやタブレット端末などの大きい画面でご覧ください。</p>
			</div>
		</div>
	)
}