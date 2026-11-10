import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Popular-politician ranking backed by Upstash Redis (Vercel Marketplace).
 *
 * Storage model: one sorted set per ISO week, `popular:politicians:<YYYY>-W<ww>`,
 * member = person_id, score = number of search-panel selections. Reads union the
 * most recent weeks so the list reflects current interest rather than all-time totals.
 *
 * The feature degrades gracefully: when the Redis env vars are absent (e.g. local dev
 * without `vercel env pull`), writes are no-ops and reads return an empty list.
 */

const KEY_PREFIX = "popular:politicians:";
/** Weeks included in the ranking. */
const WINDOW_WEEKS = 4;
/** Each weekly set expires after this long (seconds). Generous so the window never loses data. */
const WEEK_TTL_SECONDS = 10 * 7 * 24 * 60 * 60;
export const MAX_TOP_N = 50;

const PERSON_ID_RE = /^\d{1,10}$/;

export function isValidPersonId(value: unknown): value is string {
  return typeof value === "string" && PERSON_ID_RE.test(value);
}

let cachedClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (cachedClient !== undefined) return cachedClient;
  // Vercel's Upstash integration injects `STORAGE_KV_*` (prefix chosen at install);
  // plain Upstash / older integrations use `UPSTASH_REDIS_REST_*` or `KV_REST_API_*`.
  const url =
    process.env.STORAGE_KV_REST_API_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.STORAGE_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  // Guard against placeholders such as "[SENSITIVE]" from `vercel env pull`, or a malformed URL;
  // the client constructor throws on those and we must never take the page down for a nicety.
  if (!url || !token || !/^https:\/\//.test(url)) {
    console.warn("[popularPoliticians] Redis env vars missing or invalid; ranking disabled.");
    cachedClient = null;
    return cachedClient;
  }
  try {
    cachedClient = new Redis({ url, token });
  } catch (e) {
    console.error("[popularPoliticians] Redis client init failed; ranking disabled.", e);
    cachedClient = null;
  }
  return cachedClient;
}

/** ISO-8601 week label, e.g. 2026-W46. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks start Monday; shift to Thursday of the same week to find the ISO year.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    keys.push(KEY_PREFIX + isoWeekKey(d));
  }
  return keys;
}

/** Increment the current week's counter for a politician. Never throws. */
export async function recordPoliticianSelection(personId: string, now = new Date()): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  const key = KEY_PREFIX + isoWeekKey(now);
  try {
    const pipeline = redis.pipeline();
    pipeline.zincrby(key, 1, personId);
    pipeline.expire(key, WEEK_TTL_SECONDS);
    await pipeline.exec();
    return true;
  } catch (e) {
    console.error("[popularPoliticians] record failed", e);
    return false;
  }
}

export type PopularPolitician = { person_id: string; count: number };

/** Top politicians over the recent window, highest first. Never throws. */
export async function getPopularPoliticians(limit: number, now = new Date()): Promise<PopularPolitician[]> {
  const redis = getRedis();
  if (!redis) return [];
  const n = Math.max(1, Math.min(MAX_TOP_N, Math.floor(limit)));
  const keys = weekKeys(now, WINDOW_WEEKS);
  try {
    const raw = (await redis.zunion(keys.length, keys, { withScores: true, aggregate: "sum" })) as unknown[];
    const items: PopularPolitician[] = [];
    if (Array.isArray(raw[0])) {
      // [[member, score], ...]
      for (const pair of raw as unknown[][]) {
        items.push({ person_id: String(pair[0]), count: Number(pair[1]) });
      }
    } else {
      // Flat [member, score, member, score, ...] (Upstash REST default for WITHSCORES).
      for (let i = 0; i + 1 < raw.length; i += 2) {
        items.push({ person_id: String(raw[i]), count: Number(raw[i + 1]) });
      }
    }
    items.sort((a, b) => b.count - a.count || a.person_id.localeCompare(b.person_id));
    return items.slice(0, n);
  } catch (e) {
    console.error("[popularPoliticians] read failed", e);
    return [];
  }
}
