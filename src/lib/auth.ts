import "server-only";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";
import { createSession, deleteSession } from "./session";
import { verifySession } from "./dal";

export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

const signUpSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signUp(name: string, email: string, password: string) {
  const validated = signUpSchema.parse({ name, email, password });

  const existing = await db.query.users.findFirst({
    where: eq(users.email, validated.email.toLowerCase()),
  });
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(validated.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      name: validated.name,
      email: validated.email.toLowerCase(),
      passwordHash,
    })
    .returning();

  await createSession(user.id);
  return user;
}

export async function signIn(email: string, password: string) {
  const validated = signInSchema.parse({ email, password });

  const user = await db.query.users.findFirst({
    where: eq(users.email, validated.email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(validated.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  await createSession(user.id);
  return user;
}

export async function signOut() {
  await deleteSession();
}

export async function getCurrentUserId(): Promise<string> {
  if (process.env.DEV_BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production") {
    return DEV_USER_ID;
  }

  const session = await verifySession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.userId;
}
