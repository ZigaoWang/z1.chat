import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    await requestPasswordReset(email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
