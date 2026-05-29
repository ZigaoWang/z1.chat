import { NextRequest } from "next/server";
import { signUp } from "@/lib/auth";
import { z } from "zod";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getIP(req);
    await checkRateLimit(`signup:ip:${ip}`, 10, 60 * 60 * 1000);

    const { name, email, password } = await req.json();
    const user = await signUp(name, email, password);
    return Response.json({ success: true, userId: user.id });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: "Too many requests" }, { status: 429 });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0].message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Sign up failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
