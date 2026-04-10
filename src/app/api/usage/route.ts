import { db } from "@/lib/db";
import { usageLogs } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Total cost (all time)
    const [totalResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId));

    // This month's cost
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs)
      .where(
        and(
          eq(usageLogs.userId, userId),
          gte(usageLogs.createdAt, startOfMonth)
        )
      );

    // Breakdown by type
    const breakdown = await db
      .select({
        type: usageLogs.type,
        count: sql<string>`COUNT(*)`,
        totalCost: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)`,
        totalInputTokens: sql<string>`COALESCE(SUM(${usageLogs.inputTokens}), 0)`,
        totalOutputTokens: sql<string>`COALESCE(SUM(${usageLogs.outputTokens}), 0)`,
      })
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId))
      .groupBy(usageLogs.type)
      .orderBy(sql`COALESCE(SUM(${usageLogs.costUsd}), 0) DESC`);

    // Recent logs
    const recent = await db
      .select({
        id: usageLogs.id,
        type: usageLogs.type,
        model: usageLogs.model,
        inputTokens: usageLogs.inputTokens,
        outputTokens: usageLogs.outputTokens,
        costUsd: usageLogs.costUsd,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId))
      .orderBy(desc(usageLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return Response.json({
      totalCost: Number(totalResult.total),
      monthCost: Number(monthResult.total),
      breakdown: breakdown.map((b) => ({
        type: b.type,
        count: Number(b.count),
        totalCost: Number(b.totalCost),
        totalInputTokens: Number(b.totalInputTokens),
        totalOutputTokens: Number(b.totalOutputTokens),
      })),
      recent: recent.map((r) => ({
        ...r,
        costUsd: Number(r.costUsd),
      })),
    });
  } catch (error) {
    console.error("Usage API error:", error);
    return Response.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
