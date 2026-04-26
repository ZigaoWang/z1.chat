"use client";

import { Brain, Search, Coins } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { formatCNY } from "@/lib/currency";

interface WelcomeScreenProps {
  creditBalance: number;
  onContinue: () => void;
}

export default function WelcomeScreen({ creditBalance, onContinue }: WelcomeScreenProps) {
  const { t } = useI18n();

  const cards = [
    { icon: Brain, title: t("onboarding.card1Title"), desc: t("onboarding.card1Desc") },
    { icon: Search, title: t("onboarding.card2Title"), desc: t("onboarding.card2Desc") },
    { icon: Coins, title: t("onboarding.card3Title"), desc: t("onboarding.card3Desc") },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md px-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {t("onboarding.welcome")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("onboarding.subtitle")}
        </p>

        <div className="mt-8 grid gap-3">
          {cards.map((card) => (
            <div
              key={card.title}
              className="flex items-start gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <card.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{card.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {creditBalance > 0 && (
          <div className="mt-6 rounded-lg bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">{t("onboarding.startingBalance")}</p>
            <p className="mt-0.5 text-xl font-bold text-primary">{formatCNY(creditBalance)}</p>
          </div>
        )}

        <button
          onClick={onContinue}
          className="mt-6 flex h-10 w-full items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
        >
          {t("onboarding.getStarted")}
        </button>
      </div>
    </div>
  );
}
