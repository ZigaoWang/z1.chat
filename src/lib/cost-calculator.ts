import { Decimal } from "decimal.js";
import { getCachedModels, getModelPricing } from "./models-cache";

// Tavily basic search = 1 credit = $0.008
const SEARCH_COST_USD = process.env.SEARCH_COST_USD || "0.008";
const COST_MARKUP = process.env.COST_MARKUP || "1.1";

/**
 * Calculate raw cost for an AI call using arbitrary-precision arithmetic.
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
 * Apply markup to raw cost to get the user-facing charge.
 * All usage types are charged — raw cost * COST_MARKUP (default 1.1x).
 * Takes and returns decimal strings.
 */
export function calculateUserCost(rawCost: string): string {
  return new Decimal(rawCost).times(COST_MARKUP).toString();
}

export function getSearchCost(): string {
  return SEARCH_COST_USD;
}

const CODE_EXEC_COST_USD = process.env.CODE_EXEC_COST_USD || "0.005";

export function getCodeExecCost(): string {
  return CODE_EXEC_COST_USD;
}
