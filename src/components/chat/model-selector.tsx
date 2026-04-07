"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { ChevronsUpDown, Zap } from "lucide-react";
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

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

const RECENT_MODELS_KEY = "one-recent-models";
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
  const { providers, allModels, isLoading } = useModels();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Load recent models on mount
  useEffect(() => {
    setRecentIds(getRecentModels());
  }, []);

  const selectedModel = useMemo(
    () => allModels.find((m) => m.id === value),
    [allModels, value]
  );

  const displayName = selectedModel?.name || value.split("/").pop() || "Select model";

  // Recent models section
  const recentModels = useMemo(() => {
    return recentIds
      .map((id) => allModels.find((m) => m.id === id))
      .filter(Boolean) as typeof allModels;
  }, [recentIds, allModels]);

  // Cmd+K global shortcut
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

  const handleSelect = useCallback(
    (modelId: string) => {
      onChange(modelId);
      saveRecentModel(modelId);
      setRecentIds(getRecentModels());
      setOpen(false);
    },
    [onChange]
  );

  const formatPrice = (price: number) => {
    if (price === 0) return "Free";
    return `$${(price * 1_000_000).toFixed(2)}/M`;
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span className="max-w-[200px] truncate">{displayName}</span>
        <ChevronsUpDown className="h-3 w-3 opacity-40" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Select Model"
        description="Search and select an AI model"
        className="sm:max-w-[480px]"
      >
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>
              {isLoading ? "Loading models..." : "No models found."}
            </CommandEmpty>

            {/* Recent models */}
            {recentModels.length > 0 && (
              <CommandGroup heading="Recent">
                {recentModels.map((model) => (
                  <CommandItem
                    key={`recent-${model.id}`}
                    value={model.id}
                    onSelect={() => handleSelect(model.id)}
                    data-checked={value === model.id ? "true" : undefined}
                  >
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-xs">{model.name}</span>
                        {model.isFree && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-4 gap-0.5 font-medium bg-primary/10 text-primary border-0"
                          >
                            <Zap className="h-2.5 w-2.5" />
                            Free
                          </Badge>
                        )}
                      </div>
                      {!model.isFree && (
                        <span className="shrink-0 text-[11px] text-muted-foreground/40 tabular-nums">
                          {formatPrice(model.pricing.prompt)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* All models grouped by provider */}
            {providers.map((provider) => (
              <CommandGroup key={provider.name} heading={provider.name}>
                {provider.models.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => handleSelect(model.id)}
                    data-checked={value === model.id ? "true" : undefined}
                  >
                    <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-xs">{model.name}</span>
                        {model.isFree && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-4 gap-0.5 font-medium bg-primary/10 text-primary border-0"
                          >
                            <Zap className="h-2.5 w-2.5" />
                            Free
                          </Badge>
                        )}
                      </div>
                      {!model.isFree && (
                        <span className="shrink-0 text-[11px] text-muted-foreground/40 tabular-nums">
                          {formatPrice(model.pricing.prompt)}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
