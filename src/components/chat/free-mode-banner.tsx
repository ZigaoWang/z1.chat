"use client";

import { useState, useEffect } from "react";
import { Zap, X } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import Link from "next/link";

const DISMISS_KEY = "z1:free-banner-dismissed";

export default function FreeModeBanner() {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  if (dismissed) return null;

  return (
    <div className="shrink-0 px-4 py-1.5">
      <div className="mx-auto max-w-3xl flex items-center gap-2 rounded-lg border border-purple-200 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/10 px-3 py-2">
        <Zap className="h-3.5 w-3.5 shrink-0 text-purple-500" />
        <span className="flex-1 text-xs text-purple-700 dark:text-purple-400">
          {t("credit.freeMode")}
          <span className="mx-1 text-purple-400/50">·</span>
          {t("credit.upgradeUnlock")}
        </span>
        <Link
          href="/settings#credits"
          className="shrink-0 text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline"
        >
          {t("credit.viewPlans")}
        </Link>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 text-purple-400 hover:text-purple-600 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
