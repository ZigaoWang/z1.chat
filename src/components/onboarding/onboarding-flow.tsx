"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { DEFAULT_HUE } from "@/components/accent-color-provider";
import LanguagePicker from "./language-picker";
import ThemeScreen from "./personalization-screen";
import CreditsScreen from "./welcome-screen";

interface OnboardingFlowProps {
  creditBalance: number;
  onComplete: () => void;
}

const STEPS = ["language", "theme", "credits"] as const;
type Step = typeof STEPS[number];

function StepDots({ current, onBack }: { current: Step; onBack: () => void }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3">
      {idx > 0 && (
        <button
          onClick={onBack}
          className="absolute -left-8 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === idx ? "w-4 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

export default function OnboardingFlow({ creditBalance, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<Step>("language");
  const [accentHue, setAccentHue] = useState(DEFAULT_HUE);

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  return (
    <>
      <StepDots current={step} onBack={goBack} />
      {step === "language" && <LanguagePicker onContinue={() => setStep("theme")} />}
      {step === "theme" && <ThemeScreen accentHue={accentHue} onAccentChange={setAccentHue} onSave={() => setStep("credits")} onSkip={() => setStep("credits")} />}
      {step === "credits" && <CreditsScreen creditBalance={creditBalance} onContinue={onComplete} />}
    </>
  );
}
