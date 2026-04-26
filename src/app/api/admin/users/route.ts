import { db } from "@/lib/db";
import { users, usageLogs, conversations, paymentOrders } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { sql, desc, eq } from "drizzle-orm";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        creditBalance: users.creditBalance,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    const usageAgg = await db
      .select({
        userId: usageLogs.userId,
        totalCharged: sql<string>`COALESCE(SUM(${usageLogs.userCostUsd}), 0)`,
        totalRawCost: sql<string>`COALESCE(SUM(${usageLogs.costUsd}), 0)`,
        requestCount: sql<number>`COUNT(*)::int`,
        lastActive: sql<string | null>`MAX(${usageLogs.createdAt})::text`,
      })
      .from(usageLogs)
      .groupBy(usageLogs.userId);

    const convAgg = await db
      .select({
        userId: conversations.userId,
        conversationCount: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .groupBy(conversations.userId);

    const orderAgg = await db
      .select({
        userId: paymentOrders.userId,
        totalPaidCny: sql<string>`COALESCE(SUM(CASE WHEN ${paymentOrders.status} = 'paid' THEN ${paymentOrders.amount} ELSE 0 END), 0)`,
        orderCount: sql<number>`COUNT(*)::int`,
      })
      .from(paymentOrders)
      .groupBy(paymentOrders.userId);

    const usageMap = new Map(usageAgg.map((r) => [r.userId, r]));
    const convMap = new Map(convAgg.map((r) => [r.userId, r]));
    const orderMap = new Map(orderAgg.map((r) => [r.userId, r]));

    return Response.json(
      allUsers.map((u) => {
        const usage = usageMap.get(u.id);
        const conv = convMap.get(u.id);
        const order = orderMap.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          creditBalance: Number(u.creditBalance),
          emailVerified: u.emailVerified,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
          totalCharged: Number(usage?.totalCharged ?? 0),
          totalRawCost: Number(usage?.totalRawCost ?? 0),
          conversationCount: usage ? (conv?.conversationCount ?? 0) : 0,
          lastActive: usage?.lastActive ?? null,
          requestCount: usage?.requestCount ?? 0,
          totalPaidCny: Number(order?.totalPaidCny ?? 0),
          orderCount: order?.orderCount ?? 0,
        };
      })
    );
  } catch (error) {
    console.error("Admin users API error:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
