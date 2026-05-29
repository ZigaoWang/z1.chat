import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const ip = getIP(req);
    await checkRateLimit(`forgot:ip:${ip}`, 10, 60 * 60 * 1000);
    await checkRateLimit(`forgot:email:${email.toLowerCase()}`, 5, 60 * 60 * 1000);

    await requestPasswordReset(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
