import { db } from "@/lib/db";
import { artifacts } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    const artifact = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.id, id), eq(artifacts.userId, userId)),
    });

    if (!artifact) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(artifact);
  } catch (error) {
    console.error("Get artifact error:", error);
    return Response.json({ error: "Failed to get artifact" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();
    const body = await req.json();

    const existing = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.id, id), eq(artifacts.userId, userId)),
    });

    if (!existing) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.content !== undefined) updates.content = body.content;
    if (body.title !== undefined) updates.title = body.title;

    const [updated] = await db.update(artifacts)
      .set(updates)
      .where(eq(artifacts.id, id))
      .returning();

    return Response.json(updated);
  } catch (error) {
    console.error("Update artifact error:", error);
    return Response.json({ error: "Failed to update artifact" }, { status: 500 });
  }
}
