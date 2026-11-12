"use client";

/**
 * Card frame around every replica (specs/landing-page §5): dashboard-card chrome, 「サンプル」 pill,
 * fixed aspect ratio (no layout shift) and aria-hidden content with a visually-hidden description.
 * The replica loops on its own while visible (see useStagePlayback).
 */

import type { ReactNode } from "react";
import { Badge } from "@/app/components/shared/Badge";
import type { Playback, StageFrame } from "./useStagePlayback";

export function Stage({
  frame,
  pb,
  description,
  sample = false,
  children,
  className = "",
  frameClassName = "aspect-[4/3] max-lg:aspect-[3/4] max-lg:max-h-[70vh]",
}: {
  frame: StageFrame;
  pb: Playback;
  /** one sentence for screen readers; the copy next to the stage explains the rest */
  description: string;
  sample?: boolean;
  children: ReactNode;
  className?: string;
  /** size of the card; the default keeps a fixed aspect ratio so there is no layout shift */
  frameClassName?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <div
        ref={frame}
        aria-hidden="true"
        className={`relative w-full overflow-hidden rounded-2xl border border-line-subtle bg-linear-to-br from-surface-hover to-surface ${frameClassName}`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(circle at top left, color-mix(in srgb, var(--color-secondary) 14%, transparent), transparent 60%)" }}
        />
        <div key={pb.runId} className="absolute inset-0">
          {children}
        </div>
        {sample && (
          <Badge className="absolute right-3 top-3 z-20">サンプル</Badge>
        )}
      </div>
      <p className="sr-only">{description}</p>
    </div>
  );
}
