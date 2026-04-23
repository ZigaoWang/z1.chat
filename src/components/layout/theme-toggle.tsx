"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/use-i18n";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const next = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? t("settings.dark") : theme === "light" ? t("settings.light") : t("settings.system");

  return (
    <button
      onClick={next}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
