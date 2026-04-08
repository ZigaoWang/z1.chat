import { EncryptJWT, jwtDecrypt } from "jose";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function encrypt(payload: { sessionId: string; expiresAt: Date }) {
  return new EncryptJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .encrypt(getSecretKey());
}

export async function decrypt(token: string) {
  try {
    const { payload } = await jwtDecrypt(token, getSecretKey());
    return payload as unknown as { sessionId: string; expiresAt: string };
  } catch {
    return null;
  }
}
