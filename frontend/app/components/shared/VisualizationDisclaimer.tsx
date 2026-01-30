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
  // Hard-coded for now (per request). Update these when you change models/prompts.
  const llmModelName = "gemma3:27b-it-q8_0"; // e.g. "gpt-4.1-mini" or "gemini-2.0-flash"
  const llmPrompt = `
  # 指示
あなたは議会運営と政策論争の専門家です。
以下の「会議の議題」と、そこでの「実際の議論（会話ログ）」を比較分析し、
JSON形式で厳密に評価してください。

# 会議情報
- 会議名: {meeting_name}
- 案件(議題): {issue_name}

# 評価項目
1. **is_relevant** (bool): 
   この議論は、上記の「案件(議題)」に関連していますか？
   (個人的なスキャンダル追及、野次、手続き論のみで終始している場合は false。)

2. **is_productive** (bool):
   この議論は生産的（建設的）ですか？
   (具体的な政策提案、事実確認、論点の明確化があれば true。
    単なる誹謗中傷、答えようのない質問、遅延行為、堂々巡りは false。)

3. **initiator** (str):
   この一連の議論（話題）を実質的に開始した、または方向付けた発言者は誰ですか？
   (リストに含まれる発言者名から選んでください)

4. **reason** (str):
   上記の判定に至った理由を、具体的かつ客観的に100文字以内の日本語で記述してください。
`;

  return (
    <>
      <div>
	  本ページに表示される「関連度」「生産性」の指標は、国会等で公開されている発言記録（一次情報）をもとに、<strong>大規模言語モデル（LLM）による自動的な分析・分類</strong>を行った結果です。
	  これらはシステムによる<strong>推定的・参考的な分析結果</strong>であり、発言者である政治家個人の評価、能力、意図、誠実性、または政治的立場や価値を断定・保証するものではありません。
      </div>
	  <div>
	  本指標は、あくまで研究・情報提供を目的とした補助的な情報です。最終的な判断については、当ウェブサイト上で公開している会議録・議事録等の<strong>一次資料をご自身でご確認のうえ</strong>、総合的にご判断ください。
	  </div>
	  <div>
		分類方法についての補足：
		<ul className="ml-4 list-disc space-y-1">
			<li>
			一つの会議は、複数の政治家による複数の発言（以下「発言」）および複数の議題（以下「議題」）から構成される場合があります。
			</li>
			<li>
			本システムは、個々の政治家や人物そのものを評価・分類するものではなく、<strong>議題および発言内容と会議全体との関係性</strong>を分析対象としています。
			</li>
			<li>
			分析の観点は、議題が会議全体のテーマや進行とどの程度関連しているか、また議論の進行という観点からどのような位置づけにあるか、という点に限定されています。
			</li>
			<li>
			分類結果は、その議題を開始した発言に対応づけて統計的に集計されます。例えば、政治家Aがある議題を開始し、政治家Bがそれに応答した場合でも、分類結果は議題単位で扱われ、政治家B個人の発言内容そのものを評価・分類するものではありません。
			</li>
			<li>
			したがって、本システムはすべての議員のすべての発言を網羅的に評価するものではなく、<strong>公開されている議事記録を対象とした議題単位の分析結果</strong>を提供するものです。
			</li>
		</ul>
</div>

      <details className="rounded-lg border border-slate-400/15 bg-slate-950/10 px-3 py-2">
        <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-100 hover:text-white">
          使用したLLMモデル名とプロンプト（展開）
        </summary>
        <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-gray-300">
          <div>
            <span className="font-semibold text-gray-200">モデル名：</span>
            <span className="font-mono text-[11px] text-gray-200">{llmModelName}</span>
          </div>
          <div>
            <div className="mb-1 font-semibold text-gray-200">プロンプト：</div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-400/15 bg-black/20 p-2 text-[11px] text-gray-200">
              {llmPrompt}
            </pre>
            <div className="text-[11px] text-gray-400">
              注：結果を再現する際には、システムプロンプト・温度などの設定、前処理/後処理、バージョン差分等により結果が変わり得ます。
            </div>
          </div>
        </div>
      </details>

    </>
  );
}

