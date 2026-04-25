import { sendEmailVerificationCode } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailVerificationCodes } from "@/lib/db/schema";
import { eq, gt, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return Response.json({ error: "Missing userId" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.email) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limit: 60s between sends
    const recent = await db.query.emailVerificationCodes.findFirst({
      where: and(
        eq(emailVerificationCodes.userId, userId),
        gt(emailVerificationCodes.createdAt, new Date(Date.now() - 60_000))
      ),
    });
    if (recent) {
      return Response.json(
        { error: "Please wait before requesting another code" },
        { status: 429 }
      );
    }

    await sendEmailVerificationCode(userId, user.email);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resend code";
    return Response.json({ error: message }, { status: 500 });
  }
}
