"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { en, type TranslationKey } from "@/lib/i18n/en";
import { zh } from "@/lib/i18n/zh";

type Locale = "en" | "zh";

const dictionaries = { en, zh } as const;

function translate(locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  const dict = dictionaries[locale] || en;
  let text = dict[key] || en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

interface I18nContextValue {
  locale: Locale;
  t: TFunction;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "en",
  t: (key) => en[key] || key,
  setLocale: () => {},
});

/**
 * Detect locale from browser or user settings.
 * Priority: user settings language > browser language > "en"
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || "";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

function languagePrefToLocale(language: string | null | undefined): Locale | null {
  if (!language) return null;
  const l = language.toLowerCase();
  if (l === "chinese" || l === "zh" || l === "中文") return "zh";
  if (l === "english" || l === "en") return "en";
  return null; // "Auto-detect" or unknown → fall through to browser
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Start with browser locale
    setLocaleState(detectBrowserLocale());

    // Then try to get user's language preference from settings
    fetch("/api/settings")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.preferences?.language) {
          const userLocale = languagePrefToLocale(data.preferences.language);
          if (userLocale) setLocaleState(userLocale);
        }
      })
      .catch(() => {
        // Not logged in or error — keep browser locale
      });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
  }, []);

  const t: TFunction = useCallback(
    (key, params) => translate(locale, key, params),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
