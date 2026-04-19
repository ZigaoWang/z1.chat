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
    const { content, toolInvocations } = body as {
      content?: string;
      toolInvocations?: Array<Record<string, unknown>>;
    };

    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    });
    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Find the last assistant message
    const [lastAssistant] = await db
      .select({ id: messages.id, content: messages.content, metadata: messages.metadata })
      .from(messages)
      .where(and(eq(messages.conversationId, id), eq(messages.role, "assistant")))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    if (!lastAssistant) {
      return Response.json({ error: "No assistant message found" }, { status: 404 });
    }

    // Build update — only update fields that improve on what's in DB
    const updates: Record<string, unknown> = {};
    if (content && content.length > lastAssistant.content.length) {
      updates.content = content;
    }
    if (toolInvocations && toolInvocations.length > 0) {
      const existing = (lastAssistant.metadata as Record<string, unknown>)?.toolInvocations as unknown[] | undefined;
      if (!existing || existing.length < toolInvocations.length) {
        updates.metadata = { ...((lastAssistant.metadata as Record<string, unknown>) || {}), toolInvocations };
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.update(messages).set(updates).where(eq(messages.id, lastAssistant.id));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Patch message error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
