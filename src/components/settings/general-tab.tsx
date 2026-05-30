"use client";

import { useState, useCallback, useEffect } from "react";
import { Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useI18n } from "@/hooks/use-i18n";

import { ACCENT_PRESETS, DEFAULT_HUE, applyAccentHue } from "@/components/accent-color-provider";

interface UserSettings {
  name: string | null;
  email: string | null;
  creditBalance: number;
  preferences: {
    theme: "light" | "dark" | "system";
    accentColor?: number;
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
    async (key: string, value: string | number | null) => {
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

      {/* Accent Color */}
      <div>
        <h3 className="text-sm font-medium mb-3">Accent color</h3>
        <div className="flex gap-2">
          {ACCENT_PRESETS.map((preset) => {
            const active = (settings?.preferences?.accentColor ?? DEFAULT_HUE) === preset.hue;
            return (
              <button
                key={preset.hue}
                title={preset.name}
                onClick={() => {
                  applyAccentHue(preset.hue);
                  updatePreference("accentColor", preset.hue);
                }}
                className={`h-7 w-7 rounded-full transition-all ring-offset-2 ring-offset-background ${active ? "ring-2 ring-primary scale-110" : "hover:scale-105"}`}
                style={{ background: `oklch(0.55 0.2 ${preset.hue})` }}
              />
            );
          })}
        </div>
      </div>

      {/* UI Language */}
      <div>
        <h3 className="text-sm font-medium mb-1">
          {locale === "zh" ? "界面语言" : "Interface language"}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {locale === "zh" ? "设置界面显示语言" : "Language for buttons, labels, and menus"}
        </p>
        <div className="flex gap-2">
          {([
            { value: "en" as const, label: "English" },
            { value: "zh" as const, label: "中文" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocale(opt.value);
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

      {/* AI Response Language */}
      <div>
        <h3 className="text-sm font-medium mb-1">
          {locale === "zh" ? "AI 回复语言" : "AI response language"}
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {locale === "zh" ? "AI 默认使用的回复语言。设为「自动」时，AI 会使用你发送消息的语言回复。" : "Default language for AI responses. Set to \"Auto\" to match the language you write in."}
        </p>
        <select
          value={settings?.preferences?.language || ""}
          onChange={(e) => updatePreference("language", e.target.value || null)}
          className="rounded-lg border border-border/50 bg-background px-3 py-2 text-sm outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
        >
          <option value="">{locale === "zh" ? "自动（跟随输入语言）" : "Auto (match input language)"}</option>
          <option value="English">English</option>
          <option value="Chinese">中文</option>
          <option value="Japanese">日本語</option>
          <option value="Korean">한국어</option>
          <option value="Spanish">Español</option>
          <option value="French">Français</option>
          <option value="German">Deutsch</option>
          <option value="Portuguese">Português</option>
          <option value="Russian">Русский</option>
          <option value="Arabic">العربية</option>
          <option value="Hindi">हिन्दी</option>
          <option value="Italian">Italiano</option>
          <option value="Dutch">Nederlands</option>
          <option value="Turkish">Türkçe</option>
          <option value="Vietnamese">Tiếng Việt</option>
          <option value="Thai">ไทย</option>
          <option value="Indonesian">Bahasa Indonesia</option>
        </select>
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
