"use client";

import { Badge, type BadgeTone } from "@/app/components/shared/Badge";
import { Button } from "@/app/components/shared/Button";
import { useState } from "react";
import type { LoadingCardItem } from "./content";

const KIND_LABEL: Record<LoadingCardItem["kind"], string> = { tip: "使い方", fact: "豆知識", quiz: "クイズ" };
const KIND_TONE: Record<LoadingCardItem["kind"], BadgeTone> = { tip: "accent", fact: "info", quiz: "neutral" };

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
    <div className="rounded-2xl border border-line bg-surface-raised p-4 shadow-xl sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={KIND_TONE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
        <span className="text-data text-ink-muted">
          {position}/{total}
        </span>
      </div>

      {item.kind === "quiz" ? (
        <>
          <h3 className="mt-3 text-title-md text-ink-strong">{item.question}</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {item.options.map((opt, i) => {
              const isAnswer = i === item.answer;
              const isPicked = i === picked;
              const tone = !answered
                ? "border-line bg-surface-control text-ink-strong hover:border-primary-line hover:bg-surface-hover"
                : isAnswer
                  ? "border-success bg-success-soft text-on-success-soft"
                  : isPicked
                    ? "border-error bg-error-soft text-on-error-soft"
                    : "border-line-subtle bg-surface-raised text-ink-disabled";
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={answered}
                  onClick={() => {
                    setPicked(i);
                    onAnswer(item.id, isAnswer);
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-left text-body-md transition-colors ${tone}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="mt-3 text-body-md text-ink">
              <span className={`text-title-sm ${picked === item.answer ? "text-success" : "text-error"}`}>
                {picked === item.answer ? "正解です。" : "おしい。"}
              </span>{" "}
              {item.explain}
              <div className="mt-1 text-caption text-ink-muted">出典：{item.source}</div>
            </div>
          )}
        </>
      ) : (
        <>
          <h3 className="mt-3 text-title-md text-ink-strong">{item.title}</h3>
          <p className="mt-1.5 text-body-md text-ink">{item.body}</p>
          {item.kind === "fact" && <div className="mt-2 text-caption text-ink-muted">出典：{item.source}</div>}
        </>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={onNext}>
          {item.kind === "quiz" && !answered ? "スキップ" : "次へ"} →
        </Button>
      </div>
    </div>
  );
}
