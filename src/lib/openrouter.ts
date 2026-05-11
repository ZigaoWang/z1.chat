import { createOpenRouter } from "@openrouter/ai-sdk-provider";

let openrouterInstance: ReturnType<typeof createOpenRouter> | null = null;

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OpenRouter API key is not configured. Add OPENROUTER_API_KEY to .env.local"
    );
  }

  if (!openrouterInstance) {
    openrouterInstance = createOpenRouter({ apiKey });
  }

  return openrouterInstance;
}

// Cheap fast model for title generation
export const TITLE_MODEL = process.env.TITLE_MODEL || "openai/gpt-5.4-nano";
// Model for memory extraction and summarization
export const MEMORY_MODEL = process.env.MEMORY_MODEL || "openai/gpt-5.4-mini";
// Model for memory organization — fast, good at structured rewriting
export const ORGANIZE_MODEL = process.env.ORGANIZE_MODEL || "google/gemini-3-flash-preview";
// Model for context compaction — can be same as MEMORY_MODEL or a cheaper one
export const CONTEXT_MODEL = process.env.CONTEXT_MODEL || "openai/gpt-5.4-nano";
