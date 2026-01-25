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
    <div className="flex flex-col items-center gap-2">
      {label ? <div className="text-[11px] font-semibold text-gray-200">{label}</div> : null}

      <div
        ref={discRef}
        className="relative touch-none select-none"
        style={{ width: `${size}px`, height: `${size}px` }}
        role="slider"
        aria-label={label ?? "Issue dial selector"}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, count - 1)}
        aria-valuenow={clamp(selectedIndex, 0, Math.max(0, count - 1))}
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
        <svg width={size} height={size} className="block">
          {/* Base disc */}
          <circle cx={cx} cy={cy} r={rOuter} fill="rgba(2,6,23,0.55)" stroke="rgba(148,163,184,0.25)" />
          <circle cx={cx} cy={cy} r={rInner} fill="rgba(2,6,23,0.9)" stroke="rgba(148,163,184,0.12)" />

          {/* Colored segments (ring) */}
          {segments?.map((seg, i) => {
            if (count <= 0) return null;
            const startT = seg.startIndex / count;
            const endT = seg.endIndex / count;
            let startA = startT * Math.PI * 2;
            let endA = endT * Math.PI * 2;
            // Avoid SVG "full circle" arc edge case when endA==2π.
            if (seg.endIndex === count) endA = Math.PI * 2 - 1e-4;
            if (endA <= startA) return null;
            return (
              <path
                key={i}
                d={arcPath(cx, cy, rRing, startA, endA)}
                stroke={seg.ringCss}
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
                stroke="rgba(148,163,184,0.25)"
                strokeWidth={1}
              />
            );
          })}

          {/* Handle + glow */}
          <circle cx={hx} cy={hy} r={handleR + 7} fill="rgba(34,211,238,0.12)" />
          <circle cx={hx} cy={hy} r={handleR + 2} fill="rgba(34,211,238,0.25)" />
          <circle cx={hx} cy={hy} r={handleR} fill="rgba(34,211,238,0.95)" />

          {/* Center label */}
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontSize="12"
            fill="rgba(226,232,240,0.85)"
            fontWeight={700}
          >
            {count ? `${selectedIndex + 1}/${count}` : "—"}
          </text>
        </svg>

        {/* hover glow */}
        <div className="pointer-events-none absolute inset-0 rounded-full opacity-0 ring-1 ring-cyan-400/30 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="text-[10px] text-gray-400">ドラッグで発言を選択</div>
    </div>
  );
}

