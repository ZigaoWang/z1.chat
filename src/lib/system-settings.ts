import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const cache = new Map<string, { value: string; expires: number }>();
const CACHE_TTL = 60_000; // 1 minute

export async function getSystemSetting(key: string, fallback: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, key))
      .limit(1);

    const value = row?.value || fallback;
    cache.set(key, { value, expires: Date.now() + CACHE_TTL });
    return value;
  } catch {
    return fallback;
  }
}

export async function setSystemSetting(key: string, value: string): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
  cache.set(key, { value, expires: Date.now() + CACHE_TTL });
}

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(systemSettings);
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  } catch {
    return {};
  }
}

// Setting keys
export const SETTING_KEYS = {
  TITLE_MODEL: "title_model",
  MEMORY_MODEL: "memory_model",
  MEMORY_CHAT_MODEL: "memory_chat_model",
  CONTEXT_MODEL: "context_model",
  DEFAULT_CHAT_MODEL: "default_chat_model",
} as const;
