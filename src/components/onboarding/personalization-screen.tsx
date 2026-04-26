"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { Loader2 } from "lucide-react";

interface PersonalizationScreenProps {
  onSave: () => void;
  onSkip: () => void;
}

export default function PersonalizationScreen({ onSave, onSkip }: PersonalizationScreenProps) {
  const { t, locale, setLocale } = useI18n();
  const [language, setLanguage] = useState<string>(locale === "zh" ? "Chinese" : "English");
  const [style, setStyle] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: { language, responseStyle: style },
          onboardingCompleted: true,
        }),
      });
      if (language === "Chinese") setLocale("zh");
      else if (language === "English") setLocale("en");
      onSave();
    } catch {
      onSave();
    }
  };

  const handleSkip = async () => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      });
    } catch {
      // continue anyway
    }
    onSkip();
  };

  const langOptions = [
    { value: "Chinese", label: "中文" },
    { value: "English", label: "English" },
    { value: "", label: t("onboarding.auto") },
  ];

  const styleOptions: { value: "concise" | "balanced" | "detailed"; label: string }[] = [
    { value: "concise", label: t("onboarding.concise") },
    { value: "balanced", label: t("onboarding.balanced") },
    { value: "detailed", label: t("onboarding.detailed") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm px-6">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">{t("onboarding.personalize")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.personalizeDesc")}</p>
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-sm font-medium">{t("onboarding.chooseLanguage")}</label>
            <div className="mt-2 flex gap-2">
              {langOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    language === opt.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">{t("onboarding.chooseStyle")}</label>
            <div className="mt-2 flex gap-2">
              {styleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStyle(opt.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    style === opt.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 flex h-10 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("onboarding.save")}
        </button>

        <button
          onClick={handleSkip}
          className="mt-2 flex w-full items-center justify-center py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("onboarding.skip")}
        </button>
      </div>
    </div>
  );
}
