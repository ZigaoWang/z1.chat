import { getCurrentUserId } from "@/lib/auth";
import { getOpenRouter, MEMORY_MODEL } from "@/lib/openrouter";
import { trackedGenerateText } from "@/lib/usage-logger";
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
      return Response.json({ summary: "No memories to manage.", document: "" });
    }

    const openrouter = getOpenRouter();
    const { text } = await trackedGenerateText({
      model: openrouter(MEMORY_MODEL),
      system: `You manage a user's memory document. The user will give you an instruction about their memories.

Current date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Current memory document:
${currentDoc || "(empty)"}

Based on the user's instruction, return a JSON object:
{
  "document": "the updated memory document text",
  "summary": "Brief description of what you changed (1 sentence, same language as user)"
}

Rules:
- If the user asks to delete something, remove it from the document
- If the user asks to update something, modify it in place
- If the user asks to add something, append it naturally
- If the user asks to organize/clean up, rewrite the document to be cleaner and remove outdated info
- Keep the same concise style: one fact per sentence, third person
- If no changes needed, return the document unchanged with an explanatory summary

Return valid JSON only. No markdown fences, no explanation outside the JSON.`,
      messages: [{ role: "user", content: message }],
      maxOutputTokens: 1500,
      temperature: 0.1,
    }, {
      userId,
      type: "memory_chat",
      model: MEMORY_MODEL,
    });

    let cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .replace(/^```(?:json)?\s*\n?/gm, "")
      .replace(/\n?```\s*$/gm, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    let result: { document: string; summary: string };

    try {
      result = JSON.parse(cleaned);
    } catch {
      console.error("[memory-chat] Failed to parse:", cleaned.slice(0, 500));
      return Response.json({ summary: "Could not process the request. Try again.", document: currentDoc });
    }

    if (result.document !== undefined) {
      await setMemoryDocument(userId, result.document);
    }

    return Response.json({
      summary: result.summary || "Done",
      document: result.document ?? currentDoc,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Memory chat error:", errMsg);
    return Response.json({ error: errMsg || "Failed to process request" }, { status: 500 });
  }
}
