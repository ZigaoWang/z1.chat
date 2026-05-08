import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { db } from "@/lib/db";
import { curatedModels } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCachedModels } from "@/lib/models-cache";

export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  const [curated, allModels] = await Promise.all([
    db.select().from(curatedModels).orderBy(asc(curatedModels.sortOrder)),
    getCachedModels(),
  ]);

  return Response.json({
    curated,
    availableModels: allModels.map((m) => ({ id: m.id, name: m.name })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  const body = await req.json();
  const { modelId, displayName, sortOrder, intelligenceLevel, costLevel, category } = body;

  if (!modelId) {
    return Response.json({ error: "modelId is required" }, { status: 400 });
  }

  const [created] = await db
    .insert(curatedModels)
    .values({
      modelId,
      displayName: displayName || null,
      sortOrder: sortOrder ?? 0,
      intelligenceLevel: intelligenceLevel ?? 3,
      costLevel: costLevel ?? 2,
      category: category || null,
    })
    .returning();

  return Response.json(created);
}

export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  const body = await req.json();
  const { id, ...updates } = body;

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if ("displayName" in updates) allowed.displayName = updates.displayName;
  if ("sortOrder" in updates) allowed.sortOrder = updates.sortOrder;
  if ("intelligenceLevel" in updates) allowed.intelligenceLevel = updates.intelligenceLevel;
  if ("costLevel" in updates) allowed.costLevel = updates.costLevel;
  if ("category" in updates) allowed.category = updates.category;
  if ("enabled" in updates) allowed.enabled = updates.enabled;
  allowed.updatedAt = new Date();

  const [updated] = await db
    .update(curatedModels)
    .set(allowed)
    .where(eq(curatedModels.id, id))
    .returning();

  return Response.json(updated);
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  const { id } = await req.json();
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(curatedModels).where(eq(curatedModels.id, id));
  return Response.json({ success: true });
}
