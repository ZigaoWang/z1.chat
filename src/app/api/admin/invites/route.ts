import { randomBytes } from "crypto";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { db } from "@/lib/db";
import { inviteTokens } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function POST(req: Request) {
  const adminOrRes = await requireAdmin();
  if (isErrorResponse(adminOrRes)) return adminOrRes;

  try {
    const { creditAmount } = await req.json();

    if (!creditAmount || typeof creditAmount !== "number" || creditAmount <= 0) {
      return Response.json(
        { error: "creditAmount must be a positive number" },
        { status: 400 }
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invite] = await db
      .insert(inviteTokens)
      .values({
        token,
        creditAmount,
        createdBy: adminOrRes.id,
        expiresAt,
      })
      .returning();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite?token=${token}`;

    return Response.json({ invite, url: inviteUrl });
  } catch (error) {
    console.error("[admin/invites] Failed to create invite:", error);
    return Response.json({ error: "Failed to create invite" }, { status: 500 });
  }
}

export async function GET() {
  const adminOrRes = await requireAdmin();
  if (isErrorResponse(adminOrRes)) return adminOrRes;

  try {
    const invites = await db
      .select({
        id: inviteTokens.id,
        token: inviteTokens.token,
        creditAmount: inviteTokens.creditAmount,
        used: inviteTokens.used,
        usedByUserId: inviteTokens.usedByUserId,
        expiresAt: inviteTokens.expiresAt,
        createdAt: inviteTokens.createdAt,
      })
      .from(inviteTokens)
      .orderBy(desc(inviteTokens.createdAt))
      .limit(100);

    // Truncate tokens in list response — full token only shown at creation
    const sanitized = invites.map((inv) => ({
      ...inv,
      token: inv.token.slice(0, 8) + "...",
    }));

    return Response.json(sanitized);
  } catch (error) {
    console.error("[admin/invites] Failed to list invites:", error);
    return Response.json({ error: "Failed to list invites" }, { status: 500 });
  }
}
