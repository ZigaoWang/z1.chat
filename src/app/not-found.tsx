"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-bold text-muted-foreground/20">404</p>
        <h2 className="mt-4 text-lg font-semibold">{t("error.pageNotFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("error.pageNotFoundDesc")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("error.backToChat")}
        </Link>
      </div>
    </div>
  );
}
