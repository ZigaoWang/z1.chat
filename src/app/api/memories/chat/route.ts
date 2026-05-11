import { getCurrentUserId } from "@/lib/auth";
import { getOpenRouter, ORGANIZE_MODEL } from "@/lib/openrouter";
import { trackedStreamText } from "@/lib/usage-logger";
import { getMemoryDocument, setMemoryDocument } from "@/lib/memory";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const userId = await getCurrentUserId();
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const currentDoc = await getMemoryDocument(userId);

    if (!currentDoc && !message.toLowerCase().includes("add")) {
      return Response.json({ error: "No memories to manage." }, { status: 400 });
    }

    const openrouter = getOpenRouter();

    const result = trackedStreamText({
      model: openrouter(ORGANIZE_MODEL),
      system: `You manage a user's memory document. The user will give you an instruction about their memories.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Current memory document:
${currentDoc || "(empty)"}

Based on the user's instruction, output the UPDATED memory document.

Rules:
- If the user asks to delete something, remove it from the document
- If the user asks to update something, modify it in place
- If the user asks to add something, integrate it naturally into the appropriate section
- If the user asks to organize/clean up, restructure into clear sections with rich detail
- Preserve the document's structure (sections, paragraphs, prose style)
- PRESERVE ALL INFORMATION unless the user explicitly asks to remove something
- Write in third person, prose style. Keep specific details (names, dates, numbers, links).
- If no changes needed, output the document unchanged.
- Output the updated document directly. No explanation, no markdown fences, no preamble.`,
      messages: [{ role: "user", content: message }],
      maxOutputTokens: 3000,
      temperature: 0.1,
      onFinish: async (event) => {
        const cleaned = event.text
          .replace(/<think>[\s\S]*?<\/think>/g, "")
          .replace(/^```\w*\n?|```$/g, "")
          .trim();

        if (cleaned) {
          await setMemoryDocument(userId, cleaned);
        }
      },
    }, {
      userId,
      type: "memory_chat",
      model: ORGANIZE_MODEL,
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Memory chat error:", errMsg);
    return Response.json({ error: errMsg || "Failed to process request" }, { status: 500 });
  }
}
