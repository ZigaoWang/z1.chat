import "server-only";

import { cookies } from "next/headers";
import { db } from "./db";
import { sessions } from "./db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "./session-crypto";

export { encrypt, decrypt };

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Insert session in DB
  const [session] = await db
    .insert(sessions)
    .values({ userId, expiresAt })
    .returning();

  // Encrypt session ID into cookie
  const token = await encrypt({ sessionId: session.id, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const payload = await decrypt(token);
    if (payload?.sessionId) {
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
