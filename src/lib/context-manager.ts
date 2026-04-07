import { generateText } from "ai";
import { getOpenRouter, CONTEXT_MODEL } from "./openrouter";
import { db } from "./db";
import { conversations, messages } from "./db/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import { MAX_CONTEXT_TOKENS, COMPACTION_KEEP_RECENT } from "./constants";

/**
 * Estimate token count using simple heuristic: 4 chars ��� 1 token.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if a conversation needs compaction and perform it if necessary.
 * Runs BEFORE sending messages to OpenRouter. Modifies old messages in DB
 * by deleting them and storing a summary.
 */
export async function checkAndCompactConversation(
  conversationId: string
): Promise<boolean> {
  try {
    const allDbMessages = await db
      .select({
        role: messages.role,
        content: messages.content,
        id: messages.id,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt));

    if (allDbMessages.length === 0) return false;

    // Reverse to chronological order
    allDbMessages.reverse();

    // Estimate total tokens
    const totalTokens = allDbMessages.reduce(
      (sum, m) => sum + estimateTokens(m.content),
      0
    );

    // Not over limit
    if (totalTokens < MAX_CONTEXT_TOKENS) {
      return false;
    }

    // Determine which messages to keep vs summarize
    const recentCount = Math.min(COMPACTION_KEEP_RECENT, allDbMessages.length);
    const oldMessages = allDbMessages.slice(0, -recentCount);
    const recentMessages = allDbMessages.slice(-recentCount);

    if (oldMessages.length === 0) {
      return false;
    }

    // Generate summary of old messages
    const oldContent = oldMessages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const openrouter = getOpenRouter();
    const { text: summary } = await generateText({
      model: openrouter(CONTEXT_MODEL),
      system: `Create a detailed summary of this conversation so far. Summarize thoroughly so an AI reading only your summary plus recent messages can fully understand the context.

Include:
- What the user originally asked about or is working on
- Key decisions made and why
- Important facts, names, numbers, or details mentioned
- Current state (what's done, what's pending)
- User's preferences or constraints mentioned

Be specific and detailed. Keep it under 800 words.`,
      messages: [{ role: "user", content: oldContent }],
      maxOutputTokens: 1500,
      temperature: 0.2,
    });

    const summaryText = summary.trim();
    if (!summaryText) {
      return false;
    }

    // Delete old messages from DB
    const oldestRecentCreatedAt = recentMessages[0]?.createdAt;
    if (oldestRecentCreatedAt) {
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            lt(messages.createdAt, oldestRecentCreatedAt)
          )
        );
    }

    // Store summary on conversation record
    await db
      .update(conversations)
      .set({
        compactionSummary: summaryText,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return true;
  } catch (error) {
    console.error("Context compaction check failed:", error);
    return false;
  }
}

/**
 * Get the compaction summary for a conversation (if it exists).
 * Used during context injection into the system prompt.
 */
export async function getCompactionSummary(
  conversationId: string
): Promise<string> {
  try {
    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.id, conversationId),
      columns: { compactionSummary: true },
    });

    if (!conv?.compactionSummary) return "";

    return `\n\n[Earlier conversation context (summarized)]:\n${conv.compactionSummary}`;
  } catch (error) {
    console.error("Failed to load compaction summary:", error);
    return "";
  }
}
