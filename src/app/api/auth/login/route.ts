import { signIn } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    const { user, needsVerification } = await signIn(email, password);
    if (needsVerification) {
      return Response.json({ needsVerification: true, userId: user.id });
    }
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sign in failed";
    return Response.json({ error: message }, { status: 401 });
  }
}
