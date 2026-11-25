"use client";

/**
 * Visibility-driven loop for the landing-page stages (specs/landing-page §6).
 *
 * While the frame is visible: playing → (duration) → idle-after → (LOOP_PAUSE_MS) → playing → …
 * Leaving the viewport stops the loop and shows the final frame; coming back starts a fresh play. The first stage is
 * on screen at load, so it starts without any scroll. Reduced motion never plays; stages then render their final
 * frame, which is also the SSR output.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

export type PlaybackState = "idle-before" | "playing" | "idle-after";

export type StageFrame = RefObject<HTMLDivElement | null>;

/** hold on the final frame (idle loops run) before the next play starts */
const LOOP_PAUSE_MS = 2500;

export interface Playback {
  state: PlaybackState;
  /** increments on every play so stage content can remount with `key={runId}` */
  runId: number;
  playing: boolean;
  /** a play has finished and the next one has not started; idle loops may run */
  idle: boolean;
  reduced: boolean;
  /** the stage has reached the visibility threshold at least once */
  seen: boolean;
  replay: () => void;
}

export function useStagePlayback(
  durationMs: number,
  { threshold = 0, onSeen }: { threshold?: number; onSeen?: () => void } = {}
): [StageFrame, Playback] {
  const frame = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion() ?? false;
  const [state, setState] = useState<PlaybackState>("idle-before");
  const [runId, setRunId] = useState(0);
  const [seen, setSeen] = useState(false);
  const seenRef = useRef(false);
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });

  const play = useCallback(() => {
    setRunId((r) => r + 1);
    setState("playing");
  }, []);

  // visible: start a fresh play; hidden: drop to the final frame. The observer reports the frame's state as soon as
  // it starts observing, so a stage already on screen at load plays without any scroll.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        const visible = e.isIntersecting && e.intersectionRatio >= threshold;
        if (visible) {
          if (!seenRef.current) {
            seenRef.current = true;
            setSeen(true);
            onSeenRef.current?.();
          }
          if (!reduced) play();
        } else {
          setState("idle-before");
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, threshold, play]);

  // playing → rest on the final frame → play again; leaving the viewport resets to idle-before, which stops this
  useEffect(() => {
    if (state === "idle-before") return;
    const t = window.setTimeout(() => (state === "playing" ? setState("idle-after") : play()), state === "playing" ? durationMs : LOOP_PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [state, runId, durationMs, play]);

  // the frame ref is returned apart from the playback object so components can read `pb.*` freely during render
  return [frame, { state, runId, playing: state === "playing", idle: state === "idle-after", reduced, seen, replay: play }];
}

/**
 * Number of beats (seconds since play began) that have elapsed. While not playing the stage shows its final frame,
 * so the step is `times.length`; a new play resets to 0 and schedules every beat.
 */
export function useTimeline(times: readonly number[], pb: Pick<Playback, "playing" | "runId">): number {
  const [step, setStep] = useState(times.length);
  const n = times.length;
  useEffect(() => {
    if (!pb.playing) {
      setStep(n);
      return;
    }
    setStep(0);
    const ids = times.map((t, i) => window.setTimeout(() => setStep(i + 1), Math.round(t * 1000)));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // `times` is a module constant per stage; keying on its length keeps the effect stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb.playing, pb.runId, n]);
  return step;
}

/** Runs `onTick` every `periodMs` while the stage rests between plays (never under reduced motion). */
export function useIdleTick(pb: Pick<Playback, "idle" | "reduced">, periodMs: number, onTick: () => void): void {
  const cb = useRef(onTick);
  useEffect(() => {
    cb.current = onTick;
  });
  useEffect(() => {
    if (!pb.idle || pb.reduced) return;
    const id = window.setInterval(() => cb.current(), periodMs);
    return () => window.clearInterval(id);
  }, [pb.idle, pb.reduced, periodMs]);
}
