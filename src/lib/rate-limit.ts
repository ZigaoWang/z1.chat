import "server-only";

import { db } from "./db";
import { rateLimitHits } from "./db/schema";
import { and, eq, gt, lt, sql } from "drizzle-orm";

const CLEANUP_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours
const CLEANUP_PROBABILITY = 0.01; // ~1% of requests trigger cleanup

export class RateLimitError extends Error {
  constructor(public retryAfterSeconds?: number) {
    super("Too many requests");
    this.name = "RateLimitError";
  }
}

/**
 * Check a rate limit bucket. Throws RateLimitError if exceeded.
 * key: unique identifier (e.g. "signup:ip:1.2.3.4")
 * max: max hits allowed in windowMs
 * windowMs: sliding window in milliseconds
 */
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<void> {
  const since = new Date(Date.now() - windowMs);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(rateLimitHits)
    .where(and(eq(rateLimitHits.key, key), gt(rateLimitHits.createdAt, since)));

  if (count >= max) {
    throw new RateLimitError(Math.ceil(windowMs / 1000));
  }

  await db.insert(rateLimitHits).values({ key });

  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(Date.now() - CLEANUP_MAX_AGE_MS);
    db.delete(rateLimitHits).where(lt(rateLimitHits.createdAt, cutoff)).execute();
  }
}
