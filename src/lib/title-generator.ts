import { getOpenRouter, TITLE_MODEL, MEMORY_MODEL } from "./openrouter";
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { eq, desc } from "drizzle-orm";
import { trackedGenerateText } from "./usage-logger";

function cleanTitle(raw: string): string {
  // Strip think blocks (closed and unclosed)
  let cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*/g, "");

  // Take the first non-empty line (model may prefix with newlines after think block)
  const firstLine = cleaned
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0) || "";

  // Strip surrounding quotes, markdown, and common prefixes
  return firstLine
    .replace(/^["'`*#]+|["'`*#]+$/g, "")
    .replace(/^(title|##?\s*title):?\s*/i, "")
    .trim()
    .slice(0, 100);
}

function cleanForTitle(text: string): string {
  return text
    .replace(/<file name="[^"]*">[\s\S]*?<\/file>\s*/g, "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<artifact[\s\S]*?<\/artifact>/g, "")
    .replace(/```[\s\S]*?```/g, "[code]")
    .trim()
    .slice(0, 300);
}

/** Build a brief conversation digest for the title model */
async function getConversationDigest(conversationId: string): Promise<string> {
  const recent = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(10);

  recent.reverse();

  return recent
    .map((m) => `${m.role}: ${cleanForTitle(m.content).slice(0, 150)}`)
    .join("\n");
}

export async function generateConversationTitle(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
  userId: string
): Promise<string> {
  const conv = await db.query.conversations.findFirst({
    where: eq(conversations.id, conversationId),
    columns: { title: true },
  });
  const hasExistingTitle = conv?.title && conv.title !== "New conversation";

  const cleanUser = cleanForTitle(userMessage);
  const placeholder =
    cleanUser.slice(0, 50).trim() + (cleanUser.length > 50 ? "..." : "") || "New conversation";
  if (!hasExistingTitle) {
    await db
      .update(conversations)
      .set({ title: placeholder })
      .where(eq(conversations.id, conversationId));
  }

  // Get conversation digest for context
  const digest = await getConversationDigest(conversationId);

  return generateTitle(conversationId, digest, placeholder, userId);
}

/** Regenerate title from scratch using full conversation context */
export async function regenerateConversationTitle(
  conversationId: string,
  userId: string
): Promise<string> {
  const digest = await getConversationDigest(conversationId);
  if (!digest) return "New conversation";
  return generateTitle(conversationId, digest, null, userId);
}

async function generateTitle(
  conversationId: string,
  digest: string,
  fallback: string | null,
  userId: string
): Promise<string> {
  const modelsToTry = [TITLE_MODEL, MEMORY_MODEL];

  for (const model of modelsToTry) {
    try {
      const openrouter = getOpenRouter();
      console.log(`[title-gen] model=${model}`);

      const { text } = await trackedGenerateText({
        model: openrouter(model, {
          reasoning: { effort: "low", exclude: true },
        }),
        system:
          "Generate a very short title (2-5 words) for this conversation. Be specific. Return ONLY the title text, nothing else. No quotes, no markdown, no explanation.",
        messages: [
          { role: "user", content: `Conversation:\n${digest}` },
        ],
        maxOutputTokens: 100,
        temperature: 0.3,
      }, {
        userId,
        conversationId,
        type: "title" as const,
        model,
      });

      const title = cleanTitle(text);

      if (!title || title.length < 2) {
        console.warn(`[title-gen] Empty after cleaning (${model}): raw="${text.slice(0, 200)}"`);
        continue;
      }

      await db
        .update(conversations)
        .set({ title })
        .where(eq(conversations.id, conversationId));

      console.log(`[title-gen] OK: "${title}"`);
      return title;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[title-gen] Failed (${model}): ${msg}`);
    }
  }

  console.warn(`[title-gen] All models failed`);
  return fallback || "New conversation";
}
