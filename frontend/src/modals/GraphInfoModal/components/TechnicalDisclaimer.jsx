import React from 'react';

export default function TechnicalDisclaimer() {
	return (
		<div className="h-full w-full flex flex-col justify-center items-center overflow-y-scroll">
			<h1 className="text-2xl font-bold">技術的な注意事項</h1>
			<div className="mx-2">
				<p><span className="font-bold underline">注：</span>このグラフは、政治家の発言内容をAIや統計的な手法を用いて分析し、トピックに対する政治家の思想の推定位置を可視化したものです。このグラフはあくまで国会内での発言内容をもとにポジションの推定をしたものであり、政治家の思想の位置を決定づけるものではありません。参考程度にご利用ください。このグラフの生成に関する技術的な詳細については<a className="font-bold underline text-blue-500" href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noopener noreferrer">こちらの論文</a>をご覧ください。</p>
				<p><span className="font-bold underline">報告されているバグ：</span>現在グラフの表示において、同姓同名の政治家の場合、同じ発言内容が表示されます。これは、同姓同名の政治家の区別をするロジックが今のところ実装されていないためです。ただいま、実装中ですので、今しばらくお待ちください。</p>
			</div>
		</div>
	)
}