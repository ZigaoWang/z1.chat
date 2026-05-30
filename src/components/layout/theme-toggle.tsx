"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const options = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (theme) {
      const idx = options.findIndex((opt) => opt.value === theme);
      if (idx !== -1) setSelected(idx);
    }
  }, [theme]);

  if (!mounted) return null;

  const handleSelect = (value: string, index: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSelected(index);
    // Delay theme switch so the slide animation completes before CSS variables change
    timeoutRef.current = setTimeout(() => setTheme(value), 200);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5">
      <Sun className="h-3.5 w-3.5 text-muted-foreground/60" />
      <div className="relative flex flex-1 items-center rounded-md bg-muted/50 p-0.5">
        <div
          className="absolute left-0.5 top-0.5 bottom-0.5 rounded bg-background shadow-sm transition-transform duration-200 ease-in-out"
          style={{
            width: `calc((100% - 4px) / 3)`,
            transform: `translateX(${selected * 100}%)`,
          }}
        />
        {options.map((opt, i) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value, i)}
            className={`relative flex-1 flex items-center justify-center rounded h-6 text-xs transition-colors duration-200 ${
              selected === i
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <opt.icon className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
