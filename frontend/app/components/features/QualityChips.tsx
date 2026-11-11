"use client";

import type { QualityContribution, QualityFunction, QualityIssue, QualityOutcome } from "@/app/types";
import { Badge, type BadgeTone } from "@/app/components/shared/Badge";
import {
  CONTRIBUTION_SHORT_JA,
  FUNCTION_JA,
  ISSUE_JA,
  OUTCOME_SHORT_JA,
  SIDE_JA,
  EXTENT_JA,
} from "@/app/lib/quality";

// DESIGN.md "Chips and badges": the labels are read-only status, so they are badges ("label：value").
// The quality scale uses the semantic tones: 成果あり → success, 限定的 → warning, 成果なし → error.
const CONTRIBUTION_TONE: Record<QualityContribution, BadgeTone> = {
  substantive: "success",
  limited: "warning",
  none: "error",
};

export function FunctionChip({ value, title, prefixed }: { value: QualityFunction; title?: string; prefixed?: boolean }) {
  return (
    <Badge tone="neutral" label={prefixed ? "種類" : undefined} title={title}>
      {FUNCTION_JA[value] ?? value}
    </Badge>
  );
}

export function ContributionChip({ value, title, prefixed }: { value: QualityContribution; title?: string; prefixed?: boolean }) {
  return (
    <Badge tone={CONTRIBUTION_TONE[value] ?? "neutral"} label={prefixed ? "成果" : undefined} title={title}>
      {CONTRIBUTION_SHORT_JA[value] ?? value}
    </Badge>
  );
}

export function IssueChip({ issue, prefixed }: { issue: QualityIssue; prefixed?: boolean }) {
  const by = issue.by === "answerer" ? "答弁" : issue.by === "both" ? "双方" : "";
  return (
    <Badge
      tone={issue.extent === "most" ? "error" : "warning"}
      label={prefixed ? "問題点" : undefined}
      title={`${SIDE_JA[issue.by] ?? issue.by}・やり取りの${EXTENT_JA[issue.extent] ?? issue.extent}`}
    >
      {ISSUE_JA[issue.type] ?? issue.type}
      {by ? <span className="ml-1 font-normal">（{by}）</span> : null}
    </Badge>
  );
}

export function OutcomeChip({ value, prefixed }: { value: QualityOutcome; prefixed?: boolean }) {
  return (
    <Badge tone="info" label={prefixed ? "成果の内訳" : undefined}>
      {OUTCOME_SHORT_JA[value] ?? value}
    </Badge>
  );
}

/** The full set of badges for one exchange label. */
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
  /** prefix each badge with its category (種類／成果／問題点） */
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
