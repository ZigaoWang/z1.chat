import { getCurrentUser } from "@/lib/dal";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    // In dev bypass mode, return a stub user
    if (process.env.DEV_BYPASS_AUTH === "true") {
      return Response.json({
        id: "00000000-0000-0000-0000-000000000001",
        name: "Dev User",
        email: "dev@localhost",
        role: "admin",
      });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    creditBalance: Number(user.creditBalance),
    onboardingCompleted: user.onboardingCompleted,
    onboardingState: user.onboardingState,
  });
}
