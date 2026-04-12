import { db } from "@/lib/db";
import { usageLogs } from "@/lib/db/schema";
import { requireAdmin, isErrorResponse } from "@/lib/admin";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;

  try {
    const { id } = await params;

    const logs = await db
      .select({
        type: usageLogs.type,
        model: usageLogs.model,
        inputTokens: usageLogs.inputTokens,
        outputTokens: usageLogs.outputTokens,
        costUsd: usageLogs.costUsd,
        userCostUsd: usageLogs.userCostUsd,
        createdAt: usageLogs.createdAt,
      })
      .from(usageLogs)
      .where(eq(usageLogs.userId, id))
      .orderBy(desc(usageLogs.createdAt))
      .limit(25);

    return Response.json(
      logs.map((l) => ({
        ...l,
        costUsd: Number(l.costUsd),
        userCostUsd: Number(l.userCostUsd),
      }))
    );
  } catch (error) {
    console.error("Admin user usage error:", error);
    return Response.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
