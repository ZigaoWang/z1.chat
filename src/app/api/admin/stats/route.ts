import { db } from "@/lib/db";
import { users, usageLogs } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { sql, gte } from "drizzle-orm";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    // Total users
    const [userCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);

    // Total raw cost (what we pay)
    const [rawCost] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs);

    // Total revenue (what users are charged)
    const [revenue] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.userCostUsd}), 0)` })
      .from(usageLogs);

    // Active users (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activeUsers] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${usageLogs.userId})` })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, thirtyDaysAgo));

    return Response.json({
      totalUsers: Number(userCount.count),
      totalCost: Number(rawCost.total),
      totalRevenue: Number(revenue.total),
      activeUsers: Number(activeUsers.count),
    });
  } catch (error) {
    console.error("Admin stats API error:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
