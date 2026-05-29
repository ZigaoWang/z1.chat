import { NextRequest } from "next/server";
import { sendEmailVerificationCode } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, emailVerificationCodes } from "@/lib/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();
    if (!userId || !email || typeof email !== "string") {
      return Response.json({ error: "Missing userId or email" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user || !user.email) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const ip = getIP(req);
    const normalizedEmail = user.email.toLowerCase();

    await checkRateLimit(`resend:ip:${ip}`, 10, 60 * 60 * 1000);
    await checkRateLimit(`resend:email:${normalizedEmail}`, 5, 60 * 60 * 1000);

    // 60-second cooldown per email
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
    if (error instanceof RateLimitError) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to resend code";
    return Response.json({ error: message }, { status: 500 });
  }
}
