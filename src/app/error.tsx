"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500/60" />
        <h2 className="mt-4 text-lg font-semibold">{t("error.somethingWrong")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || t("error.somethingWrong")}
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          {t("error.tryAgain")}
        </button>
      </div>
    </div>
  );
}
