import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { decrypt } from "./session";
import { db } from "./db";
import { sessions, users } from "./db/schema";
import { eq } from "drizzle-orm";

export const verifySession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const payload = await decrypt(token);
  if (!payload?.sessionId) return null;

  // DB lookup
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, payload.sessionId),
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return { userId: session.userId, sessionId: session.id };
});

export const getCurrentUser = cache(async () => {
  const session = await verifySession();
  if (!session) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
  });

  return user ?? null;
});
