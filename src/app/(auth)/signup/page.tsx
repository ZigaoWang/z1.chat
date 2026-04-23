"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";

export default function SignupPage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("auth.inviteOnly")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.inviteOnlyDesc")}
        </p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link
          href="/login"
          className="font-medium text-foreground hover:underline"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
