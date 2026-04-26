"use client";

import { useState } from "react";
import LanguagePicker from "./language-picker";
import WelcomeScreen from "./welcome-screen";
import PersonalizationScreen from "./personalization-screen";

interface OnboardingFlowProps {
  creditBalance: number;
  onComplete: () => void;
}

export default function OnboardingFlow({ creditBalance, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<"language" | "welcome" | "personalize">("language");

  if (step === "language") {
    return <LanguagePicker onContinue={() => setStep("welcome")} />;
  }

  if (step === "welcome") {
    return (
      <WelcomeScreen
        creditBalance={creditBalance}
        onContinue={() => setStep("personalize")}
      />
    );
  }

  return (
    <PersonalizationScreen
      onSave={onComplete}
      onSkip={onComplete}
    />
  );
}
