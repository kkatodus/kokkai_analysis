"use client";

import type { QualityContribution, QualityFunction, QualityIssue, QualityOutcome } from "@/app/types";
import {
  CONTRIBUTION_SHORT_JA,
  CONTRIBUTION_STYLE,
  FUNCTION_JA,
  FUNCTION_STYLE,
  ISSUE_CHIP,
  ISSUE_CHIP_PART,
  ISSUE_JA,
  OUTCOME_CHIP,
  OUTCOME_SHORT_JA,
  SIDE_JA,
  EXTENT_JA,
} from "@/app/lib/quality";

const BASE = "rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ";

/** "種類：" style prefix, shown where the chips appear without surrounding context (the 発言 tab). */
function Prefix({ text, show }: { text: string; show?: boolean }) {
  return show ? <span className="mr-0.5 font-normal opacity-75">{text}：</span> : null;
}

export function FunctionChip({ value, title, prefixed }: { value: QualityFunction; title?: string; prefixed?: boolean }) {
  return (
    <span className={BASE + FUNCTION_STYLE[value].chip} title={title}>
      <Prefix text="種類" show={prefixed} />
      {FUNCTION_JA[value] ?? value}
    </span>
  );
}

export function ContributionChip({ value, title, prefixed }: { value: QualityContribution; title?: string; prefixed?: boolean }) {
  return (
    <span className={BASE + CONTRIBUTION_STYLE[value].chip} title={title}>
      <Prefix text="成果" show={prefixed} />
      {CONTRIBUTION_SHORT_JA[value] ?? value}
    </span>
  );
}

export function IssueChip({ issue, prefixed }: { issue: QualityIssue; prefixed?: boolean }) {
  const cls = issue.extent === "most" ? ISSUE_CHIP : ISSUE_CHIP_PART;
  return (
    <span className={BASE + cls} title={`${SIDE_JA[issue.by] ?? issue.by}・やり取りの${EXTENT_JA[issue.extent] ?? issue.extent}`}>
      <Prefix text="問題点" show={prefixed} />
      {ISSUE_JA[issue.type] ?? issue.type}
      <span className="ml-1 font-normal opacity-80">{issue.by === "answerer" ? "答弁" : issue.by === "both" ? "双方" : ""}</span>
    </span>
  );
}

export function OutcomeChip({ value, prefixed }: { value: QualityOutcome; prefixed?: boolean }) {
  return (
    <span className={BASE + OUTCOME_CHIP}>
      <Prefix text="成果の内訳" show={prefixed} />
      {OUTCOME_SHORT_JA[value] ?? value}
    </span>
  );
}

/** The full set of chips for one exchange label. */
export function ExchangeChips({
  fn,
  contribution,
  issues,
  outcomes,
  compact = false,
  prefixed = false,
}: {
  fn: QualityFunction;
  contribution: QualityContribution;
  issues: QualityIssue[];
  outcomes: QualityOutcome[];
  compact?: boolean;
  /** prefix each chip with its category (種類／成果／問題点） */
  prefixed?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FunctionChip value={fn} prefixed={prefixed} />
      <ContributionChip value={contribution} prefixed={prefixed} />
      {(issues ?? []).map((i, k) => (
        <IssueChip key={`${i.type}-${i.by}-${k}`} issue={i} prefixed={prefixed} />
      ))}
      {!compact && (outcomes ?? []).map((o) => <OutcomeChip key={o} value={o} prefixed={prefixed} />)}
    </div>
  );
}
