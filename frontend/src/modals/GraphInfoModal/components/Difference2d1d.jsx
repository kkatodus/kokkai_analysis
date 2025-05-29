import React from 'react';

export default function Difference2d1d() {
	return (
		<div className="h-full w-full flex flex-col justify-center items-center overflow-y-scroll">
			<h1 className="text-2xl font-bold">2次元表示と1次元表示の違い</h1>
			<div className="mx-2">
				<p>二次元表示は、議員のスタンスを二次元の空間に相対的に表しています。つまりここでのx軸とy軸はあまり意味を持ちません。二次元表示で表示される黒い線は今選択されている対立軸を表しています。それに対して1次元表示では、議員のスタンスを一次元の軸で表しています。この場合、右に行くほど前向きなスタンス、左に行くほど後ろ向きなスタンスを表しています。</p>
				<p>このグラフに疑問がある方は、<a className="font-bold underline text-blue-500" href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noopener noreferrer">こちらの論文</a>をご覧いただくか、kokkai.doc@gmail.comまでご連絡ください。</p>
			</div>
		</div>
	)
}