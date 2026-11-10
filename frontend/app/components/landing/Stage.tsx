"use client";

/**
 * Card frame around every replica (specs/landing-page §5): dashboard-card chrome, 「サンプル」 pill,
 * fixed aspect ratio (no layout shift), aria-hidden content with a visually-hidden description,
 * and the 「もう一度見る」 replay button once the one-shot play has finished.
 */

import type { ReactNode } from "react";
import { FaRotateLeft } from "react-icons/fa6";
import type { Playback, StageFrame } from "./useStagePlayback";
import { track } from "./track";

export function Stage({
  frame,
  pb,
  section,
  description,
  sample = false,
  children,
  className = "",
}: {
  frame: StageFrame;
  pb: Playback;
  section: string;
  /** one sentence for screen readers; the copy next to the stage explains the rest */
  description: string;
  sample?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`w-full ${className}`}>
      <div
        ref={frame}
        aria-hidden="true"
        className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/5 bg-linear-to-br from-gray-800 to-[#020617] shadow-2xl max-lg:aspect-[3/4] max-lg:max-h-[70vh]"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: "radial-gradient(circle at top left, rgba(79,70,229,0.14), transparent 60%)" }}
        />
        <div key={pb.runId} className="absolute inset-0">
          {children}
        </div>
        {sample && (
          <span className="absolute right-3 top-3 z-20 rounded-full border border-slate-400/25 bg-[#020617]/70 px-1.5 py-0.5 text-[10px] text-gray-400">
            サンプル
          </span>
        )}
      </div>
      <p className="sr-only">{description}</p>
      <div className="mt-2 flex h-7 items-center justify-end">
        {!pb.reduced && pb.idle && (
          <button
            type="button"
            onClick={() => {
              track("LandingReplay", { section });
              pb.replay();
            }}
            className="flex items-center gap-1.5 rounded-full border border-slate-400/25 bg-slate-900/40 px-3 py-1 text-xs text-gray-300 transition hover:border-cyan-400/45 hover:text-cyan-50"
          >
            <FaRotateLeft className="h-3 w-3" />
            もう一度見る
          </button>
        )}
      </div>
    </div>
  );
}
