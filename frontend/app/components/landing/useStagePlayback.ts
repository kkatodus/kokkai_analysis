"use client";

/**
 * Play-once / idle / replay state machine for the landing-page stages (specs/landing-page §6).
 *
 * idle-before → (40 % visible) → playing → (duration) → idle-after → replay() → playing
 * Reduced motion never leaves idle-before; stages then render their final frame, which is also the SSR output.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

export type PlaybackState = "idle-before" | "playing" | "idle-after";

export type StageFrame = RefObject<HTMLDivElement | null>;

export interface Playback {
  state: PlaybackState;
  /** increments on every play so stage content can remount with `key={runId}` */
  runId: number;
  playing: boolean;
  /** the one-shot play has finished; idle loops may run */
  idle: boolean;
  reduced: boolean;
  /** the stage has reached the visibility threshold at least once */
  seen: boolean;
  replay: () => void;
}

export function useStagePlayback(
  durationMs: number,
  { threshold = 0.4, onSeen }: { threshold?: number; onSeen?: () => void } = {}
): [StageFrame, Playback] {
  const frame = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion() ?? false;
  const [state, setState] = useState<PlaybackState>("idle-before");
  const [runId, setRunId] = useState(0);
  const [seen, setSeen] = useState(false);
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });

  useEffect(() => {
    const el = frame.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setSeen(true);
        onSeenRef.current?.();
        if (!reduced) {
          setRunId((r) => r + 1);
          setState("playing");
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, seen, threshold]);

  useEffect(() => {
    if (state !== "playing") return;
    const t = window.setTimeout(() => setState("idle-after"), durationMs);
    return () => window.clearTimeout(t);
  }, [state, runId, durationMs]);

  const replay = useCallback(() => {
    setRunId((r) => r + 1);
    setState("playing");
  }, []);

  // the frame ref is returned apart from the playback object so components can read `pb.*` freely during render
  return [frame, { state, runId, playing: state === "playing", idle: state === "idle-after", reduced, seen, replay }];
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

/** Runs `onTick` every `periodMs` while the stage idles after its one-shot play (never under reduced motion). */
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
