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
      if (!["user", "admin", "banned"].includes(body.role)) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      if (id === admin.id && body.role !== "admin") {
        return Response.json(
          { error: "Cannot change your own role" },
          { status: 400 }
        );
      }
      if (body.role !== "admin") {
        const [adminCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(users)
          .where(eq(users.role, "admin"));
        if (adminCount.count <= 1) {
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

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "Invalid email address" }, { status: 400 });
      }
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, email), ne(users.id, id)))
        .limit(1);
      if (existing) {
        return Response.json({ error: "Email already in use" }, { status: 400 });
      }
      updates.email = email;
    }

    if (body.creditBalance !== undefined) {
      const balance = parseFloat(body.creditBalance);
      if (isNaN(balance)) {
        return Response.json({ error: "Invalid credit balance" }, { status: 400 });
      }
      updates.creditBalance = String(balance);
    }

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const { id } = await params;

    // Prevent deleting yourself
    if (id === admin.id) {
      return Response.json({ error: "Cannot delete yourself" }, { status: 400 });
    }

    // Prevent deleting the last admin
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.role === "admin") {
      const [adminCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, "admin"));
      if (adminCount.count <= 1) {
        return Response.json({ error: "Cannot delete the last admin" }, { status: 400 });
      }
    }

    // Cascade delete handles sessions, conversations, messages, etc.
    await db.delete(users).where(eq(users.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Admin user delete error:", error);
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
