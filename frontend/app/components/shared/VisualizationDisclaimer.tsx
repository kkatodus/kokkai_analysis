"use client";

import type { ReactNode } from "react";
import type { QualityAggregate } from "@/app/types";
import {
  CONTRIBUTION_DESC_JA,
  CONTRIBUTION_JA,
  CONTRIBUTIONS,
  FUNCTION_DESC_JA,
  FUNCTION_JA,
  FUNCTIONS,
  ISSUE_DESC_JA,
  ISSUE_JA,
  ISSUE_TYPES,
  OUTCOME_JA,
  OUTCOMES,
  yearMonth,
} from "@/app/lib/quality";
import { QUALITY_PROMPT_VERSION, QUALITY_SYSTEM_PROMPT } from "@/app/lib/qualityPrompt";

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

export function SpeechQualityDisclaimerContent({ aggregate }: { aggregate: QualityAggregate | null }) {
  const cov = aggregate?.coverage ?? null;
  // Models that labelled at least 1% of the exchanges (a two-exchange smoke test on another model is left out).
  const allModels = Object.entries(aggregate?.models ?? {}).sort((a, b) => b[1] - a[1]);
  const modelTotal = allModels.reduce((n, [, c]) => n + c, 0);
  const modelEntries = allModels.filter(([, c]) => c >= modelTotal * 0.01);
  const modelText = modelEntries.length ? modelEntries.map(([m]) => m).join("、") : "gemini-3.8-flash";

  return (
    <>
      <div>
        「やり取りの評価」は、国会会議録（一次情報）の委員会質疑を、<strong>大規模言語モデル（LLM）が自動的に分類</strong>した結果です。
        これはシステムによる<strong>推定的・参考的な分析</strong>であり、議員や大臣個人の能力、意図、誠実性、政治的立場や価値を断定・保証するものではありません。
        最終的な判断は、当サイトから開ける会議録の<strong>原文をご自身でご確認のうえ</strong>行ってください。
      </div>

      <div>
        <div className="mb-1 font-semibold text-gray-100">対象と単位</div>
        <ul className="ml-4 list-disc space-y-1">
          <li>
            評価の単位は「やり取り」です。ある委員の質問の持ち時間と、それに対する政府側などの答弁をひとまとまりとして扱い、個々の発言は評価しません。
          </li>
          <li>
            対象は2000年以降の<strong>委員会</strong>質疑で、新しい会議から順にさかのぼって追加しています。本会議、ごく短い手続き的なやり取り、答弁のないやり取りは対象外です。
            {cov?.from && (
              <>
                {" "}現在の対象期間: <strong>{yearMonth(cov.from)}〜{yearMonth(cov.to)}</strong>（{cov.exchanges.toLocaleString()} やり取り、{cov.meetings.toLocaleString()} 会議）。
              </>
            )}
          </li>
          <li>
            質問者としての集計はその人が始めたやり取り、答弁者としての集計はその人が答弁したやり取りについて行っています。発言者の同定（氏名→議員）は自動で行っており、同定できなかった発言は集計に含まれません。
          </li>
          <li>
            否定的なラベルは「疑わしきは本人に有利に」を原則とし、問題が明らかな場合にだけ付くようモデルに指示しています。党派によって基準を変えてはならないことも明示しています。
          </li>
        </ul>
      </div>

      <div>
        <div className="mb-1 font-semibold text-gray-100">ラベルの意味</div>
        <div className="space-y-2">
          <div>
            <div className="text-gray-200">何のためのやり取りか（種類。良し悪しではありません）</div>
            <ul className="ml-4 list-disc">
              {FUNCTIONS.map((f) => (
                <li key={f}>
                  <strong>{FUNCTION_JA[f]}</strong>: {FUNCTION_DESC_JA[f]}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-gray-200">成果（やり取り全体として）</div>
            <ul className="ml-4 list-disc">
              {CONTRIBUTIONS.map((c) => (
                <li key={c}>
                  <strong>{CONTRIBUTION_JA[c]}</strong>: {CONTRIBUTION_DESC_JA[c]}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-gray-400">
              成果の内訳: {OUTCOMES.map((o) => OUTCOME_JA[o]).join("・")}。既存の施策や政府方針の確認・後押しは「提案」に含めません。
            </div>
          </div>
          <div>
            <div className="text-gray-200">問題点（該当する場合のみ。質問者側か答弁者側か、やり取りの一部か大半かを区別）</div>
            <ul className="ml-4 list-disc">
              {ISSUE_TYPES.map((t) => (
                <li key={t}>
                  <strong>{ISSUE_JA[t]}</strong>: {ISSUE_DESC_JA[t]}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-gray-400">
              一部にだけ問題があっても、やり取り全体の成果は残りの部分で判断されます。「成果」の割合と「問題点」の割合は別々の指標です。
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-1 font-semibold text-gray-100">公平性について</div>
        <div>
          不祥事の追及は主に野党、お膳立て質問は主に与党の行動であるため、基準は双方を数えるよう設計しています。
          また、公金や公的権限に関わる不祥事の追及は「行政監視」として正当な機能に数え、公務と無関係な私生活への固執だけを問題点としています。
          それでもモデルの判断には誤りや偏りが含まれ得ます。
        </div>
      </div>

      <details className="rounded-lg border border-slate-400/15 bg-slate-950/10 px-3 py-2">
        <summary className="cursor-pointer select-none text-[11px] font-semibold text-gray-100 hover:text-white">
          使用したLLMモデルとプロンプト（展開）
        </summary>
        <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-gray-300">
          <div>
            <span className="font-semibold text-gray-200">モデル：</span>
            <span className="font-mono text-[11px] text-gray-200">{modelText}</span>
            <span className="ml-2 text-[11px] text-gray-400">（バッチ処理、temperature 0、思考レベル low）</span>
          </div>
          <div>
            <div className="mb-1 font-semibold text-gray-200">プロンプト（{QUALITY_PROMPT_VERSION}）：</div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-slate-400/15 bg-black/20 p-2 text-[11px] text-gray-200">
              {QUALITY_SYSTEM_PROMPT}
            </pre>
            <div className="text-[11px] text-gray-400">
              各やり取りには、会議名・日付・質問者と会派、同じ会議でそれ以前にあったやり取りの冒頭、そして評価対象のやり取り全文を付けて渡しています。
              結果を再現する際には、モデルのバージョン、前処理・後処理、設定の差により結果が変わり得ます。
            </div>
          </div>
        </div>
      </details>
    </>
  );
}
