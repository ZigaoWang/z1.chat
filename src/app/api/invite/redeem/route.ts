import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, inviteTokens } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { createSession } from "@/lib/session";

const redeemSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = redeemSchema.parse(body);

    // Hash password before transaction to minimize lock time
    const passwordHash = await bcrypt.hash(validated.password, 12);

    const result = await db.transaction(async (tx) => {
      // Atomically claim the invite token with FOR UPDATE to prevent races
      const [invite] = await tx
        .select()
        .from(inviteTokens)
        .where(
          and(
            eq(inviteTokens.token, validated.token),
            eq(inviteTokens.used, false)
          )
        )
        .for("update")
        .limit(1);

      if (!invite) {
        return { error: "Invalid or already used invite link", status: 400 } as const;
      }

      if (new Date(invite.expiresAt) < new Date()) {
        return { error: "This invite link has expired", status: 400 } as const;
      }

      // Check if email already exists
      const existing = await tx.query.users.findFirst({
        where: eq(users.email, validated.email.toLowerCase()),
      });
      if (existing) {
        return { error: "An account with this email already exists", status: 400 } as const;
      }

      // Create user with invite credits
      const [user] = await tx
        .insert(users)
        .values({
          name: validated.name,
          email: validated.email.toLowerCase(),
          passwordHash,
          creditBalance: invite.creditAmount,
        })
        .returning();

      // Mark invite as used
      await tx
        .update(inviteTokens)
        .set({ used: true, usedByUserId: user.id })
        .where(eq(inviteTokens.id, invite.id));

      return { userId: user.id } as const;
    });

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    // Create session outside transaction (sets cookie)
    await createSession(result.userId);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("[invite/redeem] Error:", error);
    return Response.json({ error: "Failed to redeem invite" }, { status: 500 });
  }
}
