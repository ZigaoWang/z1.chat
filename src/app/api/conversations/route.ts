import { db } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, desc, and, ilike, or, sql, inArray } from "drizzle-orm";

// GET /api/conversations — list all conversations with full-text search
export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let conversationIds: string[] | null = null;

    if (search) {
      // Escape SQL LIKE wildcards in user input
      const escapedSearch = search.replace(/[\\%_]/g, (c) => `\\${c}`);

      // Search across conversation titles AND message content
      const titleMatches = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            ilike(conversations.title, `%${escapedSearch}%`)
          )
        );

      const messageMatches = await db
        .selectDistinct({ conversationId: messages.conversationId })
        .from(messages)
        .innerJoin(
          conversations,
          eq(messages.conversationId, conversations.id)
        )
        .where(
          and(
            eq(conversations.userId, userId),
            ilike(messages.content, `%${escapedSearch}%`)
          )
        );

      const ids = new Set([
        ...titleMatches.map((r) => r.id),
        ...messageMatches.map((r) => r.conversationId),
      ]);

      conversationIds = Array.from(ids);

      if (conversationIds.length === 0) {
        return Response.json([]);
      }
    }

    const where = conversationIds
      ? and(
          eq(conversations.userId, userId),
          inArray(conversations.id, conversationIds)
        )
      : eq(conversations.userId, userId);

    const results = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        model: conversations.model,
        summary: conversations.summary,
        compactionSummary: conversations.compactionSummary,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
        pinOrder: conversations.pinOrder,
      })
      .from(conversations)
      .where(where!)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    // Get last message preview for each conversation
    const convIds = results.map((c) => c.id);
    const previewMap = new Map<string, string>();

    if (convIds.length > 0) {
      const previews = await db
        .select({
          conversationId: messages.conversationId,
          content: messages.content,
        })
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, convIds),
            or(eq(messages.role, "user"), eq(messages.role, "assistant"))
          )
        )
        .orderBy(desc(messages.createdAt));

      for (const p of previews) {
        if (!previewMap.has(p.conversationId)) {
          previewMap.set(p.conversationId, p.content.slice(0, 120));
        }
      }
    }

    const conversationsWithPreview = results.map((c) => ({
      ...c,
      lastMessage: previewMap.get(c.id) || null,
    }));

    return Response.json(conversationsWithPreview);
  } catch (error) {
    console.error("List conversations error:", error);
    return Response.json(
      { error: "Failed to list conversations" },
      { status: 500 }
    );
  }
}

// POST /api/conversations — create a new conversation
export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json().catch(() => ({}));

    const [conv] = await db
      .insert(conversations)
      .values({
        userId,
        title: body.title || "New conversation",
        model: body.model || null,
      })
      .returning();

    return Response.json(conv, { status: 201 });
  } catch (error) {
    console.error("Create conversation error:", error);
    return Response.json(
      { error: "Failed to create conversation" },
      { status: 500 }
    );
  }
}
