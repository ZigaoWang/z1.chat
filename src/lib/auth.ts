import "server-only";

import crypto from "crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, emailVerificationCodes, creditTransactions, passwordResetTokens, sessions } from "./db/schema";
import { eq, and, desc, sql, lt } from "drizzle-orm";
import { createSession, deleteSession } from "./session";
import { verifySession } from "./dal";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import disposableDomains from "disposable-email-domains";

const disposableDomainSet = new Set<string>(disposableDomains);

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

  const domain = validated.email.toLowerCase().split("@")[1];
  if (disposableDomainSet.has(domain)) {
    throw new Error("Disposable email addresses are not allowed");
  }

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

  await db
    .update(emailVerificationCodes)
    .set({ used: true })
    .where(and(eq(emailVerificationCodes.userId, userId), eq(emailVerificationCodes.used, false)));

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

  // Atomic increment — rejects if already at 5 attempts (prevents race condition)
  const [updated] = await db
    .update(emailVerificationCodes)
    .set({ attempts: sql`${emailVerificationCodes.attempts} + 1` })
    .where(
      and(
        eq(emailVerificationCodes.id, verification.id),
        lt(emailVerificationCodes.attempts, 5),
      )
    )
    .returning({ attempts: emailVerificationCodes.attempts });

  if (!updated) {
    throw new Error("Too many attempts");
  }

  if (!crypto.timingSafeEqual(Buffer.from(verification.code), Buffer.from(code))) {
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

export async function requestPasswordReset(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  // Always return success to prevent email enumeration
  if (!user || !user.emailVerified) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db
    .update(passwordResetTokens)
    .set({ used: true })
    .where(and(eq(passwordResetTokens.userId, user.id), eq(passwordResetTokens.used, false)));

  await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  await sendPasswordResetEmail(user.email!, rawToken);
}

export async function resetPassword(token: string, newPassword: string) {
  if (!token || token.length !== 64) throw new Error("Invalid token");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!record || record.used || record.expiresAt < new Date()) {
    throw new Error("Invalid or expired reset link");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, record.id));
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, record.userId));
    await tx
      .delete(sessions)
      .where(eq(sessions.userId, record.userId));
  });
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
