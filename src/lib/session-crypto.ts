import { EncryptJWT, jwtDecrypt } from "jose";

async function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters");
  }
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: new TextEncoder().encode("session") },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(payload: { sessionId: string; expiresAt: Date }) {
  return new EncryptJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(payload.expiresAt)
    .encrypt(await getSecretKey());
}

export async function decrypt(token: string) {
  try {
    const { payload } = await jwtDecrypt(token, await getSecretKey());
    return payload as unknown as { sessionId: string; expiresAt: string };
  } catch {
    return null;
  }
}
