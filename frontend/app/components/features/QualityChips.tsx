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

export function FunctionChip({ value, title }: { value: QualityFunction; title?: string }) {
  return (
    <span className={BASE + FUNCTION_STYLE[value].chip} title={title}>
      {FUNCTION_JA[value] ?? value}
    </span>
  );
}

export function ContributionChip({ value, title }: { value: QualityContribution; title?: string }) {
  return (
    <span className={BASE + CONTRIBUTION_STYLE[value].chip} title={title}>
      {CONTRIBUTION_SHORT_JA[value] ?? value}
    </span>
  );
}

export function IssueChip({ issue }: { issue: QualityIssue }) {
  const cls = issue.extent === "most" ? ISSUE_CHIP : ISSUE_CHIP_PART;
  return (
    <span className={BASE + cls} title={`${SIDE_JA[issue.by] ?? issue.by}・やり取りの${EXTENT_JA[issue.extent] ?? issue.extent}`}>
      {ISSUE_JA[issue.type] ?? issue.type}
      <span className="ml-1 font-normal opacity-80">{issue.by === "answerer" ? "答弁" : issue.by === "both" ? "双方" : ""}</span>
    </span>
  );
}

export function OutcomeChip({ value }: { value: QualityOutcome }) {
  return <span className={BASE + OUTCOME_CHIP}>{OUTCOME_SHORT_JA[value] ?? value}</span>;
}

/** The full set of chips for one exchange label. */
export function ExchangeChips({
  fn,
  contribution,
  issues,
  outcomes,
  compact = false,
}: {
  fn: QualityFunction;
  contribution: QualityContribution;
  issues: QualityIssue[];
  outcomes: QualityOutcome[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <FunctionChip value={fn} />
      <ContributionChip value={contribution} />
      {(issues ?? []).map((i, k) => (
        <IssueChip key={`${i.type}-${i.by}-${k}`} issue={i} />
      ))}
      {!compact && (outcomes ?? []).map((o) => <OutcomeChip key={o} value={o} />)}
    </div>
  );
}
