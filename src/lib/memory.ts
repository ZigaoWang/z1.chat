import { getOpenRouter, MEMORY_MODEL } from "./openrouter";
import { db } from "./db";
import { memories, conversations, messages, users } from "./db/schema";
import { eq, desc, and, count, lt, sql } from "drizzle-orm";
import { MAX_CONTEXT_MEMORIES, SUMMARY_UPDATE_INTERVAL } from "./constants";
import { trackedGenerateText } from "./usage-logger";

// How many conversations between automatic memory consolidation runs
const CONSOLIDATION_INTERVAL = 10;
const MAX_RETRIES = 1;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// ─── Layer 2: User Memory ───────────────────────────────────────────

interface ExtractedMemory {
  category: "personal" | "preferences" | "projects" | "style" | "facts";
  content: string;
}

interface DeduplicationAction {
  action: "insert" | "update" | "merge" | "skip";
  newContent: string;
  existingId?: string;
  category: string;
}

/**
 * Extract durable user memories from a conversation exchange.
 * Runs async in the background, never blocks chat.
 */
export async function extractMemories(
  userId: string,
  conversationId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const openrouter = getOpenRouter();
      if (attempt === 0) {
        console.log(`[memory] Extracting memories using model: ${MEMORY_MODEL}`);
      } else {
        console.log(`[memory] Retry attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
      }

    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `You are a memory extraction system. Analyze this conversation and extract specific, concrete, durable facts that would be useful in FUTURE conversations.

Save things like:
- User's name, age, location, school, job, company
- Specific projects (name, tech stack, goals, URLs)
- Tools, languages, and technologies they use
- People they mention by name and relationship
- Strong opinions or preferences they've explicitly stated
- Hobbies, interests, side projects, creative pursuits
- Equipment, gear, or tools they own or use (cameras, lenses, instruments, etc.)
- Websites, blogs, social media they own or maintain
- Knowledge topics they're actively learning or passionate about
- Specific factual knowledge they demonstrated or discussed in depth

IMPORTANT: Focus on CONCRETE facts, not vague style observations.

GOOD examples:
- "Shoots Ferrania P30 black-and-white film"
- "Interested in film photography"
- "Uses a Leica M6 camera"
- "Name is John, lives in Berlin"
- "Building a Next.js chat app called One"

BAD examples — DO NOT SAVE these:
- "Prefers short explanations" (vague style observation)
- "Likes Wikipedia-style answers" (inferred communication style)
- "Asked about film photography" (temporary context)
- "Prefers concise responses" (vague)

The "style" category should ONLY be used for EXPLICIT requests like "always respond in bullet points" or "use formal language with me". NEVER infer style from how the user phrases one question.

Each memory must have:
- category: "personal" | "preferences" | "projects" | "style" | "facts"
- content: A concise, specific statement

If nothing is worth saving long-term, return an empty array. Be very selective.

Return valid JSON array only. No markdown, no explanation, no thinking.`,
      messages: [
        {
          role: "user",
          content: `User: ${userMessage}\n\nAssistant: ${assistantMessage.slice(0, 3000)}`,
        },
      ],
      maxOutputTokens: 500,
      temperature: 0.1,
    }, {
      userId,
      conversationId,
      type: "memory_extraction",
      model: MEMORY_MODEL,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .replace(/^```json\n?|```$/g, "");
    let extracted: ExtractedMemory[];
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      return;
    }

    if (!Array.isArray(extracted) || extracted.length === 0) return;

    const existingMemories = await db
      .select({
        id: memories.id,
        category: memories.category,
        content: memories.content,
      })
      .from(memories)
      .where(eq(memories.userId, userId));

    for (const mem of extracted) {
      if (!mem.content || !mem.category) continue;

      const action = await deduplicateMemory(
        mem,
        existingMemories,
        openrouter,
        userId,
        conversationId
      );

      switch (action.action) {
        case "insert":
          await db.insert(memories).values({
            userId,
            category: mem.category,
            content: action.newContent,
            sourceConversationId: conversationId,
            relevanceScore: getCategoryRelevance(mem.category),
          });
          break;

        case "update":
        case "merge":
          if (action.existingId) {
            await db
              .update(memories)
              .set({
                content: action.newContent,
                sourceConversationId: conversationId,
                updatedAt: new Date(),
              })
              .where(eq(memories.id, action.existingId));
          }
          break;

        case "skip":
          break;
      }
    }

    // Trigger consolidation periodically
    maybeConsolidate(userId).catch(console.error);
    return; // Success — exit retry loop
  } catch (error) {
    console.error(
      `[memory] Extraction attempt ${attempt + 1} failed:`,
      error instanceof Error ? error.message : error
    );
    if (attempt < MAX_RETRIES) {
      await sleep(1500);
    }
  }
  } // end retry loop
}

/**
 * Determine if a new memory is a duplicate, update, merge, or genuinely new.
 */
async function deduplicateMemory(
  newMem: ExtractedMemory,
  existing: { id: string; category: string; content: string }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  openrouter: any,
  userId?: string,
  conversationId?: string
): Promise<DeduplicationAction> {
  if (existing.length === 0) {
    return { action: "insert", newContent: newMem.content, category: newMem.category };
  }

  const exactMatch = existing.find(
    (e) => e.content.toLowerCase() === newMem.content.toLowerCase()
  );
  if (exactMatch) {
    return { action: "skip", newContent: "", category: newMem.category };
  }

  const sameCategoryMemories = existing.filter(
    (e) => e.category === newMem.category
  );

  if (sameCategoryMemories.length === 0) {
    return { action: "insert", newContent: newMem.content, category: newMem.category };
  }

  const existingList = sameCategoryMemories
    .map((e, i) => `[${i}] (id: ${e.id}) ${e.content}`)
    .join("\n");

  try {
    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `You are a memory deduplication system. Compare the new memory against existing memories and decide the action.

Return JSON only:
- {"action": "skip"} — if the new memory is already captured (same fact, different wording)
- {"action": "update", "existingIndex": N, "mergedContent": "..."} — if the new memory contradicts or supersedes an existing one (e.g. user changed jobs). Provide the updated content.
- {"action": "merge", "existingIndex": N, "mergedContent": "..."} — if the new memory adds detail to an existing one about the same topic. Provide the combined content.
- {"action": "insert"} — if the new memory is genuinely new information

Be conservative. When in doubt, insert rather than skip.`,
      messages: [
        {
          role: "user",
          content: `Existing memories:\n${existingList}\n\nNew memory: ${newMem.content}`,
        },
      ],
      maxOutputTokens: 200,
      temperature: 0,
    }, {
      userId: userId || "system",
      conversationId,
      type: "memory_dedup",
      model: MEMORY_MODEL,
    });

    const result = JSON.parse(
      text.replace(/<think>[\s\S]*?<\/think>/g, "").trim().replace(/^```json\n?|```$/g, "")
    );

    if (result.action === "skip") {
      return { action: "skip", newContent: "", category: newMem.category };
    }

    if (
      (result.action === "update" || result.action === "merge") &&
      result.existingIndex !== undefined
    ) {
      const target = sameCategoryMemories[result.existingIndex];
      if (target) {
        return {
          action: result.action,
          newContent: result.mergedContent || newMem.content,
          existingId: target.id,
          category: newMem.category,
        };
      }
    }

    return { action: "insert", newContent: newMem.content, category: newMem.category };
  } catch {
    return { action: "insert", newContent: newMem.content, category: newMem.category };
  }
}

function getCategoryRelevance(category: string): number {
  switch (category) {
    case "personal": return 1.0;
    case "projects": return 0.9;
    case "preferences": return 0.7;
    case "style": return 0.6;
    case "facts": return 0.5;
    default: return 0.5;
  }
}

// ─── Layer 3: Memory Consolidation (Human-like) ─────────────────────

// Track conversation count for consolidation trigger (in-memory counter per user)
const consolidationCounters = new Map<string, number>();

/**
 * Check if it's time to consolidate, and do so if needed.
 * Runs every CONSOLIDATION_INTERVAL conversations per user.
 */
async function maybeConsolidate(userId: string): Promise<void> {
  const current = (consolidationCounters.get(userId) || 0) + 1;
  consolidationCounters.set(userId, current);

  if (current % CONSOLIDATION_INTERVAL !== 0) return;

  await consolidateMemories(userId);
}

/**
 * Consolidate memories: merge similar ones, decay stale ones, rewrite messy ones,
 * delete trivial ones. Like a human brain during sleep — organize and clean up.
 *
 * This is the "forgetting + strengthening" pass that keeps memory lean and useful.
 */
export async function consolidateMemories(userId: string): Promise<void> {
  try {
    const allMemories = await db
      .select({
        id: memories.id,
        category: memories.category,
        content: memories.content,
        relevanceScore: memories.relevanceScore,
        accessCount: memories.accessCount,
        lastAccessedAt: memories.lastAccessedAt,
        createdAt: memories.createdAt,
        updatedAt: memories.updatedAt,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.relevanceScore));

    if (allMemories.length < 5) return; // Not enough to bother

    // Step 1: Decay stale memories (not accessed in 30+ days, low access count)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const mem of allMemories) {
      const isStale = !mem.lastAccessedAt || mem.lastAccessedAt < thirtyDaysAgo;
      const isLowUse = (mem.accessCount || 0) < 3;
      const isNotCritical = mem.category !== "personal";

      if (isStale && isLowUse && isNotCritical) {
        // Decay: reduce relevance score
        const newScore = Math.max(0.1, (mem.relevanceScore || 0.5) - 0.15);
        await db
          .update(memories)
          .set({ relevanceScore: newScore })
          .where(eq(memories.id, mem.id));
      }
    }

    // Step 2: Strengthen frequently accessed memories
    for (const mem of allMemories) {
      if ((mem.accessCount || 0) >= 5) {
        const boost = Math.min(1.0, (mem.relevanceScore || 0.5) + 0.1);
        if (boost > (mem.relevanceScore || 0.5)) {
          await db
            .update(memories)
            .set({ relevanceScore: boost })
            .where(eq(memories.id, mem.id));
        }
      }
    }

    // Step 3: Delete very low relevance memories (decayed to near-zero)
    await db
      .delete(memories)
      .where(
        and(
          eq(memories.userId, userId),
          lt(memories.relevanceScore, 0.15)
        )
      );

    // Step 4: LLM-powered consolidation — merge, rewrite, clean up
    // Re-fetch after decay/deletion
    const remaining = await db
      .select({
        id: memories.id,
        category: memories.category,
        content: memories.content,
        accessCount: memories.accessCount,
        relevanceScore: memories.relevanceScore,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.relevanceScore));

    if (remaining.length < 3) return;

    const memoryList = remaining
      .map((m, i) => `[${i}] (id: ${m.id}, category: ${m.category}, uses: ${m.accessCount || 0}, score: ${(m.relevanceScore || 0.5).toFixed(2)}) ${m.content}`)
      .join("\n");

    const openrouter = getOpenRouter();
    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `You are a memory consolidation system, like a human brain organizing memories during sleep. Review all memories and return a list of actions to keep them clean, useful, and well-organized.

Your goals:
1. **Merge** memories about the same topic into one clear memory (e.g. two memories about the user's job → one comprehensive one)
2. **Rewrite** awkwardly worded memories to be clearer and more natural
3. **Delete** memories that are trivial, redundant after merging, or no longer useful
4. **Keep** important identity, project, and preference memories untouched

Rules:
- Personal identity memories (name, job, location) are sacred — never delete, only improve wording
- Frequently used memories (high "uses" count) are important — strengthen, don't delete
- Merge related memories across categories if they're about the same topic
- If two memories say basically the same thing, merge into the better one and delete the other
- Rewrite should make memories sound natural and concise, like how a friend would remember facts about someone

Return a JSON array of actions:
- {"action": "merge", "keepIndex": N, "deleteIndex": M, "newContent": "merged content"}
- {"action": "rewrite", "index": N, "newContent": "improved wording"}
- {"action": "delete", "index": N, "reason": "why"}

If everything looks good, return an empty array. Be judicious — don't change things that are already fine.

Return valid JSON array only. No markdown.`,
      messages: [
        {
          role: "user",
          content: `All memories:\n${memoryList}`,
        },
      ],
      maxOutputTokens: 800,
      temperature: 0.1,
    }, {
      userId,
      type: "consolidation",
      model: MEMORY_MODEL,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .replace(/^```json\n?|```$/g, "");
    let actions: Array<{
      action: string;
      keepIndex?: number;
      deleteIndex?: number;
      index?: number;
      newContent?: string;
      reason?: string;
    }>;
    try {
      actions = JSON.parse(cleaned);
    } catch {
      return;
    }

    if (!Array.isArray(actions) || actions.length === 0) return;

    const deletedIds = new Set<string>();

    for (const act of actions) {
      switch (act.action) {
        case "merge": {
          const keep = remaining[act.keepIndex!];
          const del = remaining[act.deleteIndex!];
          if (keep && del && !deletedIds.has(keep.id) && !deletedIds.has(del.id)) {
            await db
              .update(memories)
              .set({
                content: act.newContent || keep.content,
                accessCount: (keep.accessCount || 0) + (del.accessCount || 0),
                updatedAt: new Date(),
              })
              .where(eq(memories.id, keep.id));
            await db.delete(memories).where(eq(memories.id, del.id));
            deletedIds.add(del.id);
          }
          break;
        }
        case "rewrite": {
          const mem = remaining[act.index!];
          if (mem && act.newContent && !deletedIds.has(mem.id)) {
            await db
              .update(memories)
              .set({ content: act.newContent, updatedAt: new Date() })
              .where(eq(memories.id, mem.id));
          }
          break;
        }
        case "delete": {
          const mem = remaining[act.index!];
          if (mem && !deletedIds.has(mem.id)) {
            // Don't delete personal memories
            if (mem.category === "personal") break;
            await db.delete(memories).where(eq(memories.id, mem.id));
            deletedIds.add(mem.id);
          }
          break;
        }
      }
    }

    console.log(`Memory consolidation for user ${userId}: ${actions.length} actions applied`);
  } catch (error) {
    console.error("Memory consolidation failed:", error);
  }
}

// ─── Memory Injection ───────────────────────────────────────────────

/**
 * Get relevant memories for injection into system prompt.
 * Also tracks access: bumps accessCount and lastAccessedAt for used memories.
 */
export async function getRelevantMemories(userId: string): Promise<string> {
  try {
    const userMemories = await db
      .select({
        id: memories.id,
        category: memories.category,
        content: memories.content,
        relevanceScore: memories.relevanceScore,
      })
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.relevanceScore), desc(memories.updatedAt))
      .limit(MAX_CONTEXT_MEMORIES);

    if (userMemories.length === 0) return "";

    const memoryLines: string[] = [];
    const usedIds: string[] = [];

    // Cap at ~400 tokens (~1600 chars)
    let totalLen = 0;
    for (const m of userMemories) {
      const line = `- ${m.content}`;
      if (totalLen + line.length > 1600) break;
      memoryLines.push(line);
      usedIds.push(m.id);
      totalLen += line.length + 1;
    }

    if (memoryLines.length === 0) return "";

    // Background: bump access count for injected memories
    if (usedIds.length > 0) {
      db.update(memories)
        .set({
          accessCount: sql`COALESCE(${memories.accessCount}, 0) + 1`,
          lastAccessedAt: new Date(),
        })
        .where(
          and(
            eq(memories.userId, userId),
            sql`${memories.id} = ANY(${usedIds})`
          )
        )
        .execute()
        .catch(console.error);
    }

    return `\n\nAbout this user (from previous conversations):\n${memoryLines.join("\n")}\nUse this knowledge naturally. Don't announce that you remember things. Just be contextually aware.`;
  } catch (error) {
    console.error("Failed to load memories:", error);
    return "";
  }
}

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

/**
 * Immediately extract a memory when user explicitly says "remember this".
 */
export async function extractImmediateMemory(
  userId: string,
  conversationId: string,
  userMessage: string
): Promise<void> {
  try {
    const openrouter = getOpenRouter();

    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `The user has explicitly asked you to remember something. Extract exactly what they want remembered as a memory.

Return a JSON object with:
- category: "personal", "preferences", "projects", "style", or "facts"
- content: The specific thing to remember

Return valid JSON only, no markdown.`,
      messages: [
        { role: "user", content: userMessage },
      ],
      maxOutputTokens: 200,
      temperature: 0,
    }, {
      userId,
      conversationId,
      type: "immediate_memory",
      model: MEMORY_MODEL,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .replace(/^```json\n?|```$/g, "");
    const mem: ExtractedMemory = JSON.parse(cleaned);

    if (!mem.content || !mem.category) return;

    const existing = await db
      .select({ id: memories.id, content: memories.content })
      .from(memories)
      .where(
        and(eq(memories.userId, userId), eq(memories.category, mem.category))
      );

    const isDuplicate = existing.some(
      (e) => e.content.toLowerCase() === mem.content.toLowerCase()
    );

    if (!isDuplicate) {
      await db.insert(memories).values({
        userId,
        category: mem.category,
        content: mem.content,
        sourceConversationId: conversationId,
        relevanceScore: getCategoryRelevance(mem.category),
      });
    }
  } catch (error) {
    console.error("Immediate memory extraction failed:", error);
  }
}
