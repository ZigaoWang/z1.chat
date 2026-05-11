"use client";

import { useState, useCallback } from "react";
import { CreditCard, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/use-i18n";

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

export default function CreditsTab({
  settings,
  recentOrders,
}: {
  settings: UserSettings | null;
  recentOrders: Array<{
    id: string;
    outTradeNo: string;
    amount: string;
    creditAmount: string;
    status: string;
    type: string;
    createdAt: string;
  }>;
}) {
  const { t, locale } = useI18n();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  const activeAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : null);

  const handleTopUp = useCallback(async () => {
    if (!activeAmount || activeAmount < 1) {
      toast.error(t("credits.selectAnAmount"));
      return;
    }
    setTopUpLoading(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: activeAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("credits.paymentError"));
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast.error(t("credits.paymentError"));
    } finally {
      setTopUpLoading(false);
    }
  }, [activeAmount, t]);

  return (
    <div className="space-y-6">
      {/* Balance */}
      <div className="rounded-lg border border-border/50 bg-muted/20 dark:bg-muted/10 px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t("credits.currentBalance")}</p>
            <p className="text-3xl font-semibold tracking-tight">
              ¥{(settings?.creditBalance ?? 0).toFixed(2)}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/8 dark:bg-primary/12 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary/60" />
          </div>
        </div>
      </div>

      {/* Top Up */}
      <div>
        <h3 className="text-sm font-medium mb-3">{t("credits.topUp")}</h3>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          {/* Amount buttons */}
          <div className="px-4 pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2.5">{t("credits.selectAmount")}</p>
            <div className="grid grid-cols-5 gap-2">
              {[5, 10, 30, 50, 100].map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount("");
                  }}
                  className={`rounded-lg border py-2.5 text-sm font-medium transition-all ${
                    selectedAmount === amt && !customAmount
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  ¥{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount */}
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1.5">{t("credits.customAmount")}</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50">¥</span>
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                placeholder={t("credits.enterAmount")}
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  if (e.target.value) setSelectedAmount(null);
                }}
                className="w-full rounded-lg border border-border/50 bg-background px-3 pl-7 py-2.5 text-sm outline-none placeholder:text-muted-foreground/30 focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="px-4 py-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground mb-2">{t("credits.paymentMethod")}</p>
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3 flex items-center gap-3">
              <svg viewBox="0 0 1024 1024" className="h-6 w-6 shrink-0" fill="none">
                <rect width="1024" height="1024" rx="180" fill="#1677FF" />
                <path d="M770.8 620.2c-27.6-11.8-57.4-23.2-88.8-34.2 18.6-46.8 31.2-99.6 35.4-155.2H596.8v-56.4h138V340h-138v-84.8h-69.6c-8 0-14.4 6.4-14.4 14.4V340H376.4v34.4h136.4v56.4H394v34.4h240.8c-4.6 42.4-15.2 82-30.4 117.4-62.4-17.6-129.2-33-196.4-43.6-91.6-14.4-131.6 30-139 76.8-8.6 54.2 27 115.4 143.2 115.4 76.6 0 142.6-32 195.2-84.6 58.2 28.2 107.2 58.2 140.4 82.8l57.8-82.8c-5.6-4.4-17-12.4-34.8-26.4zM439 680.4c-68.2 0-98-28.4-93.4-57.4 3.2-20 24.8-43.6 72.4-43.6 57.4 0 121.6 13.4 184 32.4C558 654 502.2 680.4 439 680.4z" fill="white" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium">Alipay</p>
                <p className="text-xs text-muted-foreground/50">支付宝</p>
              </div>
              <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            </div>
          </div>

          {/* Pay button */}
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={handleTopUp}
              disabled={topUpLoading || !activeAmount || activeAmount < 1}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1677FF] px-4 py-3 text-sm font-medium text-white transition-all hover:bg-[#1677FF]/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {topUpLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("credits.processing")}
                </>
              ) : activeAmount && activeAmount >= 1 ? (
                <>{t("credits.pay")} ¥{activeAmount.toFixed(2)}</>
              ) : (
                t("credits.selectAnAmount")
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {recentOrders.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">{t("credits.paymentHistory")}</h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="divide-y divide-border/20 max-h-56 overflow-y-auto">
              {recentOrders.slice(0, 10).map((order) => (
                <div key={order.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">¥{order.amount}</span>
                    <span className="text-xs text-muted-foreground/50">
                      +¥{parseFloat(order.creditAmount).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground/50">
                    {new Date(order.createdAt).toLocaleDateString(
                      locale === "zh" ? "zh-CN" : "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
