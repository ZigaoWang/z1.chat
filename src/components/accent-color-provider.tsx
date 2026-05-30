"use client";

import { useEffect } from "react";

export const ACCENT_PRESETS = [
  { name: "Blue",   hue: 250 },
  { name: "Purple", hue: 290 },
  { name: "Pink",   hue: 330 },
  { name: "Teal",   hue: 195 },
  { name: "Green",  hue: 150 },
  { name: "Orange", hue: 40  },
];

export const DEFAULT_HUE = 250;

export function applyAccentHue(hue: number) {
  const id = "accent-override";
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = `
    :root {
      --primary: oklch(0.45 0.18 ${hue});
      --ring: oklch(0.45 0.18 ${hue});
      --user-bubble: oklch(0.45 0.18 ${hue} / 10%);
      --sidebar-primary: oklch(0.45 0.18 ${hue});
      --sidebar-ring: oklch(0.45 0.18 ${hue});
    }
  `;
}

export function AccentColorProvider() {
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const hue = data?.preferences?.accentColor ?? DEFAULT_HUE;
        applyAccentHue(hue);
      })
      .catch(() => {});
  }, []);

  return null;
}
