import { generateText } from "ai";
import { getOpenRouter, TITLE_MODEL, MEMORY_MODEL } from "./openrouter";
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { eq, desc } from "drizzle-orm";

const MAX_RETRIES = 2;
const RETRY_DELAY = 2000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/<think>[\s\S]*/g, "")
    .replace(/^["'`*#]+|["'`*#]+$/g, "")
    .replace(/^(title|##?\s*title):?\s*/i, "")
    .replace(/\n.*/g, "")
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
  assistantMessage: string
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

  return generateTitle(conversationId, digest, placeholder);
}

/** Regenerate title from scratch using full conversation context */
export async function regenerateConversationTitle(
  conversationId: string
): Promise<string> {
  const digest = await getConversationDigest(conversationId);
  if (!digest) return "New conversation";
  return generateTitle(conversationId, digest, null);
}

async function generateTitle(
  conversationId: string,
  digest: string,
  fallback: string | null
): Promise<string> {
  const modelsToTry = [TITLE_MODEL, MEMORY_MODEL];

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const openrouter = getOpenRouter();
        console.log(`[title-gen] model=${model}, attempt=${attempt + 1}/${MAX_RETRIES + 1}`);

        const { text } = await generateText({
          model: openrouter(model),
          system:
            "Generate a very short title (2-5 words) that captures the overall topic of this conversation. Be specific. Return ONLY the title. No quotes, no thinking, no tags.",
          messages: [
            { role: "user", content: `Conversation:\n${digest}` },
          ],
          maxOutputTokens: 50,
          temperature: 0.3,
        });

        const title = cleanTitle(text);

        if (!title || title.length < 2) {
          console.warn(`[title-gen] Empty result: "${text.slice(0, 100)}"`);
          if (attempt < MAX_RETRIES) { await sleep(RETRY_DELAY); continue; }
          break;
        }

        await db
          .update(conversations)
          .set({ title })
          .where(eq(conversations.id, conversationId));

        console.log(`[title-gen] OK: "${title}"`);
        return title;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[title-gen] Failed (${model}, #${attempt + 1}): ${msg}`);
        if (msg.includes("rate-limit") || msg.includes("429")) break;
        if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
      }
    }
  }

  console.warn(`[title-gen] All models failed`);
  return fallback || "New conversation";
}
