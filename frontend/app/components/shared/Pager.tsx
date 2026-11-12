import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { cx } from "./cx";
import { IconButton } from "./Button";

// DESIGN.md "Lists and pagers": icon buttons 前へ / 次へ around "1 / 1,248 ページ", below the list.
export function Pager({
  page,
  pageCount,
  onChange,
  busy = false,
  className,
}: {
  /** 1-based. */
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  busy?: boolean;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="ページ送り" className={cx("flex items-center justify-center gap-3", className)}>
      <IconButton label="前のページ" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>
        <IoChevronBack className="size-4" />
      </IconButton>
      <span className="text-data text-ink-muted" aria-live="polite">
        {page.toLocaleString("ja-JP")} / {pageCount.toLocaleString("ja-JP")} ページ
      </span>
      <IconButton label="次のページ" disabled={busy || page >= pageCount} onClick={() => onChange(page + 1)}>
        <IoChevronForward className="size-4" />
      </IconButton>
    </nav>
  );
}
