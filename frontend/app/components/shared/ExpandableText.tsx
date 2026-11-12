"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 6: "line-clamp-6" } as const;

/** Line clamp with a ghost 全文を表示 / 折りたたむ toggle, shown only when the text overflows. */
export function ExpandableText({ lines = 4, children, className }: { lines?: keyof typeof clamp; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <div className={className}>
      <div ref={ref} className={cx(!open && clamp[lines])}>
        {children}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-1 rounded-full px-1 text-label-sm text-link hover:underline"
        >
          {open ? "折りたたむ" : "全文を表示"}
        </button>
      )}
    </div>
  );
}
