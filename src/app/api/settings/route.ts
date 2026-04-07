import { db } from "@/lib/db";
import { users, type UserPreferences } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/settings — get user preferences
export async function GET() {
  try {
    const userId = getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      preferences: user.preferences,
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return Response.json({ error: "Failed to get settings" }, { status: 500 });
  }
}

// PATCH /api/settings — update user preferences
export async function PATCH(req: Request) {
  try {
    const userId = getCurrentUserId();
    const body = await req.json();

    const updates: Partial<{
      name: string;
      preferences: UserPreferences;
    }> = {};

    if (body.name !== undefined) {
      updates.name = body.name;
    }

    if (body.preferences !== undefined) {
      // Merge with existing preferences
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      updates.preferences = {
        ...(user?.preferences || {
          theme: "system",
          defaultModel: null,
          responseStyle: "balanced",
          language: null,
          customInstructions: null,
        }),
        ...body.preferences,
      };
    }

    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      name: updated.name,
      preferences: updated.preferences,
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return Response.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
