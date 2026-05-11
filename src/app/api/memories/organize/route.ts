import { getCurrentUserId } from "@/lib/auth";
import { getOpenRouter, ORGANIZE_MODEL } from "@/lib/openrouter";
import { trackedStreamText } from "@/lib/usage-logger";
import { getMemoryDocument, setMemoryDocument, getOrganizeSystemPrompt } from "@/lib/memory";

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
      system: getOrganizeSystemPrompt(),
      messages: [{ role: "user", content: currentDoc }],
      maxOutputTokens: 3000,
      temperature: 0.1,
      onFinish: async (event) => {
        const cleaned = event.text
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .replace(/^```\w*\n?|```$/g, "")
          .trim();

        if (cleaned && cleaned.length > 50) {
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
