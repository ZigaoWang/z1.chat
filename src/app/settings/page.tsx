"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Settings, Activity, CreditCard, Brain } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import GeneralTab from "@/components/settings/general-tab";
import UsageTab from "@/components/settings/usage-tab";
import CreditsTab from "@/components/settings/credits-tab";
import MemorySection from "@/components/settings/memory-section";

interface UserSettings {
  name: string | null;
  email: string | null;
  creditBalance: number;
  preferences: {
    theme: "light" | "dark" | "system";
    defaultModel: string | null;
    responseStyle: "concise" | "balanced" | "detailed";
    language: string | null;
    customInstructions: string | null;
  };
}

interface UsageData {
  totalCost: number;
  monthCost: number;
  breakdown: Array<{
    type: string;
    count: number;
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  }>;
  recent: Array<{
    id: string;
    type: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    createdAt: string;
  }>;
}

type Tab = "general" | "memory" | "usage" | "credits";

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Array<{
    id: string;
    outTradeNo: string;
    amount: string;
    creditAmount: string;
    status: string;
    type: string;
    createdAt: string;
  }>>([]);

  // Determine initial tab from hash
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [hashRead, setHashRead] = useState(false);

  // Read hash on mount and listen for hash changes
  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (["general", "memory", "usage", "credits"].includes(hash)) {
        setActiveTab(hash as Tab);
      }
    };
    readHash();
    setHashRead(true);
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  // Sync hash on tab change (only after initial hash is read)
  useEffect(() => {
    if (!hashRead) return;
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab, hashRead]);

  // Load data
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => toast.error(t("settings.failedToLoad")));

    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setUsage(data);
      })
      .catch(() => {});

    fetch("/api/payment/status")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRecentOrders(data);
      })
      .catch(() => {});
  }, [t]);

  // Handle payment return
  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      toast.success(t("credits.creditsAdded"));
      setActiveTab("credits");
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => setSettings(data))
        .catch(() => {});
      fetch("/api/payment/status")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setRecentOrders(data);
        })
        .catch(() => {});
    } else if (payment === "error") {
      toast.error(t("credits.paymentError"));
      setActiveTab("credits");
    } else if (payment === "pending") {
      toast.info(t("credits.paymentPending"));
      setActiveTab("credits");
    }
  }, [searchParams, t]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "general", label: locale === "zh" ? "通用" : "General", icon: Settings },
    { id: "memory", label: locale === "zh" ? "记忆" : "Memory", icon: Brain },
    { id: "usage", label: locale === "zh" ? "用量" : "Usage", icon: Activity },
    { id: "credits", label: locale === "zh" ? "余额" : "Credits", icon: CreditCard },
  ];

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">{t("settings.title")}</h1>
        </div>

        {/* Tab navigation */}
        <nav className="flex gap-1 mb-8 border-b border-border/40 pb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-t-md transition-colors relative ${
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        <div className="animate-in fade-in duration-150">
          {activeTab === "general" && (
            <GeneralTab settings={settings} setSettings={setSettings} />
          )}
          {activeTab === "memory" && <MemorySection />}
          {activeTab === "usage" && <UsageTab usage={usage} />}
          {activeTab === "credits" && (
            <CreditsTab settings={settings} recentOrders={recentOrders} />
          )}
        </div>
      </div>
    </div>
  );
}
