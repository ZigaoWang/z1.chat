import { generateText } from "ai";
import { getOpenRouter, TITLE_MODEL } from "@/lib/openrouter";
import { getRelevantMemories } from "@/lib/memory";
import { getCurrentUserId } from "@/lib/auth";

export async function GET() {
  try {
    const userId = getCurrentUserId();
    const memories = await getRelevantMemories(userId);
    const openrouter = getOpenRouter();

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const { text } = await generateText({
      model: openrouter(TITLE_MODEL),
      system: `Generate a welcome screen for an AI chat app. Return JSON only, no markdown.

Format:
{
  "greeting": "A short, creative one-liner (under 8 words). Can be witty, philosophical, warm, or playful. NOT 'Good morning' or 'How can I help'. Think more like fortune cookies, shower thoughts, or clever observations. Examples: 'Your ideas deserve better than a search bar', 'Let's make something interesting today', 'Ask me anything. Seriously, anything.'",
  "suggestions": ["4 specific conversation starters, each under 50 chars. Be creative and varied — one fun, one useful, one curious, one productive."]
}

It is ${timeOfDay}. Be fresh and original — never repeat yourself. No thinking tags.`,
      messages: [
        {
          role: "user",
          content: memories
            ? `About this user:\n${memories}\n\nMake 1-2 suggestions personalized to them.`
            : "New user. Make it welcoming.",
        },
      ],
      maxOutputTokens: 300,
      temperature: 1.0,
    });

    const cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .trim()
      .replace(/^```json\n?|```$/g, "");

    const result = JSON.parse(cleaned);

    if (result.greeting && Array.isArray(result.suggestions)) {
      return Response.json({
        greeting: String(result.greeting).slice(0, 100),
        suggestions: result.suggestions.slice(0, 4).map((s: unknown) => String(s).slice(0, 80)),
      });
    }

    return Response.json(null);
  } catch (error) {
    console.error("[suggestions] Failed:", error);
    return Response.json(null);
  }
}
