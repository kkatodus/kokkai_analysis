"use client";

import type { ReactNode } from "react";

export function DisclaimerToggleButton({
  pressed,
  onClick,
  labelWhenHidden = "注意事項",
  labelWhenShown = "可視化を表示",
}: {
  pressed: boolean;
  onClick: () => void;
  labelWhenHidden?: string;
  labelWhenShown?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={
        "rounded-full border px-3 py-1 text-[11px] font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400/40 " +
        (pressed
          ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
          : "border-slate-400/30 bg-slate-950/20 text-gray-200 hover:bg-white/5")
      }
      title={pressed ? "可視化に戻る" : "注意事項を見る"}
    >
      {pressed ? labelWhenShown : labelWhenHidden}
    </button>
  );
}

export function DisclaimerPanel({ children, title = "注意事項" }: { children: ReactNode; title?: string }) {
  return (
    <div className="rounded-xl border border-slate-400/15 bg-slate-950/20 p-3 text-[12px] leading-relaxed text-gray-200">
      <div className="mb-2 text-[11px] font-semibold text-gray-100">{title}</div>
      <div className="space-y-2 text-gray-300">{children}</div>
    </div>
  );
}

export function IdeologyDisclaimerContent() {
  return (
    <>
      <div>
        この可視化は、議員の発言データから<strong>推定</strong>した「政治的な立場」を示します。推定には誤差・偏りが含まれる可能性があり、政治家の立場を正確に反映しているわけではありません。
      </div>
	  <div>
		この可視化の手法は、以下の論文を参考にしています。
		<ul>
			<li>
				<a href="https://arxiv.org/abs/2505.07118" target="_blank" rel="noopener noreferrer">
				KOKKAI DOC: An LLM-driven framework for scaling parliamentary representatives
				</a>
			</li>
		</ul>
	  </div>
      <div>表示は参考情報としてご利用ください。最終的な判断には一次情報（議員の会議録など）も併せてご確認ください。</div>
    </>
  );
}

export function RelevanceProductivityDisclaimerContent() {
  return (
    <>
      <div>
        この指標（関連度・生産性）は、発言内容をもとに<strong>LLM</strong>を用いて<strong>推定/自動分類</strong>した結果です。判定は誤る可能性があり、
        政治家や発言の価値を断定するものではありません。
      </div>
	  <div>
		ここでの指標はあくまで参考情報としてご利用ください。最終的な判断には当ウェブサイトで公開されている一次情報（議員の会議録など）も併せてご確認ください。
	  </div>
	  <div>
		分類方法についての補足：<br/>
		<ul className="ml-4 list-disc space-y-1">
			<li>
				一つの会議は複数の政治家の発言（以下、発言と呼びます）から成ります。また、一つの会議では複数の議題（以下、議題と呼びます）が議論されることもあります。
			</li>
			<li>
				我々の判断基準は、
				<ul className="ml-6 list-disc space-y-1">
					<li>
						議題が会議全体に関連しているか、そして議題が会議にとって生産性があるかどうかです。
					</li>
					<li>
						議題の分類結果は、その議題を開始した政治家の統計に反映されます。例えば、政治家Aが関連性のない、生産性のない議題を開始して、政治家Bがそれに対して答えた場合、政治家Bの統計結果は影響されません。
					</li>
					<li>
						つまり、全ての議員の全ての発言を分類したわけではないということです。我々はあくまで議題単位で分類をし、議題ごとに関連性と生産性を判断しています。そして、その議題を開始した政治家の統計に分類結果を反映しています。
					</li>
				</ul>
			</li>
		</ul>
	  </div>

    </>
  );
}

