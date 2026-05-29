import "server-only";

import { db } from "./db";
import { rateLimitHits } from "./db/schema";
import { and, eq, gt, sql } from "drizzle-orm";

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
}
