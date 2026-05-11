import { getOpenRouter, MEMORY_MODEL, ORGANIZE_MODEL } from "./openrouter";
import { db } from "./db";
import { conversations, messages, users } from "./db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { SUMMARY_UPDATE_INTERVAL } from "./constants";
import { trackedGenerateText } from "./usage-logger";

const ORGANIZE_INTERVAL = 10;
const organizeCounters = new Map<string, number>();

// ─── Layer 1: Conversation Summary ──────────────────────────────────

/**
 * Update the running summary for a conversation.
 * Called after every assistant response. Only actually runs the LLM
 * every SUMMARY_UPDATE_INTERVAL messages to keep costs low.
 */
export async function updateConversationSummary(
  conversationId: string,
  userId?: string
): Promise<void> {
  try {
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
    });
    if (!conv) return;

    const [{ value: assistantCount }] = await db
      .select({ value: count() })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.role, "assistant")
        )
      );

    const lastSummarizedAt = conv.summaryMessageCount ?? 0;
    if (assistantCount - lastSummarizedAt < SUMMARY_UPDATE_INTERVAL) return;

    const recentMessages = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(20);

    recentMessages.reverse();

    const messagesText = recentMessages
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join("\n\n");

    const existingSummary = conv.summary || "No summary yet.";

    const openrouter = getOpenRouter();
    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `Update the conversation summary based on the recent messages. The summary should capture:
- What the user is working on or asking about
- Key decisions made
- Important context mentioned
- Current state (what's done, what's pending)

Keep it under 300 words. Be specific and info-dense. No filler. Update the existing summary rather than appending to it, so it stays concise.`,
      messages: [
        {
          role: "user",
          content: `Existing summary:\n${existingSummary}\n\nRecent messages:\n${messagesText}`,
        },
      ],
      maxOutputTokens: 500,
      temperature: 0.1,
    }, {
      userId: userId || conv.userId,
      conversationId,
      type: "summary",
      model: MEMORY_MODEL,
    });

    const summary = text.trim();
    if (summary) {
      await db
        .update(conversations)
        .set({
          summary,
          summaryMessageCount: assistantCount,
        })
        .where(eq(conversations.id, conversationId));
    }
  } catch (error) {
    console.error("Conversation summary update failed:", error);
  }
}

// ─── Layer 2: User Memory Document ─────────────────────────────────

/**
 * Get the user's memory document.
 */
export async function getMemoryDocument(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { memoryDocument: true },
  });
  return user?.memoryDocument || "";
}

/**
 * Save the user's memory document.
 */
export async function setMemoryDocument(userId: string, content: string): Promise<void> {
  await db
    .update(users)
    .set({ memoryDocument: content, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Extract memories from a conversation and append to the memory document.
 * Runs async in the background after each assistant response.
 * Only appends new facts — never rewrites or removes existing content.
 */
export async function extractMemories(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  try {
    const currentDoc = await getMemoryDocument(userId);
    const openrouter = getOpenRouter();

    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `You extract durable facts about a user from conversations. Your job is to identify NEW information worth remembering that is NOT already in their memory document.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Their current memory document:
${currentDoc || "(empty)"}

Rules:
- Only output NEW facts not already captured in the document above
- Each fact is one short sentence, third person ("Uses React", "Lives in Berlin")
- Only save durable facts: name, job, projects, tools, preferences, people, interests, plans with dates
- Convert relative dates to absolute ("next week" → the actual date)
- Do NOT save: conversation-specific context, vague style observations, things the user merely asked about, transient tasks
- If nothing new is worth remembering, return exactly: NONE

Return one fact per line. No bullets, no numbering, no explanation. Just the new facts or NONE.`,
      messages: [
        {
          role: "user",
          content: `User: ${userMessage}\nAssistant: ${assistantMessage.slice(0, 2000)}`,
        },
      ],
      maxOutputTokens: 300,
      temperature: 0.1,
    }, {
      userId,
      conversationId,
      type: "memory_extraction",
      model: MEMORY_MODEL,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/^```\w*\n?|```$/g, "")
      .trim();

    if (!cleaned || cleaned === "NONE" || cleaned === "(empty)") {
      maybeOrganize(userId).catch(console.error);
      return;
    }

    const newDoc = currentDoc
      ? `${currentDoc}\n${cleaned}`
      : cleaned;

    await setMemoryDocument(userId, newDoc);
    maybeOrganize(userId).catch(console.error);
  } catch (error) {
    console.error("Memory extraction failed:", error);
  }
}

/**
 * Immediately append to memory when user explicitly says "remember this".
 */
export async function extractImmediateMemory(
  userId: string,
  conversationId: string,
  userMessage: string
): Promise<void> {
  try {
    const currentDoc = await getMemoryDocument(userId);
    const openrouter = getOpenRouter();

    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `The user explicitly asked you to remember something. Extract what they want remembered as one or two concise sentences in third person.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Return just the fact(s) to add. No explanation, no markdown.`,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      maxOutputTokens: 200,
      temperature: 0.1,
    }, {
      userId,
      conversationId,
      type: "immediate_memory",
      model: MEMORY_MODEL,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/^```\w*\n?|```$/g, "")
      .trim();

    if (!cleaned) return;

    const newDoc = currentDoc
      ? `${currentDoc}\n${cleaned}`
      : cleaned;

    await setMemoryDocument(userId, newDoc);
  } catch (error) {
    console.error("Immediate memory extraction failed:", error);
  }
}

// ─── Auto-Organization ─────────────────────────────────────────────

/**
 * Silently reorganize the memory document every ORGANIZE_INTERVAL extractions.
 * Merges duplicates, removes outdated info, improves wording.
 */
async function maybeOrganize(userId: string): Promise<void> {
  const current = organizeCounters.get(userId) || 0;
  const next = current + 1;
  organizeCounters.set(userId, next);

  if (next % ORGANIZE_INTERVAL !== 0) return;

  const doc = await getMemoryDocument(userId);
  if (!doc || doc.split("\n").filter(Boolean).length < 5) return;

  const openrouter = getOpenRouter();
  const { text } = await trackedGenerateText({
    model: openrouter(ORGANIZE_MODEL),
    system: `You are reorganizing a user's memory document. Rewrite it to be cleaner and more concise.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Rules:
- Merge duplicate or near-duplicate facts into one
- Remove facts that are clearly outdated (past events, expired plans)
- Keep the same style: one fact per line, third person, concise
- Do NOT add new information — only reorganize what's there
- Do NOT remove facts that are still relevant (preferences, identity, ongoing projects)
- Output the cleaned document directly. No explanation, no markdown fences.`,
    messages: [{ role: "user", content: doc }],
    maxOutputTokens: 1500,
    temperature: 0.1,
  }, {
    userId,
    type: "consolidation",
    model: ORGANIZE_MODEL,
  });

  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^```\w*\n?|```$/g, "")
    .trim();

  if (cleaned && cleaned.length > 10) {
    await setMemoryDocument(userId, cleaned);
  }
}

// ─── Memory Injection ───────────────────────────────────────────────

/**
 * Get memory for injection into system prompt.
 */
export async function getRelevantMemories(userId: string): Promise<string> {
  try {
    const doc = await getMemoryDocument(userId);
    if (!doc) return "";

    // Cap at ~2000 chars to keep prompt reasonable
    const trimmed = doc.length > 2000 ? doc.slice(0, 2000) + "..." : doc;

    return `\n\nAbout this user (from previous conversations):\n${trimmed}\nUse this knowledge naturally. Don't announce that you remember things. Just be contextually aware.`;
  } catch (error) {
    console.error("Failed to load memories:", error);
    return "";
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Get conversation summary for the current conversation.
 */
export async function getConversationSummary(
  conversationId: string
): Promise<string> {
  try {
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      columns: { summary: true },
    });

    if (!conv?.summary) return "";

    return `\n\nCurrent conversation context:\n${conv.summary}`;
  } catch (error) {
    console.error("Failed to load conversation summary:", error);
    return "";
  }
}

/**
 * Get user preferences for system prompt injection
 */
export async function getUserPreferences(
  userId: string
): Promise<string> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user?.preferences) return "";

    const prefs = user.preferences;
    const parts: string[] = [];

    if (prefs.responseStyle === "concise") {
      parts.push("The user prefers concise, to-the-point responses. Keep answers brief.");
    } else if (prefs.responseStyle === "detailed") {
      parts.push(
        "The user prefers detailed, thorough responses with full explanations."
      );
    }

    if (prefs.language) {
      parts.push(`Respond in ${prefs.language} unless the user writes in another language.`);
    }

    if (prefs.customInstructions) {
      parts.push(`\n## Custom instructions from user:\n${prefs.customInstructions}`);
    }

    if (parts.length === 0) return "";

    return "\n\n## User preferences:\n" + parts.join("\n");
  } catch (error) {
    console.error("Failed to load user preferences:", error);
    return "";
  }
}
