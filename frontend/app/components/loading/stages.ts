/**
 * Progress stages (specs/dashboard-loading §5.2). Each one names a dataset that really is inside the
 * /app response, in the order page.tsx fetches them. The browser cannot observe server progress, so
 * the bar follows a time curve and only reaches 100 % on the real mount signal.
 * Counts are approximate words (約, 超) so they do not go stale.
 */

export type Stage = { label: string; short: string; caption: string; from: number; to: number; untilMs: number };

export const STAGES: Stage[] = [
  { label: "議員データを呼び出し中", short: "議員データ", caption: "衆参の現職・歴代議員の名簿と選挙区", from: 0, to: 25, untilMs: 1500 },
  { label: "立場推定の結果を展開中", short: "立場推定", caption: "12テーマ・約60論点、9万点超の推定位置", from: 25, to: 55, untilMs: 4000 },
  { label: "やり取りのAI判定を集計中", short: "AI判定の集計", caption: "2000年以降の委員会質疑につけたラベルの集計", from: 55, to: 80, untilMs: 6500 },
  { label: "地図とグラフを描画中", short: "地図とグラフ", caption: "選挙区ポリゴン、散布図、議席配分", from: 80, to: 95, untilMs: Infinity },
];

export const READY_LABEL = "準備ができました";
export const READY_CAPTION = "ダッシュボードを開けます";

/** Stage index and percent for `elapsed` ms since the boundary appeared (ease-out within a stage). */
export function progressAt(elapsed: number): { stage: number; pct: number } {
  let start = 0;
  for (let i = 0; i < STAGES.length; i++) {
    const s = STAGES[i];
    if (elapsed < s.untilMs) {
      if (!Number.isFinite(s.untilMs)) {
        // last stage: creep toward `to` without ever reaching it
        const k = 1 - Math.exp(-(elapsed - start) / 4000);
        return { stage: i, pct: s.from + (s.to - s.from) * k };
      }
      const t = (elapsed - start) / (s.untilMs - start);
      const eased = 1 - (1 - t) * (1 - t);
      return { stage: i, pct: s.from + (s.to - s.from) * eased };
    }
    start = s.untilMs;
  }
  const last = STAGES.length - 1;
  return { stage: last, pct: STAGES[last].to };
}
