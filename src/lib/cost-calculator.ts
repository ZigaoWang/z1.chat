import { getCachedModels, getModelPricing } from "./models-cache";

const SEARCH_COST_USD = parseFloat(process.env.SEARCH_COST_USD || "0.01");
const COST_MARKUP = parseFloat(process.env.COST_MARKUP || "1.1");

// Types that are billed to the user (vs background tasks that are free)
const BILLABLE_TYPES = new Set(["chat", "search"]);

/**
 * Calculate cost for an AI call.
 * OpenRouter pricing is per-token (prompt/completion fields are cost per token).
 */
export async function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  try {
    const models = await getCachedModels();
    const pricing = getModelPricing(models, modelId);
    if (!pricing) return 0;

    return (
      inputTokens * pricing.promptPrice +
      outputTokens * pricing.completionPrice
    );
  } catch {
    return 0;
  }
}

/**
 * Calculate the user-facing cost with markup.
 * Only billable types (chat, search) are charged; background tasks are free.
 */
export function calculateUserCost(rawCost: number, type: string): number {
  if (!BILLABLE_TYPES.has(type)) return 0;
  return rawCost * COST_MARKUP;
}

export function getSearchCost(): number {
  return SEARCH_COST_USD;
}

export function getCostMarkup(): number {
  return COST_MARKUP;
}
