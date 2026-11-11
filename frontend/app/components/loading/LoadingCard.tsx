"use client";

import { useState } from "react";
import type { LoadingCardItem } from "./content";

const KIND_LABEL: Record<LoadingCardItem["kind"], string> = { tip: "使い方", fact: "豆知識", quiz: "クイズ" };
const KIND_STYLE: Record<LoadingCardItem["kind"], string> = {
  tip: "border-cyan-400/30 bg-cyan-500/10 text-cyan-100",
  fact: "border-indigo-400/30 bg-indigo-500/10 text-indigo-100",
  quiz: "border-amber-400/30 bg-amber-500/10 text-amber-100",
};

type Props = {
  item: LoadingCardItem;
  position: number;
  total: number;
  onNext: () => void;
  onAnswer: (id: string, correct: boolean) => void;
};

/** One tip / fact / quiz card (specs/dashboard-loading §5.2). Re-keyed per item by the overlay. */
export function LoadingCard({ item, position, total, onNext, onAnswer }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl shadow-black/30 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[item.kind]}`}>{KIND_LABEL[item.kind]}</span>
        <span className="font-mono text-[11px] tabular-nums text-gray-500">
          {position}/{total}
        </span>
      </div>

      {item.kind === "quiz" ? (
        <>
          <h3 className="mt-3 text-base font-semibold leading-snug text-gray-50 sm:text-lg">{item.question}</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {item.options.map((opt, i) => {
              const isAnswer = i === item.answer;
              const isPicked = i === picked;
              const tone = !answered
                ? "border-slate-600/70 bg-slate-800/60 text-gray-100 hover:border-cyan-400/50 hover:bg-slate-800"
                : isAnswer
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-50"
                  : isPicked
                    ? "border-rose-400/60 bg-rose-500/15 text-rose-50"
                    : "border-slate-700/60 bg-slate-800/30 text-gray-500";
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  onClick={() => {
                    setPicked(i);
                    onAnswer(item.id, isAnswer);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${tone}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-3 text-sm leading-relaxed text-gray-200">
              <span className={`font-semibold ${picked === item.answer ? "text-emerald-300" : "text-rose-300"}`}>
                {picked === item.answer ? "正解！" : "おしい！"}
              </span>{" "}
              {item.explain}
              <div className="mt-1 text-[11px] text-gray-500">出典: {item.source}</div>
            </div>
          )}
        </>
      ) : (
        <>
          <h3 className="mt-3 text-base font-semibold text-gray-50 sm:text-lg">{item.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{item.body}</p>
          {item.kind === "fact" && <div className="mt-2 text-[11px] text-gray-500">出典: {item.source}</div>}
        </>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-full border border-slate-400/25 bg-slate-800/60 px-4 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-slate-400/45 hover:bg-slate-800"
        >
          {item.kind === "quiz" && !answered ? "スキップ" : "次へ"} →
        </button>
      </div>
    </div>
  );
}
