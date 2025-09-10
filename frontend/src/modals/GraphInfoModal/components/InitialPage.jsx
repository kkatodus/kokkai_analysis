import React from 'react';

export default function InitialPage() {
	return (
		<div className="h-full w-full flex flex-col justify-center items-center overflow-y-scroll">
			<h1 className="text-2xl font-bold">このグラフの見方</h1>
			<div className='mx-2'>
				<p>このページで表示されているグラフは議員のスタンスを<span className="font-bold underline">相対的に</span>可視化したものです。つまり、「後ろ向き」のエリアにいる議員はそれよりも右よりの議員よりも<span className="font-bold underline">相対的にみて</span>後ろ向きなスタンスを持っている可能性があるということです。赤いエリアにいる議員であってもトピックに対して前向きな姿勢を持っている可能性はあります。どうぞ参考程度にご覧ください。</p>
			</div>
		</div>
	)
}