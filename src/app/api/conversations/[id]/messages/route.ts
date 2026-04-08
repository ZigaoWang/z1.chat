import { db } from "@/lib/db";
import { messages, conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

// GET /api/conversations/:id/messages
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    // Verify the conversation belongs to the user
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
