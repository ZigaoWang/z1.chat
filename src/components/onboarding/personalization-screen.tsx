"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { Loader2, ArrowRight } from "lucide-react";
import { ACCENT_PRESETS, applyAccentHue } from "@/components/accent-color-provider";
import { useTheme } from "next-themes";

interface ThemeScreenProps {
  accentHue: number;
  onAccentChange: (hue: number) => void;
  onSave: () => void;
  onSkip: () => void;
}

export default function ThemeScreen({ accentHue, onAccentChange, onSave, onSkip }: ThemeScreenProps) {
  const { t } = useI18n();
  const { setTheme, theme } = useTheme();
  const [saving, setSaving] = useState(false);

  useEffect(() => { applyAccentHue(accentHue); }, [accentHue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { accentColor: accentHue, theme: theme ?? "system" } }),
      });
    } catch { /* continue */ }
    onSave();
  };

  const handleSkip = async () => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: {} }),
      });
    } catch { /* continue */ }
    onSkip();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-fade-in">
      <div className="w-full max-w-xs px-6">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold tracking-tight">{t("onboarding.personalize")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.personalizeDesc")}</p>
        </div>

        {/* Theme */}
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("settings.theme")}</label>
          <div className="mt-2 flex gap-2">
            {(["light", "dark", "system"] as const).map((t_) => (
              <button
                key={t_}
                onClick={() => setTheme(t_)}
                className={`flex-1 h-9 rounded-lg border text-sm font-medium transition-colors ${
                  theme === t_ ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/50"
                }`}
              >
                {t_ === "light" ? t("settings.light") : t_ === "dark" ? t("settings.dark") : t("settings.system")}
              </button>
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div className="mb-8">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("onboarding.chooseAccent")}</label>
          <div className="mt-2 flex items-center gap-2.5">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.hue}
                onClick={() => onAccentChange(preset.hue)}
                className="h-7 w-7 rounded-full transition-transform hover:scale-110 flex-1"
                style={{
                  background: `oklch(0.45 0.18 ${preset.hue})`,
                  outline: accentHue === preset.hue ? `2px solid oklch(0.45 0.18 ${preset.hue})` : "none",
                  outlineOffset: "2px",
                }}
                title={preset.name}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("onboarding.getStarted")}</span><ArrowRight className="ml-1.5 h-4 w-4" /></>}
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
