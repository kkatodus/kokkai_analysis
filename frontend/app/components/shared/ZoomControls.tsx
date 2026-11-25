"use client";

import { IoAdd, IoRemove, IoScanOutline } from "react-icons/io5";
import { IconButton } from "./Button";
import { cx } from "./cx";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  className?: string;
}

/** Zoom buttons for a chart (DESIGN.md "Data Visualisation": zoom is by buttons, pinch, or Ctrl/⌘ + wheel). */
export function ZoomControls({ onZoomIn, onZoomOut, onReset, className }: ZoomControlsProps) {
  return (
    <div role="group" aria-label="ズーム" className={cx("absolute top-2 right-2 z-10 flex flex-col gap-1", className)}>
      <IconButton label="拡大" onClick={onZoomIn}>
        <IoAdd aria-hidden className="size-4" />
      </IconButton>
      <IconButton label="縮小" onClick={onZoomOut}>
        <IoRemove aria-hidden className="size-4" />
      </IconButton>
      <IconButton label="表示をリセット" onClick={onReset}>
        <IoScanOutline aria-hidden className="size-4" />
      </IconButton>
    </div>
  );
}
