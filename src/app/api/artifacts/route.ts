import { db } from "@/lib/db";
import { artifacts, conversations } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return Response.json({ error: "conversationId required" }, { status: 400 });
    }

    // Verify conversation ownership
    const conv = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
    });
    if (!conv) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const results = await db.query.artifacts.findMany({
      where: eq(artifacts.conversationId, conversationId),
      orderBy: (a, { desc }) => [desc(a.updatedAt)],
    });

    return Response.json(results);
  } catch (error) {
    console.error("List artifacts error:", error);
    return Response.json({ error: "Failed to list artifacts" }, { status: 500 });
  }
}
