export { en, type TranslationKey } from "./en";
export { zh } from "./zh";

import { en } from "./en";
import { zh } from "./zh";
import type { TranslationKey } from "./en";

const dictionaries = { en, zh } as const;
type Locale = keyof typeof dictionaries;

/**
 * Map the user's language preference (from settings) to a locale key.
 * Settings stores: "English", "Chinese", "Auto-detect" / null, etc.
 */
export function resolveLocale(language: string | null | undefined): Locale {
  if (!language) return "en";
  const l = language.toLowerCase();
  if (l === "chinese" || l === "zh" || l === "中文") return "zh";
  return "en";
}

/**
 * Get the translation function for a given locale.
 */
export function getTranslator(locale: Locale) {
  const dict = dictionaries[locale] || en;
  return function t(key: TranslationKey, params?: Record<string, string | number>): string {
    let text = dict[key] || en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  };
}
