import { db } from "@/lib/db";
import { artifacts, artifactVersions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const userId = await getCurrentUserId();

    // Verify artifact ownership
    const artifact = await db.query.artifacts.findFirst({
      where: and(eq(artifacts.id, id), eq(artifacts.userId, userId)),
    });
    if (!artifact) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const versions = await db
      .select({
        id: artifactVersions.id,
        version: artifactVersions.version,
        content: artifactVersions.content,
        createdAt: artifactVersions.createdAt,
      })
      .from(artifactVersions)
      .where(eq(artifactVersions.artifactId, id))
      .orderBy(desc(artifactVersions.version));

    return Response.json(versions);
  } catch (error) {
    console.error("List versions error:", error);
    return Response.json({ error: "Failed to list versions" }, { status: 500 });
  }
}
