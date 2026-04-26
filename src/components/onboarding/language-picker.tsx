"use client";

import { useI18n } from "@/hooks/use-i18n";
import { Globe } from "lucide-react";

interface LanguagePickerProps {
  onContinue: () => void;
}

export default function LanguagePicker({ onContinue }: LanguagePickerProps) {
  const { setLocale } = useI18n();

  const handleSelect = (locale: "zh" | "en") => {
    setLocale(locale);
    const language = locale === "zh" ? "Chinese" : "English";
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { language } }),
    }).catch(() => {});
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-xs px-6 text-center animate-fade-in">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <Globe className="h-6 w-6 text-primary" />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => handleSelect("zh")}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-base font-medium transition-colors hover:bg-muted hover:border-primary/30"
          >
            中文
          </button>
          <button
            onClick={() => handleSelect("en")}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-base font-medium transition-colors hover:bg-muted hover:border-primary/30"
          >
            English
          </button>
        </div>
      </div>
    </div>
  );
}
