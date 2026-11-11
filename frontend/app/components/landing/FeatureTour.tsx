"use client";

/**
 * The first screen and the feature tour in one pinned panel (specs/landing-page §5.9).
 * Top band: the hero message and CTAs. Below: a rail with one marker per chapter, the chapter's copy and its
 * animated replica. Scrolling through the tall section advances the chapter while the panel stays pinned;
 * markers jump to a chapter; 「最初から再生」 autoplays through every chapter and stops as soon as the reader
 * scrolls; a chevron prompts the first scroll.
 */

import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FaPlay, FaStop } from "react-icons/fa6";
import { FiChevronDown } from "react-icons/fi";
import { Button, ButtonLink, buttonClass } from "@/app/components/shared/Button";
import { cx } from "@/app/components/shared/cx";
import { CHAPTERS } from "./chapters";
import { Stage } from "./Stage";
import { LinkPending } from "./LinkPending";
import { track } from "./track";
import { useStagePlayback } from "./useStagePlayback";

const N = CHAPTERS.length;
const READING_MS = 1800;

function ChapterStage({ index }: { index: number }) {
  const ch = CHAPTERS[index];
  const [frame, pb] = useStagePlayback(ch.durationMs);
  const { Component } = ch;
  return (
    <Stage
      frame={frame}
      pb={pb}
      description={ch.description}
      sample
      className="flex h-full flex-col"
      frameClassName="max-lg:h-[44svh] lg:min-h-0 lg:flex-1 lg:aspect-[4/3] lg:max-h-[calc(100svh-22rem)] lg:flex-none"
    >
      <Component pb={pb} frame={frame} />
    </Stage>
  );
}

function Marker({ index, chapter, onClick, size }: { index: number; chapter: number; onClick: () => void; size: "sm" | "md" }) {
  const c = CHAPTERS[index];
  const active = index === chapter;
  const done = index < chapter;
  const dot = cx("size-2 shrink-0 rounded-full transition-all", active ? "scale-125 bg-primary" : done ? "bg-primary-line" : "bg-line-strong group-hover:bg-ink-muted");
  const text = active ? "text-on-primary-soft" : done ? "text-ink hover:text-ink-strong" : "text-ink-muted hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      className={cx("hit-target group rounded-full transition-colors duration-150", text, size === "sm" ? "flex flex-col items-center gap-1 px-1 text-caption" : "flex items-center gap-2 text-left text-body-md")}
    >
      <span className={dot} />
      {c.short}
    </button>
  );
}

export function FeatureTour() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [chapter, setChapter] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const timer = useRef<number | null>(null);
  const seen = useRef<Set<number>>(new Set());
  const reduced = useReducedMotion();

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
    <Button
      size="sm"
      onClick={playingAll ? stopAll : playAll}
      icon={playingAll ? <FaStop aria-hidden className="size-2.5" /> : <FaPlay aria-hidden className="size-2.5" />}
    >
      {playingAll ? "停止" : "最初から再生"}
    </Button>
  );

  return (
    <section ref={sectionRef} id="tour" className="relative scroll-mt-16" style={{ height: `${N * 100}svh` }} aria-label="機能ツアー">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col overflow-hidden">
        <div aria-hidden="true" className="landing-drift pointer-events-none absolute inset-0" />

        {/* messaging band */}
        <div className="relative mx-auto w-full max-w-6xl px-4 pt-4 lg:pt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div>
              <h1 className="text-headline-md text-ink-strong md:text-display">その議員、国会で何してる？</h1>
              <p className="mt-1.5 text-body-md text-ink sm:text-body-lg lg:mt-3">
                国会の会議録をAIで読み解いて、議員ごとの発言・やり取り・立場を見られるサイトです。
              </p>
            </div>
            <div className="flex shrink-0 gap-2 sm:gap-3">
              <ButtonLink
                href="/app"
                variant="primary"
                size="lg"
                onClick={() => track("LandingCTA", { cta: "open_app", location: "hero" })}
                className="flex-1 max-sm:px-3 sm:flex-none"
              >
                <LinkPending>ダッシュボードを開く</LinkPending>
              </ButtonLink>
              <ButtonLink
                href="/app?tour=1"
                variant="secondary"
                size="lg"
                onClick={() => track("LandingCTA", { cta: "tour", location: "hero" })}
                className="flex-1 max-sm:px-3 sm:flex-none"
              >
                <LinkPending>使い方を見ながら試す</LinkPending>
              </ButtonLink>
            </div>
          </div>
        </div>

        {/* phone rail: horizontal markers + progress */}
        <div className="relative mx-auto mt-3 w-full max-w-6xl px-4 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <ol className="flex flex-1 items-center justify-between">
              {CHAPTERS.map((c, i) => (
                <li key={c.id}>
                  <Marker index={i} chapter={chapter} onClick={() => scrollToChapter(i)} size="sm" />
                </li>
              ))}
            </ol>
            {playButton}
          </div>
          <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-surface-hover">
            <motion.div className="h-full w-full origin-left bg-linear-to-r from-primary to-secondary" style={{ scaleX: scrollYProgress }} />
          </div>
        </div>

        {/* tour */}
        <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-4 pb-3 pt-3 lg:flex-row lg:items-center lg:gap-10 lg:pb-6 lg:pt-6">
          {/* desktop rail: vertical markers + progress */}
          <div className="hidden w-32 shrink-0 flex-col self-center lg:flex">
            <div className="text-label-sm text-ink-muted">機能ツアー</div>
            <div className="relative mt-3 flex">
              <div className="relative mr-3 w-0.5 self-stretch overflow-hidden rounded-full bg-surface-hover">
                <motion.div className="absolute inset-0 origin-top bg-linear-to-b from-primary to-secondary" style={{ scaleY: scrollYProgress }} />
              </div>
              <ol className="flex flex-col gap-4">
                {CHAPTERS.map((c, i) => (
                  <li key={c.id}>
                    <Marker index={i} chapter={chapter} onClick={() => scrollToChapter(i)} size="md" />
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-5">{playButton}</div>
          </div>

          {/* stage */}
          <div className="order-1 max-lg:flex-none lg:order-2 lg:min-h-0 lg:flex-[7]">
            <ChapterStage key={chapter} index={chapter} />
          </div>

          {/* chapter copy */}
          <div className="order-2 shrink-0 pb-10 lg:order-1 lg:flex-[4] lg:pb-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={ch.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                <div className="text-data text-ink-muted">
                  {chapter + 1} / {N}
                </div>
                <h2 className="mt-1 text-headline-sm text-ink-strong lg:text-headline-lg">{ch.title}</h2>
                <p className="mt-1.5 text-body-md text-ink max-lg:line-clamp-3 lg:mt-3 lg:text-body-lg">{ch.body}</p>
                {ch.caption && <p className="mt-2 hidden text-body-md text-ink-muted lg:block">{ch.caption}</p>}
                {ch.note && <p className="mt-1 hidden text-body-md text-ink-muted lg:block">{ch.note}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* scroll prompt, only while on the first chapter */}
        <AnimatePresence>
          {chapter === 0 && (
            <motion.button
              type="button"
              key="scroll-prompt"
              onClick={() => {
                track("LandingCTA", { cta: "scroll", location: "hero" });
                scrollToChapter(1);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={buttonClass("secondary", "sm", "absolute bottom-2 left-1/2 -translate-x-1/2 gap-2 lg:bottom-4")}
            >
              スクロールして機能を見る
              <motion.span animate={reduced ? undefined : { y: [0, 4, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} className="flex">
                <FiChevronDown aria-hidden className="size-4" />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
