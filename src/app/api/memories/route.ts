import { db } from "@/lib/db";
import { memories, conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";

// GET /api/memories — list user's memories with source conversation info
export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const result = await db
      .select({
        id: memories.id,
        category: memories.category,
        content: memories.content,
        sourceConversationId: memories.sourceConversationId,
        relevanceScore: memories.relevanceScore,
        accessCount: memories.accessCount,
        lastAccessedAt: memories.lastAccessedAt,
        createdAt: memories.createdAt,
        updatedAt: memories.updatedAt,
        sourceTitle: conversations.title,
      })
      .from(memories)
      .leftJoin(
        conversations,
        eq(memories.sourceConversationId, conversations.id)
      )
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.relevanceScore), desc(memories.updatedAt));

    return Response.json(result);
  } catch (error) {
    console.error("List memories error:", error);
    return Response.json({ error: "Failed to list memories" }, { status: 500 });
  }
}

// DELETE /api/memories — delete a specific memory or clear all
export async function DELETE(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const { id, clearAll } = body as { id?: string; clearAll?: boolean };

    if (clearAll) {
      await db.delete(memories).where(eq(memories.userId, userId));
      return Response.json({ success: true, cleared: true });
    }

    if (!id) {
      return Response.json({ error: "Memory ID is required" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, userId)))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete memory error:", error);
    return Response.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}

// PATCH /api/memories — update a memory's content
export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { id, content } = await req.json();

    if (!id || !content) {
      return Response.json({ error: "ID and content are required" }, { status: 400 });
    }

    const [updated] = await db
      .update(memories)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(memories.id, id), eq(memories.userId, userId)))
      .returning();

    if (!updated) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    console.error("Update memory error:", error);
    return Response.json({ error: "Failed to update memory" }, { status: 500 });
  }
}
