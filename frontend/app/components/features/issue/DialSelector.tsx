"use client";

import { useEffect, useMemo, useRef } from "react";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function angleToIndex(angleRad: number, count: number): number {
  // angleRad is normalized to [0, 2π), where 0 is at 12 o'clock, increasing clockwise.
  if (count <= 1) return 0;
  const t = angleRad / (Math.PI * 2); // 0..1
  // Use floor for stable snapping while dragging (avoids boundary jitter from rounding).
  return clamp(Math.floor(t * count), 0, count - 1);
}

function indexToAngle(index: number, count: number): number {
  if (count <= 1) return 0;
  const t = clamp(index, 0, count - 1) / (count - 1); // 0..1
  return t * Math.PI * 2;
}

function arcPath(cx: number, cy: number, r: number, startRad: number, endRad: number): string {
  // 0 at 12 o'clock, increasing clockwise.
  const sx = cx + r * Math.sin(startRad);
  const sy = cy - r * Math.cos(startRad);
  const ex = cx + r * Math.sin(endRad);
  const ey = cy - r * Math.cos(endRad);
  const delta = (endRad - startRad + Math.PI * 2) % (Math.PI * 2);
  const largeArc = delta > Math.PI ? 1 : 0;
  const sweep = 1; // clockwise with our sin/cos mapping
  return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweep} ${ex} ${ey}`;
}

function pointerToAngleRad(e: PointerEvent, el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = e.clientX - cx;
  const dy = e.clientY - cy;
  // atan2: 0 at +x, CCW; rotate so 0 is at -y (12 o'clock).
  // After rotation, increasing angle corresponds to moving clockwise on screen.
  const raw = Math.atan2(dy, dx); // [-π, π]
  const rotated = raw + Math.PI / 2;
  return (rotated + Math.PI * 2) % (Math.PI * 2);
}

export function DialSelector({
  count,
  selectedIndex,
  onChangeIndex,
  label,
  segments,
}: {
  count: number;
  selectedIndex: number;
  onChangeIndex: (nextIndex: number) => void;
  label?: string;
  segments?: Array<{ startIndex: number; endIndex: number; ringCss: string }>;
}) {
  const discRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const angle = useMemo(() => indexToAngle(selectedIndex, count), [selectedIndex, count]);

  useEffect(() => {
    const el = discRef.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      draggingRef.current = true;
      // Capture pointer on the disc element for consistent drag even when leaving its bounds.
      el.setPointerCapture(e.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      const a = pointerToAngleRad(e, el);
      onChangeIndex(angleToIndex(a, count));
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const a = pointerToAngleRad(e, el);
      onChangeIndex(angleToIndex(a, count));
    };

    const onPointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [count, onChangeIndex]);

  const size = 180;
  const rOuter = 74;
  const rInner = 50;
  const rRing = (rOuter + rInner) / 2;
  const ringWidth = rOuter - rInner;
  const cx = size / 2;
  const cy = size / 2;
  const handleR = 6;
  const hx = cx + rOuter * Math.sin(angle);
  const hy = cy - rOuter * Math.cos(angle);

  return (
    // Stacked above the list (narrow pane, bottom sheet) the dial shrinks and its label and hint sit beside it,
    // so the speech list keeps most of the height; from @xl it is a full-size column next to the list.
    <div className="flex items-center gap-3 @xl:flex-col @xl:gap-2">
      <div
        ref={discRef}
        className="relative size-30 shrink-0 touch-none select-none rounded-full @xl:order-2 @xl:size-45"
        role="slider"
        aria-label={label ?? "発言ダイアル"}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={clamp(selectedIndex, 0, Math.max(0, count - 1))}
        aria-valuetext={count ? `${clamp(selectedIndex, 0, count - 1) + 1}番目の発言（全${count.toLocaleString("ja-JP")}件）` : "発言なし"}
        tabIndex={0}
        onKeyDown={(e) => {
          if (count <= 1) return;
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChangeIndex(clamp(selectedIndex - 1, 0, count - 1));
          }
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChangeIndex(clamp(selectedIndex + 1, 0, count - 1));
          }
        }}
      >
        <svg viewBox={`0 0 ${size} ${size}`} className="block size-full" aria-hidden>
          {/* Base disc */}
          <circle cx={cx} cy={cy} r={rOuter} className="fill-surface-raised stroke-line" />
          <circle cx={cx} cy={cy} r={rInner} className="fill-surface stroke-line-subtle" />

          {/* Colored segments (ring) */}
          {segments?.map((seg, i) => {
            if (count <= 0) return null;
            const startT = seg.startIndex / count;
            const endT = seg.endIndex / count;
            const startA = startT * Math.PI * 2;
            let endA = endT * Math.PI * 2;
            // Avoid SVG "full circle" arc edge case when endA==2π.
            if (seg.endIndex === count) endA = Math.PI * 2 - 1e-4;
            if (endA <= startA) return null;
            return (
              <path
                key={i}
                d={arcPath(cx, cy, rRing, startA, endA)}
                style={{ stroke: seg.ringCss }}
                strokeOpacity={0.6}
                strokeWidth={ringWidth}
                strokeLinecap="butt"
                fill="none"
              />
            );
          })}

          {/* Ticks */}
          {Array.from({ length: Math.min(60, Math.max(0, count)) }).map((_, i) => {
            const t = count <= 1 ? 0 : i / (Math.min(60, count) - 1);
            const a = t * Math.PI * 2;
            const x1 = cx + (rOuter - 8) * Math.sin(a);
            const y1 = cy - (rOuter - 8) * Math.cos(a);
            const x2 = cx + (rOuter - 2) * Math.sin(a);
            const y2 = cy - (rOuter - 2) * Math.cos(a);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className="stroke-line-strong"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            );
          })}

          {/* Handle + glow */}
          <circle cx={hx} cy={hy} r={handleR + 7} className="fill-primary" fillOpacity={0.12} />
          <circle cx={hx} cy={hy} r={handleR + 2} className="fill-primary" fillOpacity={0.25} />
          <circle cx={hx} cy={hy} r={handleR} className="fill-primary" />
        </svg>
        {/* centre label in HTML so it stays at 12px whatever size the disc is drawn at */}
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center text-data font-semibold text-ink tabular-nums">
          {count ? `${selectedIndex + 1}/${count}` : "—"}
        </div>
      </div>

      <div className="flex flex-col gap-1 @xl:contents">
        {label ? <div className="text-label-sm text-ink @xl:order-1">{label}</div> : null}
        <div className="text-caption text-ink-muted @xl:order-3">ドラッグで発言を選択</div>
      </div>
    </div>
  );
}

