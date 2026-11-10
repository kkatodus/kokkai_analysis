"use client";

/**
 * The feature tour: one sticky panel that walks through every chapter in `chapters.ts`.
 * Scrolling through the tall section advances the chapter (the panel stays pinned); a rail with
 * labelled markers shows where the reader is and jumps on click; 「最初から再生」 scrolls through
 * every chapter automatically, stopping as soon as the reader scrolls themselves.
 */

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa6";
import { CHAPTERS } from "./chapters";
import { Stage } from "./Stage";
import { track } from "./track";
import { useStagePlayback } from "./useStagePlayback";

const N = CHAPTERS.length;
const READING_MS = 1800;

function ChapterStage({ index }: { index: number }) {
  const ch = CHAPTERS[index];
  const [frame, pb] = useStagePlayback(ch.durationMs, { threshold: 0.2 });
  const { Component } = ch;
  return (
    <Stage
      frame={frame}
      pb={pb}
      section={ch.id}
      description={ch.description}
      sample
      className="flex h-full flex-col"
      frameClassName="min-h-0 flex-1 lg:aspect-[4/3] lg:max-h-[calc(100svh-13rem)] lg:flex-none"
    >
      <Component pb={pb} frame={frame} />
    </Stage>
  );
}

export function FeatureTour() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [chapter, setChapter] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const timer = useRef<number | null>(null);
  const seen = useRef<Set<number>>(new Set());

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setChapter(Math.min(N - 1, Math.max(0, Math.floor(v * N))));
  });

  useEffect(() => {
    if (seen.current.has(chapter)) return;
    seen.current.add(chapter);
    track("LandingSectionView", { section: CHAPTERS[chapter].id });
  }, [chapter]);

  const scrollToChapter = useCallback((i: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const range = el.offsetHeight - window.innerHeight;
    // the middle of chapter i's band, so small scroll nudges do not flip the chapter
    window.scrollTo({ top: Math.round(top + (range * (i + 0.5)) / N), behavior: "smooth" });
  }, []);

  const stopAll = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setPlayingAll(false);
  }, []);

  const playAll = useCallback(() => {
    track("LandingReplay", { section: "tour" });
    setPlayingAll(true);
    let i = 0;
    scrollToChapter(0);
    const next = () => {
      if (i >= N - 1) {
        stopAll();
        return;
      }
      i += 1;
      scrollToChapter(i);
      timer.current = window.setTimeout(next, CHAPTERS[i].durationMs + READING_MS);
    };
    timer.current = window.setTimeout(next, CHAPTERS[0].durationMs + READING_MS);
  }, [scrollToChapter, stopAll]);

  // the reader taking over (wheel, touch, keyboard) ends autoplay
  useEffect(() => {
    if (!playingAll) return;
    const cancel = () => stopAll();
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    window.addEventListener("keydown", cancel);
    return () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
    };
  }, [playingAll, stopAll]);

  useEffect(() => () => stopAll(), [stopAll]);

  const ch = CHAPTERS[chapter];
  const playButton = (
    <button
      type="button"
      onClick={playingAll ? stopAll : playAll}
      className="flex items-center gap-1.5 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/45 hover:bg-cyan-500/20"
    >
      {playingAll ? <FaStop className="h-2.5 w-2.5" /> : <FaPlay className="h-2.5 w-2.5" />}
      {playingAll ? "停止" : "最初から再生"}
    </button>
  );

  return (
    <section ref={sectionRef} id="tour" className="relative scroll-mt-16" style={{ height: `${N * 100}svh` }} aria-label="機能ツアー">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden px-4 py-3 lg:py-6">
        {/* phone rail: horizontal markers + progress */}
        <div className="mx-auto w-full max-w-6xl lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <ol className="flex flex-1 items-center justify-between">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => scrollToChapter(i)}
                    aria-current={i === chapter ? "step" : undefined}
                    className={`flex flex-col items-center gap-1 px-1 text-[11px] transition-colors ${i === chapter ? "text-cyan-100" : i < chapter ? "text-gray-300" : "text-gray-500"}`}
                  >
                    <span className={`h-2 w-2 rounded-full transition-all ${i === chapter ? "scale-125 bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" : i < chapter ? "bg-cyan-500/60" : "bg-slate-600"}`} />
                    {c.short}
                  </button>
                </li>
              ))}
            </ol>
            {playButton}
          </div>
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-slate-800">
            <motion.div className="h-full w-full origin-left bg-linear-to-r from-cyan-400 to-indigo-500" style={{ scaleX: scrollYProgress }} />
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-10">
          {/* desktop rail: vertical markers + progress */}
          <div className="hidden w-36 shrink-0 self-stretch flex-col justify-center lg:flex">
            <div className="text-[11px] font-semibold tracking-[0.2em] text-gray-500">機能ツアー</div>
            <div className="relative mt-4 flex">
              <div className="relative mr-3 w-0.5 self-stretch overflow-hidden rounded-full bg-slate-800">
                <motion.div className="absolute inset-0 origin-top bg-linear-to-b from-cyan-400 to-indigo-500" style={{ scaleY: scrollYProgress }} />
              </div>
              <ol className="flex flex-col gap-5">
                {CHAPTERS.map((c, i) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => scrollToChapter(i)}
                      aria-current={i === chapter ? "step" : undefined}
                      className={`group flex items-center gap-2 text-left text-sm transition-colors ${i === chapter ? "text-cyan-100" : i < chapter ? "text-gray-300 hover:text-gray-100" : "text-gray-500 hover:text-gray-300"}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full transition-all ${i === chapter ? "scale-125 bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.8)]" : i < chapter ? "bg-cyan-500/60" : "bg-slate-600 group-hover:bg-slate-400"}`} />
                      {c.short}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-6">{playButton}</div>
          </div>

          {/* stage */}
          <div className="order-1 min-h-0 flex-1 lg:order-2 lg:flex-[7]">
            <ChapterStage key={chapter} index={chapter} />
          </div>

          {/* copy */}
          <div className="order-2 shrink-0 lg:order-1 lg:flex-[4]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={ch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                <div className="text-[11px] font-semibold tracking-[0.2em] text-gray-500 lg:hidden">
                  {chapter + 1} / {N}
                </div>
                <h2 className="mt-1 text-xl font-semibold leading-snug text-gray-50 sm:text-2xl lg:mt-0 lg:text-3xl">{ch.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-300 max-lg:line-clamp-4 lg:mt-4 lg:text-base">{ch.body}</p>
                {ch.caption && <p className="mt-2 text-xs text-gray-400 lg:mt-3 lg:text-sm">{ch.caption}</p>}
                {ch.note && <p className="mt-1 hidden text-sm text-gray-500 lg:block">{ch.note}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
