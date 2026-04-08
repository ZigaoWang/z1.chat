import { OPENROUTER_MODELS_URL, MODELS_CACHE_TTL } from "./constants";

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  top_provider?: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type: string;
  };
}

interface CachedModels {
  data: OpenRouterModel[];
  fetchedAt: number;
}

let modelsCache: CachedModels | null = null;

export async function getCachedModels(): Promise<OpenRouterModel[]> {
  if (modelsCache && Date.now() - modelsCache.fetchedAt < MODELS_CACHE_TTL) {
    return modelsCache.data;
  }

  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    },
  });

  if (!res.ok) {
    if (modelsCache) return modelsCache.data;
    throw new Error(`OpenRouter API returned ${res.status}`);
  }

  const { data } = await res.json();
  const chatModels = (data as OpenRouterModel[]).filter(
    (m) => m.architecture?.instruct_type || m.name
  );

  modelsCache = { data: chatModels, fetchedAt: Date.now() };
  return chatModels;
}

/**
 * Get pricing for a specific model. Returns per-token prices.
 * OpenRouter pricing is per 1M tokens, so these are already per-token.
 */
export function getModelPricing(
  models: OpenRouterModel[],
  modelId: string
): { promptPrice: number; completionPrice: number } | null {
  const model = models.find((m) => m.id === modelId);
  if (!model) return null;
  return {
    promptPrice: parseFloat(model.pricing.prompt) || 0,
    completionPrice: parseFloat(model.pricing.completion) || 0,
  };
}
