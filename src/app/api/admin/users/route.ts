import { db } from "@/lib/db";
import { users, usageLogs } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { sql } from "drizzle-orm";

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
        createdAt: users.createdAt,
        totalCost: sql<string>`COALESCE((
          SELECT SUM(${usageLogs.userCostUsd})
          FROM ${usageLogs}
          WHERE ${usageLogs.userId} = ${users.id}
        ), 0)`,
      })
      .from(users)
      .orderBy(users.createdAt);

    return Response.json(
      allUsers.map((u) => ({
        ...u,
        creditBalance: Number(u.creditBalance),
        totalCharged: Number(u.totalCost),
      }))
    );
  } catch (error) {
    console.error("Admin users API error:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
