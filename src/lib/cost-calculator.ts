import { Decimal } from "decimal.js";
import { getCachedModels, getModelPricing } from "./models-cache";

const SEARCH_COST_USD = process.env.SEARCH_COST_USD || "0.01";
const COST_MARKUP = process.env.COST_MARKUP || "1.1";

// Types that are billed to the user (vs background tasks that are free)
const BILLABLE_TYPES = new Set(["chat", "search"]);

/**
 * Calculate cost for an AI call using arbitrary-precision arithmetic.
 * OpenRouter pricing is per-token (prompt/completion fields are cost per token).
 * Returns a decimal string for lossless DB storage.
 */
export async function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): Promise<string> {
  try {
    const models = await getCachedModels();
    const pricing = getModelPricing(models, modelId);
    if (!pricing) return "0";

    const inputCost = new Decimal(pricing.promptPrice).times(inputTokens);
    const outputCost = new Decimal(pricing.completionPrice).times(outputTokens);
    return inputCost.plus(outputCost).toString();
  } catch {
    return "0";
  }
}

/**
 * Calculate the user-facing cost with markup.
 * Only billable types (chat, search) are charged; background tasks are free.
 * Takes and returns decimal strings.
 */
export function calculateUserCost(rawCost: string, type: string): string {
  if (!BILLABLE_TYPES.has(type)) return "0";
  return new Decimal(rawCost).times(COST_MARKUP).toString();
}

export function getSearchCost(): string {
  return SEARCH_COST_USD;
}

export function getCostMarkup(): number {
  return parseFloat(COST_MARKUP);
}
