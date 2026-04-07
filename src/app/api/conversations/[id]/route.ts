import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { regenerateConversationTitle } from "@/lib/title-generator";
import { eq, and } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/:id
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = getCurrentUserId();

    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    });

    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(conv);
  } catch (error) {
    console.error("Get conversation error:", error);
    return Response.json({ error: "Failed to get conversation" }, { status: 500 });
  }
}

// PATCH /api/conversations/:id — rename or regenerate title
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = getCurrentUserId();
    const body = await req.json();

    // Verify ownership
    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    });
    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Regenerate title with AI
    if (body.generateTitle) {
      const title = await regenerateConversationTitle(id);
      return Response.json({ ...conv, title });
    }

    // Manual rename
    const { title } = body;
    if (!title || typeof title !== "string") {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    const [updated] = await db
      .update(conversations)
      .set({ title: title.trim(), updatedAt: new Date() })
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();

    return Response.json(updated);
  } catch (error) {
    console.error("Update conversation error:", error);
    return Response.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

// DELETE /api/conversations/:id
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = getCurrentUserId();

    const [deleted] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
      .returning();

    if (!deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
