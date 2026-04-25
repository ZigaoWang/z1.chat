import { signUp } from "@/lib/auth";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    const user = await signUp(name, email, password);
    return Response.json({ success: true, userId: user.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Sign up failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
