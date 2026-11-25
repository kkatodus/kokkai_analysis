import { FACTS } from "./facts";
import { QUIZ } from "./quiz";
import { TIPS } from "./tips";
import type { LoadingCardItem } from "./types";

export type { LoadingCardItem, QuizCard, FactCard, TipCard } from "./types";

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Unseen first (in random order), then the seen ones, oldest-seen first. */
export function order<T extends { id: string }>(xs: T[], seen: string[]): T[] {
  const seenIdx = new Map(seen.map((id, i) => [id, i]));
  const fresh = shuffle(xs.filter((x) => !seenIdx.has(x.id)));
  const old = xs.filter((x) => seenIdx.has(x.id)).sort((a, b) => seenIdx.get(a.id)! - seenIdx.get(b.id)!);
  return [...fresh, ...old];
}

/** The deck for one load: a tip first, then quiz / fact / tip in rotation (§5.2). */
export function buildDeck(seen: string[]): LoadingCardItem[] {
  const tips = order(TIPS, seen);
  const quiz = order(QUIZ, seen);
  const facts = order(FACTS, seen);
  const deck: LoadingCardItem[] = [];
  if (tips.length) deck.push(tips.shift()!);
  while (quiz.length || facts.length || tips.length) {
    if (quiz.length) deck.push(quiz.shift()!);
    if (facts.length) deck.push(facts.shift()!);
    if (tips.length) deck.push(tips.shift()!);
  }
  return deck;
}

/**
 * Splice site-stats cards into a deck that is already being shown: right after the current card,
 * then every other slot, so the visitor meets them next without losing their place.
 */
export function mergeAfter(deck: LoadingCardItem[], current: number, extra: LoadingCardItem[]): LoadingCardItem[] {
  if (!extra.length) return deck;
  const have = new Set(deck.map((c) => c.id));
  const add = extra.filter((c) => !have.has(c.id));
  const head = deck.slice(0, current + 1);
  const tail = deck.slice(current + 1);
  const out = [...head];
  while (add.length || tail.length) {
    if (add.length) out.push(add.shift()!);
    if (tail.length) out.push(tail.shift()!);
  }
  return out;
}

