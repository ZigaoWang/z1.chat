import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq } from "drizzle-orm";

// GET /api/memories — get user's memory document
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { memoryDocument: true },
    });

    return Response.json({ document: user?.memoryDocument || "" });
  } catch (error) {
    console.error("Get memory error:", error);
    return Response.json({ error: "Failed to load memory" }, { status: 500 });
  }
}

// PUT /api/memories — save user's memory document
export async function PUT(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { document } = await req.json();

    if (typeof document !== "string") {
      return Response.json({ error: "Document must be a string" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ memoryDocument: document, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return Response.json({ success: true, document });
  } catch (error) {
    console.error("Save memory error:", error);
    return Response.json({ error: "Failed to save memory" }, { status: 500 });
  }
}

// DELETE /api/memories — clear memory document
export async function DELETE() {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(users)
      .set({ memoryDocument: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Clear memory error:", error);
    return Response.json({ error: "Failed to clear memory" }, { status: 500 });
  }
}
