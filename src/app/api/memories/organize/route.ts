import { getCurrentUserId } from "@/lib/auth";
import { getOpenRouter, ORGANIZE_MODEL } from "@/lib/openrouter";
import { trackedStreamText } from "@/lib/usage-logger";
import { getMemoryDocument, setMemoryDocument } from "@/lib/memory";

export const maxDuration = 60;

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    const currentDoc = await getMemoryDocument(userId);

    if (!currentDoc || !currentDoc.trim()) {
      return Response.json({ error: "No memories to organize." }, { status: 400 });
    }

    const openrouter = getOpenRouter();

    const result = trackedStreamText({
      model: openrouter(ORGANIZE_MODEL),
      system: `You reorganize a user's memory document. Rewrite it to be cleaner and more concise.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Rules:
- Merge duplicate or near-duplicate facts into one
- Remove facts that are clearly outdated (past events, expired plans)
- Group related facts together (personal info, preferences, projects, etc.)
- Keep the same style: one fact per line, third person, concise
- Do NOT add new information — only reorganize what's there
- Do NOT remove facts that are still relevant (preferences, identity, ongoing projects)
- Output the cleaned document directly. No explanation, no markdown fences, no headers.`,
      messages: [{ role: "user", content: currentDoc }],
      maxOutputTokens: 1500,
      temperature: 0.1,
      onFinish: async (event) => {
        const cleaned = event.text
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .replace(/^```\w*\n?|```$/g, "")
          .trim();

        if (cleaned && cleaned.length > 10) {
          await setMemoryDocument(userId, cleaned);
        }
      },
    }, {
      userId,
      type: "consolidation",
      model: ORGANIZE_MODEL,
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Memory organize error:", errMsg);
    return Response.json({ error: errMsg || "Failed to organize" }, { status: 500 });
  }
}
