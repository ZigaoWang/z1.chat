export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "One";
export const APP_TAGLINE = "The last AI app you'll ever download.";

export const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_MODEL || "anthropic/claude-opus-4.6";

export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export const CREDIT_MARGIN = 0.2; // 20% margin on top of OpenRouter costs

export const CREDIT_PACKS = [
  { amount: 500, price: 5, label: "$5" },
  { amount: 1000, price: 10, label: "$10" },
  { amount: 2000, price: 20, label: "$20" },
  { amount: 5000, price: 50, label: "$50" },
] as const;

export const MAX_MEMORIES_PER_REQUEST = 10;
export const MAX_CONTEXT_MEMORIES = 15;

// How many assistant messages between conversation summary updates
export const SUMMARY_UPDATE_INTERVAL = 3;

// Context compaction: max tokens before compacting older messages.
// 4 chars ≈ 1 token. Leave room for the response and system prompt.
export const MAX_CONTEXT_TOKENS = parseInt(process.env.MAX_CONTEXT_TOKENS || "80000");

// How many recent messages to keep un-compacted (preserve as raw conversation)
export const COMPACTION_KEEP_RECENT = 10;

export const MODELS_CACHE_TTL = 1000 * 60 * 60; // 1 hour

// File upload limits
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_TEXT_PER_FILE = 100_000; // chars
export const MAX_TOTAL_ATTACHMENT_TEXT = 200_000; // chars
export const MAX_FILES_PER_MESSAGE = 10;

// Skills: max number of skill prompts injected per message
export const MAX_SKILLS_PER_MESSAGE = 3;

// E2B code execution cost per run
export const CODE_EXEC_COST_USD = process.env.CODE_EXEC_COST_USD || "0.005";
