import { verifyEmailCode } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json();
    if (!userId || !code) {
      return Response.json({ error: "Missing userId or code" }, { status: 400 });
    }
    await verifyEmailCode(userId, code);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
