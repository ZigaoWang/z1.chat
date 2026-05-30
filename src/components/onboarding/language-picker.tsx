"use client";

import { useI18n } from "@/hooks/use-i18n";

interface LanguagePickerProps {
  onContinue: () => void;
}

export default function LanguagePicker({ onContinue }: LanguagePickerProps) {
  const { setLocale } = useI18n();

  const handleSelect = (locale: "zh" | "en") => {
    setLocale(locale);
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: { language: locale === "zh" ? "Chinese" : "English" } }),
    }).catch(() => {});
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-fade-in">
      <div className="w-full max-w-xs px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Choose your language</h1>
        <p className="text-sm text-muted-foreground mb-8">选择你的语言</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleSelect("en")}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-base font-medium transition-colors hover:bg-muted hover:border-primary/40"
          >
            English
          </button>
          <button
            onClick={() => handleSelect("zh")}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-base font-medium transition-colors hover:bg-muted hover:border-primary/40"
          >
            中文
          </button>
        </div>
      </div>
    </div>
  );
}
