"use client";

import { useState, useCallback, useEffect } from "react";
import { Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useI18n } from "@/hooks/use-i18n";

interface UserSettings {
  name: string | null;
  email: string | null;
  creditBalance: number;
  preferences: {
    theme: "light" | "dark" | "system";
    defaultModel: string | null;
    responseStyle: "concise" | "balanced" | "detailed";
    language: string | null;
    customInstructions: string | null;
  };
}

export default function GeneralTab({ settings, setSettings }: {
  settings: UserSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings | null>>;
}) {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [customInstructions, setCustomInstructions] = useState(
    settings?.preferences?.customInstructions || ""
  );
  const [instructionsSaved, setInstructionsSaved] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setThemeMounted(true); }, []);

  useEffect(() => {
    if (settings?.preferences?.customInstructions !== undefined) {
      setCustomInstructions(settings.preferences.customInstructions || "");
    }
  }, [settings?.preferences?.customInstructions]);

  const updatePreference = useCallback(
    async (key: string, value: string | null) => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences: { [key]: value } }),
        });
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) =>
            prev ? { ...prev, preferences: data.preferences } : prev
          );
          toast.success(t("settings.saved"));
        }
      } catch {
        toast.error(t("settings.failedToSave"));
      }
    },
    [t, setSettings]
  );

  const saveCustomInstructions = useCallback(async () => {
    setSaving(true);
    await updatePreference("customInstructions", customInstructions || null);
    setInstructionsSaved(true);
    setSaving(false);
  }, [customInstructions, updatePreference]);

  return (
    <div className="space-y-8">
      {/* Profile */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t("settings.profile")}</h3>
        <div className="rounded-lg border border-border/50 divide-y divide-border/30 overflow-hidden">
          <Row label={t("settings.name")} value={settings?.name || "—"} />
          <Row label={t("settings.email")} value={settings?.email || "—"} />
        </div>
      </div>

      {/* Theme */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t("settings.theme")}</h3>
        <div className="flex gap-2">
          {([
            { value: "light", icon: Sun, label: t("settings.light") },
            { value: "dark", icon: Moon, label: t("settings.dark") },
            { value: "system", icon: Monitor, label: t("settings.system") },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setTheme(opt.value);
                updatePreference("theme", opt.value);
              }}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all ${
                themeMounted && theme === opt.value
                  ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <opt.icon className="h-4 w-4" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <h3 className="text-sm font-medium mb-1">{t("settings.language")}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t("settings.languageDesc")}</p>
        <div className="flex gap-2">
          {([
            { value: "en" as const, lang: "English", label: "English" },
            { value: "zh" as const, lang: "Chinese", label: "中文" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocale(opt.value);
                updatePreference("language", opt.lang);
              }}
              className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                locale === opt.value
                  ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Response Style */}
      <div>
        <h3 className="text-sm font-medium mb-1">{t("settings.responseStyle")}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t("settings.responseStyleDesc")}</p>
        <div className="flex gap-2">
          {([
            { value: "concise", label: t("settings.concise") },
            { value: "balanced", label: t("settings.balanced") },
            { value: "detailed", label: t("settings.detailed") },
          ] as const).map((s) => (
            <button
              key={s.value}
              onClick={() => updatePreference("responseStyle", s.value)}
              className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                settings?.preferences?.responseStyle === s.value
                  ? "border-primary/50 bg-primary/5 text-foreground shadow-sm"
                  : "border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Instructions */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-medium">{t("settings.customInstructions")}</h3>
          {!instructionsSaved && (
            <button
              onClick={saveCustomInstructions}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("settings.save")}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {t("settings.customInstructionsDesc")}
        </p>
        <textarea
          value={customInstructions}
          onChange={(e) => {
            setCustomInstructions(e.target.value);
            setInstructionsSaved(false);
          }}
          onBlur={() => {
            if (!instructionsSaved) saveCustomInstructions();
          }}
          placeholder={t("settings.customInstructionsPlaceholder")}
          rows={5}
          className="w-full rounded-lg border border-border/50 bg-muted/20 dark:bg-muted/10 px-3.5 py-3 text-sm leading-relaxed resize-none outline-none placeholder:text-muted-foreground/40 focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
