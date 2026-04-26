"use client";

import { Lock } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import Link from "next/link";

interface CreditUpgradeCardProps {
  variant: "tool" | "depleted";
}

export default function CreditUpgradeCard({ variant }: CreditUpgradeCardProps) {
  const { t } = useI18n();

  if (variant === "depleted") {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {t("credit.balanceZero")}
            </p>
            <p className="mt-0.5 text-xs text-amber-600/70 dark:text-amber-400/60">
              {t("credit.switchedFree")}
            </p>
            <Link
              href="/settings#credits"
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {t("credit.topUp")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {t("credit.toolLocked")}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-600/70 dark:text-amber-400/60">
            {t("credit.toolLockedDesc")}
          </p>
          <Link
            href="/settings#credits"
            className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline"
          >
            {t("credit.topUp")}
          </Link>
        </div>
      </div>
    </div>
  );
}
