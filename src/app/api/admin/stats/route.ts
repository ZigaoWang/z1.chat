import { db } from "@/lib/db";
import { users, usageLogs, conversations, paymentOrders } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { sql, gte, eq } from "drizzle-orm";
import { USD_TO_CNY } from "@/lib/currency";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const [userCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);

    const [rawCost] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs);

    const [revenue] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.userCostUsd}), 0)` })
      .from(usageLogs);

    const [convCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(conversations);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [activeUsers] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${usageLogs.userId})` })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, thirtyDaysAgo));

    const [bannedCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`${users.role} = 'banned'`);

    const [paidTotal] = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentOrders.amount}), 0)` })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, "paid"));

    const [paidCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, "paid"));

    const totalCostUsd = Number(rawCost.total);
    const totalCostCny = totalCostUsd * USD_TO_CNY;
    const totalRevenueCny = Number(revenue.total);
    const totalPaidCny = Number(paidTotal.total);

    return Response.json({
      totalUsers: Number(userCount.count),
      totalConversations: Number(convCount.count),
      activeUsers: Number(activeUsers.count),
      bannedUsers: Number(bannedCount.count),
      totalCostUsd,
      totalCostCny,
      totalRevenueCny,
      marginCny: totalRevenueCny - totalCostCny,
      totalPaidCny,
      totalPaidOrders: Number(paidCount.count),
    });
  } catch (error) {
    console.error("Admin stats API error:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
