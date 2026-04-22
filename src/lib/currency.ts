/**
 * Currency configuration — single source of truth.
 *
 * All user-facing amounts are in CNY.
 * Raw API costs (OpenRouter, Tavily, E2B) are in USD internally.
 */

/** USD to CNY exchange rate. Override via env var if needed. */
export const USD_TO_CNY = parseFloat(process.env.NEXT_PUBLIC_USD_TO_CNY || "7");

/** Format a CNY amount for display */
export function formatCNY(amount: number, decimals = 2): string {
  return `\u00A5${amount.toFixed(decimals)}`;
}

/** Convert USD to CNY */
export function usdToCny(usd: number): number {
  return usd * USD_TO_CNY;
}
