import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { eq, and, ne, sql } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.role !== undefined) {
      if (!["user", "admin"].includes(body.role)) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      // Prevent demoting the last admin
      if (body.role === "user") {
        const [adminCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (adminCount.count <= 1) {
          // Check if we're demoting the only admin
          const [targetUser] = await db
            .select({ role: users.role })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
          if (targetUser?.role === "admin") {
            return Response.json(
              { error: "Cannot demote the last admin" },
              { status: 400 }
            );
          }
        }
      }
      updates.role = body.role;
    }

    if (body.creditBalance !== undefined) {
      const balance = parseFloat(body.creditBalance);
      if (isNaN(balance)) {
        return Response.json({ error: "Invalid credit balance" }, { status: 400 });
      }
      updates.creditBalance = String(balance);
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        creditBalance: users.creditBalance,
      });

    if (!updated) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({ ...updated, creditBalance: Number(updated.creditBalance) });
  } catch (error) {
    console.error("Admin user update error:", error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}
