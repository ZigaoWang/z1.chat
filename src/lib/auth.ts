import "server-only";

import crypto from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, emailVerificationCodes, creditTransactions } from "./db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createSession, deleteSession } from "./session";
import { verifySession } from "./dal";
import { sendVerificationEmail } from "./email";

export const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

const FREE_CREDITS_CNY = process.env.FREE_CREDITS_CNY || "7";

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
  if (existing && existing.emailVerified) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(validated.password, 12);

  let user;
  if (existing && !existing.emailVerified) {
    [user] = await db
      .update(users)
      .set({ name: validated.name, passwordHash, creditBalance: FREE_CREDITS_CNY, updatedAt: new Date() })
      .where(eq(users.id, existing.id))
      .returning();
  } else {
    [user] = await db
      .insert(users)
      .values({
        name: validated.name,
        email: validated.email.toLowerCase(),
        passwordHash,
        creditBalance: FREE_CREDITS_CNY,
      })
      .returning();
  }

  if (parseFloat(FREE_CREDITS_CNY) > 0) {
    await db.insert(creditTransactions).values({
      userId: user.id,
      amount: FREE_CREDITS_CNY,
      balance: FREE_CREDITS_CNY,
      type: "signup_bonus",
      description: `Welcome credits: ¥${FREE_CREDITS_CNY}`,
    });
  }

  await sendEmailVerificationCode(user.id, user.email!);
  return user;
}

export async function sendEmailVerificationCode(userId: string, email: string) {
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.insert(emailVerificationCodes).values({
    userId,
    code,
    expiresAt,
  });

  const sent = await sendVerificationEmail(email, code);
  if (!sent) {
    throw new Error("Failed to send verification email");
  }
}

export async function verifyEmailCode(userId: string, code: string) {
  const verification = await db.query.emailVerificationCodes.findFirst({
    where: and(
      eq(emailVerificationCodes.userId, userId),
      eq(emailVerificationCodes.used, false),
    ),
    orderBy: [desc(emailVerificationCodes.createdAt)],
  });

  if (!verification) {
    throw new Error("No verification code found");
  }

  if (verification.expiresAt < new Date()) {
    throw new Error("Code expired");
  }

  if (verification.attempts >= 5) {
    throw new Error("Too many attempts");
  }

  await db
    .update(emailVerificationCodes)
    .set({ attempts: verification.attempts + 1 })
    .where(eq(emailVerificationCodes.id, verification.id));

  if (verification.code !== code) {
    throw new Error("Invalid code");
  }

  await db
    .update(emailVerificationCodes)
    .set({ used: true })
    .where(eq(emailVerificationCodes.id, verification.id));

  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await createSession(userId);
}

export async function signIn(email: string, password: string) {
  const validated = signInSchema.parse({ email, password });

  const user = await db.query.users.findFirst({
    where: eq(users.email, validated.email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    // Constant-time: prevent email enumeration via response timing
    await bcrypt.compare(validated.password, "$2b$12$invalidhashpadding000000000000000000000000000000000000000");
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(validated.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  if (!user.emailVerified) {
    await sendEmailVerificationCode(user.id, user.email!);
    return { user, needsVerification: true };
  }

  await createSession(user.id);
  return { user, needsVerification: false };
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
