import { db } from "@/lib/db";
import { messages, conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, asc, desc } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/:id/messages
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    });

    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    return Response.json(result);
  } catch (error) {
    console.error("List messages error:", error);
    return Response.json({ error: "Failed to list messages" }, { status: 500 });
  }
}

// PATCH /api/conversations/:id/messages — save partial assistant content on stop
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const body = await req.json();
    const { content } = body as { content: string };

    if (!content) {
      return Response.json({ error: "content required" }, { status: 400 });
    }

    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    });
    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Find the last assistant message in this conversation
    const [lastAssistant] = await db
      .select({ id: messages.id, content: messages.content })
      .from(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.role, "assistant")))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (!lastAssistant) {
      return Response.json({ error: "No assistant message found" }, { status: 404 });
    }

    // Only update if current content is shorter (don't overwrite a more complete response)
    if (lastAssistant.content.length < content.length) {
      await db.update(messages)
        .set({ content })
        .where(eq(messages.id, lastAssistant.id));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Patch message error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
