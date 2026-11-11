import type { ReactNode } from "react";
import { cx } from "./cx";

// DESIGN.md "Loading, empty and error states": one component each, used in every card, panel and pane.

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none", className)}
    />
  );
}

/** Skeleton bars shaped like a list; `label` is read by screen readers. */
export function Loading({
  label = "読み込み中…",
  rows = 0,
  className,
}: {
  label?: string;
  /** Number of skeleton rows; 0 shows the spinner and label instead. */
  rows?: number;
  className?: string;
}) {
  if (rows > 0) {
    return (
      <div role="status" aria-busy="true" className={cx("flex flex-col gap-2", className)}>
        <span className="sr-only">{label}</span>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  return (
    <div role="status" aria-busy="true" className={cx("flex items-center justify-center gap-2 py-6 text-body-sm text-ink-muted", className)}>
      <Spinner />
      {label}
    </div>
  );
}

/** One sentence saying why it is empty, plus an optional next action. */
export function Empty({ message, action, className }: { message: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 py-6 text-center text-body-sm text-ink-muted", className)}>
      <p>{message}</p>
      {action}
    </div>
  );
}

/** A Japanese sentence about what failed and a 再試行 button. Never shows an exception message. */
export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cx("flex flex-col items-center justify-center gap-3 py-6 text-center text-body-sm text-ink", className)}>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="hit-target inline-flex h-7 items-center rounded-full border border-line bg-surface-raised px-3 text-label-md text-ink transition-colors hover:bg-surface-hover hover:text-ink-strong"
        >
          再試行
        </button>
      )}
    </div>
  );
}
