import { db } from "@/lib/db";
import { users, usageLogs, conversations, paymentOrders } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { sql, gte, eq, ne } from "drizzle-orm";
import { USD_TO_CNY } from "@/lib/currency";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const [userCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);

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

    // Total API cost (what we actually pay) — all users including admin
    const [totalApiCost] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs);

    // Admin API cost (admin's own usage — we pay but don't earn from it)
    const [adminApiCost] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)` })
      .from(usageLogs)
      .innerJoin(users, eq(usageLogs.userId, users.id))
      .where(eq(users.role, "admin"));

    // Revenue charged to paying users (excludes admin)
    const [userRevenue] = await db
      .select({ total: sql<string>`COALESCE(SUM(${usageLogs.userCostUsd}), 0)` })
      .from(usageLogs)
      .innerJoin(users, eq(usageLogs.userId, users.id))
      .where(ne(users.role, "admin"));

    // Actual payments received
    const [paidTotal] = await db
      .select({ total: sql<string>`COALESCE(SUM(${paymentOrders.amount}), 0)` })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, "paid"));

    const [paidCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, "paid"));

    const totalApiCostUsd = Number(totalApiCost.total);
    const adminApiCostUsd = Number(adminApiCost.total);
    const userApiCostUsd = totalApiCostUsd - adminApiCostUsd;
    const userRevenueCny = Number(userRevenue.total);
    const totalPaidCny = Number(paidTotal.total);

    return Response.json({
      totalUsers: Number(userCount.count),
      totalConversations: Number(convCount.count),
      activeUsers: Number(activeUsers.count),
      bannedUsers: Number(bannedCount.count),
      // Cost breakdown
      totalApiCostUsd,
      totalApiCostCny: totalApiCostUsd * USD_TO_CNY,
      adminApiCostUsd,
      adminApiCostCny: adminApiCostUsd * USD_TO_CNY,
      userApiCostUsd,
      userApiCostCny: userApiCostUsd * USD_TO_CNY,
      // Revenue (charged to paying users, excludes admin)
      userRevenueCny,
      // Profit = what users paid us - what their usage cost us
      profitCny: userRevenueCny - (userApiCostUsd * USD_TO_CNY),
      // Actual money received
      totalPaidCny,
      totalPaidOrders: Number(paidCount.count),
    });
  } catch (error) {
    console.error("Admin stats API error:", error);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
