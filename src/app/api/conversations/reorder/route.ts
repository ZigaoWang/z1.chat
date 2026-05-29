import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

// POST /api/conversations/reorder — reorder pinned conversations
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { orderedIds } = await req.json();

    if (!Array.isArray(orderedIds)) {
      return Response.json({ error: "orderedIds must be an array" }, { status: 400 });
    }

    // Update each conversation's pinOrder based on its position in the array
    await Promise.all(
      orderedIds.map((id: string, index: number) =>
        db
          .update(conversations)
          .set({ pinOrder: index })
          .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      )
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Reorder conversations error:", error);
    return Response.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
