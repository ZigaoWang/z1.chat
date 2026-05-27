import { getOpenRouter, MEMORY_MODEL, ORGANIZE_MODEL } from "./openrouter";
import { db } from "./db";
import { conversations, messages, users } from "./db/schema";
import { eq, desc, and, count } from "drizzle-orm";
import { SUMMARY_UPDATE_INTERVAL } from "./constants";
import { trackedGenerateText } from "./usage-logger";

const ORGANIZE_INTERVAL = 10;
const organizeCounters = new Map<string, number>();

// ─── Layer 1: Conversation Summary ──────────────────────────────────

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

export async function getMemoryDocument(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { memoryDocument: true },
  });
  return user?.memoryDocument || "";
}

export async function setMemoryDocument(userId: string, content: string): Promise<void> {
  await db
    .update(users)
    .set({ memoryDocument: content, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Extract memories from a conversation and append to the memory document.
 * Runs async in the background after each assistant response.
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
      system: `You extract durable facts about a user from conversations. Only save what was explicitly stated — never infer, expand, or add context not present in the conversation.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Their current memory document:
${currentDoc || "(empty)"}

What to extract (only if explicitly stated):
- Identity: name, age, location, school, job, roles
- Projects: what they're building, tech stack, status, goals
- Skills & interests: languages, tools, hobbies, activities
- People & relationships: collaborators, teachers, teams
- Preferences: communication style, tools, workflows
- Plans & timelines: upcoming events, deadlines (convert relative dates to absolute)
- Achievements: awards, scores, milestones

What NOT to extract:
- Anything already in the document
- Transient context (debugging steps, temporary questions, test actions)
- Things the user asked about but didn't claim as their own (asking about a product ≠ owning it, wanting it, or having plans for it)
- Casual mentions without clear intent ("I was listening to X" is not worth saving)
- Content of artifacts or documents the AI created
- Anything you are inferring or extrapolating — only save what was directly said
- Vague observations without substance

CRITICAL: Copy facts verbatim from what was said. Do NOT add details, use cases, or context that weren't explicitly stated.

Output format: third person, concise sentences. If nothing new is worth saving, return exactly: NONE

Output only the new information to append. No bullets, no markdown, no explanation.`,
      messages: [
        {
          role: "user",
          content: `User: ${userMessage}\nAssistant: ${assistantMessage.slice(0, 2000)}`,
        },
      ],
      maxOutputTokens: 400,
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
      system: `The user explicitly asked you to remember something. Extract what they want remembered in third person. Be specific — include names, dates, details. Write 1-3 concise sentences capturing the information faithfully.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Output only the fact(s) to add. No explanation, no markdown.`,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
      maxOutputTokens: 300,
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
    system: getOrganizeSystemPrompt(),
    messages: [{ role: "user", content: doc }],
    maxOutputTokens: 3000,
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

  if (cleaned && cleaned.length > 50) {
    await setMemoryDocument(userId, cleaned);
  }
}

// ─── Shared Organize Prompt ───────────────────────────────────────

export function getOrganizeSystemPrompt(): string {
  return `You are reorganizing a user's memory document. This document is the AI's long-term memory of who the user is. It must be comprehensive, structured, and information-dense.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

OUTPUT FORMAT — follow this exactly:

The document must use SECTIONS with plain-text headers (no markdown, no bold, no #). Each section contains PROSE PARAGRAPHS — full sentences grouped into short paragraphs. NEVER use bullet points, numbered lists, or one-fact-per-line format.

Sections to use (include only those with content):

Work/School context
[1-2 paragraphs about their school/job, roles, teams, activities]

Personal context
[1-2 paragraphs about who they are — skills, interests, hobbies, key links, notable highlights]

Top of mind
[1-2 paragraphs about what they're actively working on, current projects, immediate goals]

Brief history
[Multiple paragraphs organized chronologically or thematically. Use sub-headers like "Recent months" and "Earlier context" if the history is long. Include specific details: project names, tech stacks, competition results with dates and scores, applications, events.]

Other instructions
[Any behavioral preferences for the AI — what to do, what to avoid]

CRITICAL RULES:
1. NEVER DROP INFORMATION. Every name, date, number, URL, score, project name, and specific detail from the input MUST appear in the output. If you're unsure whether something matters, KEEP IT.
2. Write in third person prose. Combine related facts into flowing sentences and paragraphs. "Zigao built X using Y and Z" not "Built X. Uses Y. Uses Z."
3. Merge true duplicates only. If two facts add different details about the same topic, combine them into one richer sentence — don't delete either.
4. Only remove information that is explicitly contradicted by newer information in the same document.
5. The output should be LONGER and MORE DETAILED than a flat list — paragraphs carry more information than bullet points.
6. ABSOLUTE PROHIBITION: Do NOT add ANY information not present verbatim in the input. No inferences ("likely X model"), no expansions ("for travel and late-night use"), no assumed context, no details you think might be true. Every word in the output must trace back to a word in the input.
7. Do NOT add meta-commentary about the document.
8. Output the document directly. No markdown fences, no preamble, no "Here's the reorganized document:".`;
}

// ─── Memory Injection ───────────────────────────────────────────────

export async function getRelevantMemories(userId: string): Promise<string> {
  try {
    const doc = await getMemoryDocument(userId);
    if (!doc) return "";

    const trimmed = doc.length > 2000 ? doc.slice(0, 2000) + "\n..." : doc;

    return `\n\nAbout this user (from previous conversations):\n${trimmed}\n\nUse this knowledge naturally. Don't announce that you remember things. Don't repeatedly reference the same facts. Only mention stored context when directly relevant to what the user is asking about.`;
  } catch (error) {
    console.error("Failed to load memories:", error);
    return "";
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

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
