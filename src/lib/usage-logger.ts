import { generateText, streamText, type GenerateTextResult, type StreamTextResult } from "ai";
import { db } from "./db";
import { usageLogs, users } from "./db/schema";
import { calculateCost, calculateUserCost, getSearchCost } from "./cost-calculator";
import { sql, eq } from "drizzle-orm";
import { Decimal } from "decimal.js";

type UsageType =
  | "chat"
  | "title"
  | "summary"
  | "memory_extraction"
  | "memory_dedup"
  | "consolidation"
  | "immediate_memory"
  | "compaction"
  | "search";

interface LogMeta {
  userId: string;
  conversationId?: string;
  type: UsageType;
  model: string;
}

export async function logUsage(
  meta: LogMeta,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const costUsd = await calculateCost(meta.model, inputTokens, outputTokens);
    const userCostUsd = calculateUserCost(costUsd);

    await db.insert(usageLogs).values({
      userId: meta.userId,
      conversationId: meta.conversationId || null,
      type: meta.type,
      model: meta.model,
      inputTokens,
      outputTokens,
      costUsd,
      userCostUsd,
    });

    // Deduct from credit balance (skip for admins)
    if (new Decimal(userCostUsd).greaterThan(0)) {
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, meta.userId))
        .limit(1);
      if (user?.role !== "admin") {
        await db
          .update(users)
          .set({ creditBalance: sql`GREATEST(0, ${users.creditBalance} - ${userCostUsd}::numeric)` })
          .where(sql`${users.id} = ${meta.userId}`);
      }
    }
  } catch (error) {
    console.error("[usage-logger] Failed to log:", error);
  }
}

export async function logSearchUsage(
  userId: string,
  conversationId?: string
): Promise<void> {
  try {
    const rawCost = getSearchCost();
    const userCostUsd = calculateUserCost(rawCost);

    await db.insert(usageLogs).values({
      userId,
      conversationId: conversationId || null,
      type: "search",
      model: "tavily",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: rawCost,
      userCostUsd,
    });

    // Deduct from credit balance (skip for admins)
    if (new Decimal(userCostUsd).greaterThan(0)) {
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.role !== "admin") {
        await db
          .update(users)
          .set({ creditBalance: sql`GREATEST(0, ${users.creditBalance} - ${userCostUsd}::numeric)` })
          .where(sql`${users.id} = ${userId}`);
      }
    }
  } catch (error) {
    console.error("[usage-logger] Failed to log search:", error);
  }
}

/**
 * Wrap generateText to automatically log usage.
 */
export async function trackedGenerateText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Parameters<typeof generateText>[0],
  meta: LogMeta
): Promise<GenerateTextResult<any, any>> {
  const result = await generateText(opts);

  logUsage(meta, result.usage.inputTokens ?? 0, result.usage.outputTokens ?? 0).catch(
    console.error
  );

  return result;
}

/**
 * Wrap streamText to automatically log usage in onFinish.
 */
export function trackedStreamText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  opts: Parameters<typeof streamText>[0],
  meta: LogMeta
): StreamTextResult<any, any> {
  const originalOnFinish = opts.onFinish;

  return streamText({
    ...opts,
    onFinish: async (event) => {
      // Log usage
      logUsage(
        meta,
        event.usage.inputTokens ?? 0,
        event.usage.outputTokens ?? 0
      ).catch(console.error);

      // Call original onFinish if provided
      if (originalOnFinish) {
        await originalOnFinish(event);
      }
    },
  });
}
