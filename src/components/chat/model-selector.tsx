"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronsUpDown, Zap, Eye, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useModels } from "@/hooks/use-models";
import { useCredits } from "@/hooks/use-credits";
import { USD_TO_CNY, formatCNY } from "@/lib/currency";
import { useI18n } from "@/hooks/use-i18n";
import Link from "next/link";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

const RECENT_MODELS_KEY = "z1-recent-models";
const MAX_RECENT = 5;

function getRecentModels(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_MODELS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentModel(modelId: string) {
  try {
    const recent = getRecentModels().filter((id) => id !== modelId);
    recent.unshift(modelId);
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [lockedModelId, setLockedModelId] = useState<string | null>(null);
  const { providers, allModels, isLoading } = useModels();
  const { creditBalance, isZero } = useCredits();
  const { t } = useI18n();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(getRecentModels());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedModel = useMemo(
    () => allModels.find((m) => m.id === value),
    [allModels, value]
  );

  const displayName = selectedModel?.name || value.split("/").pop() || t("model.selectModel");

  const recentModels = useMemo(() => {
    return recentIds
      .map((id) => allModels.find((m) => m.id === id))
      .filter(Boolean) as typeof allModels;
  }, [recentIds, allModels]);


  // Auto-select free model when balance hits zero
  useEffect(() => {
    if (!isZero || !allModels.length) return;
    const currentModel = allModels.find((m) => m.id === value);
    if (currentModel && !currentModel.isFree) {
      const bestFree = allModels.find((m) => m.isFree);
      if (bestFree) {
        onChange(bestFree.id);
        saveRecentModel(bestFree.id);
        setRecentIds(getRecentModels());
      }
    }
  }, [isZero, allModels, value, onChange]);

  const handleSelect = useCallback(
    (modelId: string) => {
      const model = allModels.find((m) => m.id === modelId);
      if (isZero && model && !model.isFree) {
        setLockedModelId(lockedModelId === modelId ? null : modelId);
        return;
      }
      onChange(modelId);
      saveRecentModel(modelId);
      setRecentIds(getRecentModels());
      setLockedModelId(null);
      setOpen(false);
    },
    [onChange, allModels, isZero, lockedModelId]
  );

  const formatPrice = (price: number) => {
    if (price === 0) return t("model.free");
    const cny = price * 1_000_000 * USD_TO_CNY;
    return `¥${cny.toFixed(2)}/M`;
  };

  const estimatePerMessage = (promptPrice: number, completionPrice: number) => {
    const cost = (1000 * promptPrice + 500 * completionPrice) * USD_TO_CNY;
    return formatCNY(cost);
  };

  const ModelBadges = ({ model }: { model: { isFree: boolean; supportsVision?: boolean } }) => (
    <>
      {model.supportsVision && (
        <Badge
          variant="secondary"
          className="text-[9px] px-1 py-0 h-4 gap-0.5 font-medium bg-blue-500/10 text-blue-500 border-0"
        >
          <Eye className="h-2.5 w-2.5" />
          Vision
        </Badge>
      )}
      {model.isFree && (
        <Badge
          variant="secondary"
          className="text-[9px] px-1 py-0 h-4 gap-0.5 font-medium bg-primary/10 text-primary border-0"
        >
          <Zap className="h-2.5 w-2.5" />
          {t("model.free")}
        </Badge>
      )}
    </>
  );

  const renderModelItem = (model: typeof allModels[0], keyPrefix: string) => {
    const isPaid = !model.isFree;
    const isLocked = isZero && isPaid;
    const isShowingLockMsg = lockedModelId === model.id;

    return (
      <div key={`${keyPrefix}-${model.id}`}>
        <CommandItem
          value={model.id}
          onSelect={() => handleSelect(model.id)}
          data-checked={value === model.id ? "true" : undefined}
          className={isLocked ? "opacity-50" : ""}
        >
          <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate text-xs">{model.name}</span>
              <ModelBadges model={model} />
            </div>
            {isPaid && (
              <span className="shrink-0 text-[11px] text-muted-foreground/40 tabular-nums flex items-center gap-1">
                {isLocked && <Lock className="h-2.5 w-2.5" />}
                {formatPrice(model.pricing.prompt)}
              </span>
            )}
          </div>
        </CommandItem>
        {isShowingLockMsg && (
          <div className="mx-2 mb-1 rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <span>{t("credit.paidModelLocked")}</span>
            <span className="mx-1 text-muted-foreground/40">·</span>
            <span>{t("credit.estimatedCost").replace("{cost}", estimatePerMessage(model.pricing.prompt, model.pricing.completion))}</span>
            <Link
              href="/settings#credits"
              onClick={() => setOpen(false)}
              className="ml-1.5 text-primary font-medium hover:underline"
            >
              {t("credit.topUp")}
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="max-w-[120px] sm:max-w-[200px] truncate">{displayName}</span>
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setLockedModelId(null); }}
        title={t("model.selectModelTitle")}
        description={t("model.selectModelDesc")}
        className="sm:max-w-[480px]"
      >
        <Command>
          <CommandInput placeholder={t("model.searchModels")} />

          {isZero && (
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border/40">
              <span>
                {formatCNY(creditBalance)}
                <span className="mx-1 text-muted-foreground/40">·</span>
                {t("credit.freeModelsOnly")}
              </span>
              <Link
                href="/settings#credits"
                onClick={() => setOpen(false)}
                className="text-primary font-medium hover:underline"
              >
                {t("credit.topUp")}
              </Link>
            </div>
          )}

          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {isLoading ? t("model.loadingModels") : t("model.noModels")}
            </CommandEmpty>

            {recentModels.length > 0 && (
              <CommandGroup heading={t("model.recent")}>
                {recentModels.map((model) => renderModelItem(model, "recent"))}
              </CommandGroup>
            )}

            {providers.map((provider) => (
              <CommandGroup key={provider.name} heading={provider.name}>
                {provider.models.map((model) => renderModelItem(model, provider.name))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
