"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { IoClose } from "react-icons/io5";
import { cx } from "./cx";
import { IconButton } from "./Button";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Moves focus into `ref` on mount and back to the previously focused element on unmount. */
export function useFocusOnOpen(ref: React.RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el;
    first?.focus({ preventScroll: true });
    return () => {
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}

function trapTab(e: KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (e.key !== "Tab" || !root) return;
  const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * DESIGN.md "Modal": centred, at most 560px, scrim behind; role="dialog", aria-modal, focus trapped,
 * Esc and scrim click close it. Opens only in response to a user action.
 */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  width = "md",
  className,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusOnOpen(ref);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-scrim p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
          trapTab(e, ref.current);
        }}
        className={cx(
          "flex max-h-[min(90dvh,48rem)] w-full flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface text-ink shadow-2xl",
          width === "md" ? "max-w-[35rem]" : "max-w-[48rem]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-headline-sm text-ink-strong">
            {title}
          </h2>
          <IconButton label="閉じる" onClick={onClose}>
            <IoClose className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-subtle px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * DESIGN.md "Side pane": fixed right (or left) from md up, bottom sheet below md. A non-modal dialog
 * labelled by its heading; focus moves in on open and back on close; Esc closes; 閉じる button.
 */
export function SidePane({
  side = "right",
  width,
  onClose,
  labelledBy,
  onResizeStart,
  resizeLabel = "パネルの幅を変える",
  children,
  className,
  ...rest
}: {
  side?: "left" | "right";
  /** Width in px from md up. */
  width: number;
  onClose: () => void;
  /** id of the heading that names the pane. */
  labelledBy: string;
  /** Pointer-down handler for the resize handle; omit for a fixed width. */
  onResizeStart?: (e: React.PointerEvent<HTMLDivElement>) => void;
  resizeLabel?: string;
  children: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusOnOpen(ref);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.stopPropagation();
          onClose();
        }
      }}
      style={{ "--pane-w": `${width}px` } as React.CSSProperties}
      className={cx(
        "fixed z-(--z-pane) flex flex-col overflow-hidden border border-line-strong bg-surface text-ink shadow-2xl",
        "inset-x-0 bottom-0 h-[70dvh] rounded-t-2xl",
        "md:inset-y-4 md:h-auto md:w-(--pane-w) md:max-w-[calc(100%-2rem)] md:rounded-2xl",
        side === "right" ? "md:right-4 md:left-auto" : "md:right-auto md:left-4",
        className,
      )}
      {...rest}
    >
      {onResizeStart && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={resizeLabel}
          onPointerDown={onResizeStart}
          className={cx(
            "absolute inset-y-4 z-10 hidden w-2 cursor-ew-resize hover:bg-surface-hover md:block",
            side === "right" ? "left-0 rounded-l-2xl" : "right-0 rounded-r-2xl",
          )}
        />
      )}
      <IconButton label="閉じる" onClick={onClose} className="absolute top-3 right-3 z-10">
        <IoClose className="size-4" />
      </IconButton>
      {children}
    </div>
  );
}
