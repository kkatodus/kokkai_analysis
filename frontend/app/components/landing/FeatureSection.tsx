"use client";

/**
 * One feature section (specs/landing-page §5): copy on one side, an animated replica in a Stage on the other,
 * alternating sides on desktop and stacked (copy first) on phones. Owns the stage's playback state.
 */

import type { ComponentType } from "react";
import { Stage } from "./Stage";
import { track } from "./track";
import { useStagePlayback, type Playback, type StageFrame } from "./useStagePlayback";
import { DETAIL_DURATION_MS, DetailPaneStage } from "./stages/DetailPaneStage";
import { ISSUE_DURATION_MS, IssuePaneStage } from "./stages/IssuePaneStage";
import { MAP_DURATION_MS, MapStage } from "./stages/MapStage";
import { RANKING_DURATION_MS, RankingStage } from "./stages/RankingStage";
import { SCATTER_DURATION_MS, ScatterStage } from "./stages/ScatterStage";

export type StageKey = "detail" | "issue" | "ranking" | "scatter" | "map";

const STAGES: Record<StageKey, { Component: ComponentType<{ pb: Playback; frame: StageFrame }>; duration: number; sample: boolean; description: string }> = {
  detail: { Component: DetailPaneStage, duration: DETAIL_DURATION_MS, sample: true, description: "議員の詳細パネルの例：トピックを選ぶと、ラベル付きの発言カードが並びます。" },
  issue: { Component: IssuePaneStage, duration: ISSUE_DURATION_MS, sample: true, description: "会議パネルの例：ダイヤルで発言を移動し、色の帯がやり取りの成果を示します。" },
  ranking: { Component: RankingStage, duration: RANKING_DURATION_MS, sample: true, description: "ランキングの例：指標を切り替えると議員の並びが変わり、件数の少ない人を除外できます。" },
  scatter: { Component: ScatterStage, duration: SCATTER_DURATION_MS, sample: true, description: "立場の散布図の例：1Dの軸から2Dの配置に切り替わり、点にカーソルを合わせると名前が出ます。" },
  map: { Component: MapStage, duration: MAP_DURATION_MS, sample: true, description: "地図の例：選挙区をクリックすると議員の一覧と選挙履歴が開き、比例にも切り替えられます。" },
};

export function FeatureSection({
  id,
  title,
  body,
  caption,
  note,
  stage,
  flip = false,
}: {
  id: string;
  title: string;
  body: string;
  caption?: string;
  /** one extra line under the caption, e.g. the 架空のデータ footnote on first use */
  note?: string;
  stage: StageKey;
  flip?: boolean;
}) {
  const def = STAGES[stage];
  const [frame, pb] = useStagePlayback(def.duration, { onSeen: () => track("LandingSectionView", { section: id }) });
  const { Component } = def;
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-14 sm:py-20 lg:py-24">
      <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
        <div className={`lg:col-span-5 ${flip ? "lg:order-last" : ""}`}>
          <h2 className="text-2xl font-semibold leading-snug text-gray-50 sm:text-3xl">{title}</h2>
          <p className="mt-4 text-base leading-relaxed text-gray-300">{body}</p>
          {caption && <p className="mt-3 text-sm text-gray-400">{caption}</p>}
          {note && <p className="mt-1 text-sm text-gray-500">{note}</p>}
        </div>
        <div className="lg:col-span-7">
          <Stage frame={frame} pb={pb} section={id} description={def.description} sample={def.sample}>
            <Component pb={pb} frame={frame} />
          </Stage>
        </div>
      </div>
    </section>
  );
}
