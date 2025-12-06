"use client";

import { useRef, useEffect, useState, ReactNode } from "react";

interface ResizableContainerProps {
  left: ReactNode;
  right: ReactNode;
}

export function ResizableContainer({ left, right }: ResizableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const leftPane = leftRef.current;
    const rightPane = rightRef.current;
    if (!container || !leftPane || !rightPane) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const containerRect = container.getBoundingClientRect();
      const newLeftWidth = e.clientX - containerRect.left;
      const min = 250;
      const max = containerRect.width - 250;

      if (newLeftWidth > min && newLeftWidth < max) {
        leftPane.style.flexBasis = `${newLeftWidth}px`;
        rightPane.style.flexBasis = `${containerRect.width - newLeftWidth}px`;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div ref={containerRef} className="flex w-full gap-0">
      <div ref={leftRef} className="flex min-w-[300px] flex-col gap-4" style={{ flexBasis: "60%" }}>
        {left}
      </div>
      <div
        className="w-1.5 cursor-col-resize bg-slate-400/20 transition-colors hover:bg-slate-400/40 shrink-0 max-md:hidden"
        onMouseDown={() => setIsDragging(true)}
      />
      <div ref={rightRef} className="flex min-w-[260px] flex-col gap-4" style={{ flexBasis: "40%" }}>
        {right}
      </div>
    </div>
  );
}

