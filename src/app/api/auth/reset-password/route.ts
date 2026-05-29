import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password || typeof token !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Token and password required" }, { status: 400 });
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be 8–128 characters" }, { status: 400 });
    }
    await resetPassword(token, password);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
