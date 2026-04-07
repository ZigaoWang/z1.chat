"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const next = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <button
      onClick={next}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground"
      title={`Theme: ${label}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
