"use client";

import { Activity } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

interface UsageBreakdown {
  type: string;
  count: number;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface UsageData {
  totalCost: number;
  monthCost: number;
  breakdown: UsageBreakdown[];
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

export default function UsageTab({ usage }: { usage: UsageData | null }) {
  const { t, locale } = useI18n();

  if (!usage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground/60">{t("usage.noUsage")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={t("usage.thisMonth")}
          value={`¥${usage.monthCost.toFixed(4)}`}
        />
        <StatCard
          label={t("usage.allTime")}
          value={`¥${usage.totalCost.toFixed(4)}`}
        />
      </div>

      {/* Breakdown */}
      {usage.breakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            {locale === "zh" ? "用量明细" : "Breakdown"}
          </h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/30 dark:bg-muted/10">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("usage.type")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("usage.calls")}</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">{t("usage.cost")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {usage.breakdown.map((b) => (
                  <tr key={b.type} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm">
                      {t(`usage.type.${b.type}` as "usage.type.chat") || b.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-sm text-muted-foreground">{b.count}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium">¥{b.totalCost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {usage.recent.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">{t("usage.recentActivity")}</h3>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <div className="divide-y divide-border/20 max-h-72 overflow-y-auto">
              {usage.recent.slice(0, 30).map((log) => (
                <div key={log.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm">
                      {t(`usage.type.${log.type}` as "usage.type.chat") || log.type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-muted-foreground/40 truncate">
                      {log.model.split("/").pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-sm font-medium">¥{log.costUsd.toFixed(5)}</span>
                    <span className="text-xs text-muted-foreground/40 w-16 text-right">
                      {new Date(log.createdAt).toLocaleDateString(
                        locale === "zh" ? "zh-CN" : "en-US",
                        { month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 dark:bg-muted/10 px-4 py-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
