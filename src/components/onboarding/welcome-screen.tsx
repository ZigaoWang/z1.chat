"use client";

import { useI18n } from "@/hooks/use-i18n";
import { formatCNY } from "@/lib/currency";
import { Gift, ArrowRight } from "lucide-react";

interface CreditsScreenProps {
  creditBalance: number;
  onContinue: () => void;
}

export default function CreditsScreen({ creditBalance, onContinue }: CreditsScreenProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background animate-fade-in">
      <div className="w-full max-w-xs px-6 text-center">
        <Gift className="mx-auto mb-6 h-8 w-8 text-primary" />
        <h2 className="text-xl font-semibold tracking-tight">{t("onboarding.freeCredits")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("onboarding.freeCreditsDesc")}</p>
        {creditBalance > 0 && (
          <p className="mt-1 text-xs text-muted-foreground/60">{formatCNY(creditBalance)} · {t("onboarding.payg")}</p>
        )}
        <button
          onClick={async () => {
            try {
              await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onboardingCompleted: true }),
              });
            } catch { /* continue */ }
            onContinue();
          }}
          className="mt-8 flex h-10 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          {t("onboarding.startChatting")}<ArrowRight className="ml-1.5 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
