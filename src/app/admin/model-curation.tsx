"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Cpu } from "lucide-react";
import { toast } from "sonner";

interface CuratedModelData {
  id: string;
  modelId: string;
  displayName: string | null;
  sortOrder: number;
  intelligenceLevel: number;
  costLevel: number;
  category: string | null;
  enabled: boolean;
}

interface AvailableModel {
  id: string;
  name: string;
}

const CATEGORIES = ["reasoning", "fast", "coding", "creative", "general"];

export default function ModelCuration() {
  const [models, setModels] = useState<CuratedModelData[]>([]);
  const [available, setAvailable] = useState<AvailableModel[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/models");
      if (res.ok) {
        const data = await res.json();
        setModels(data.curated);
        setAvailable(data.availableModels);
      }
    } catch {
      toast.error("Failed to load models");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addModel = async (modelId: string) => {
    const maxOrder = models.length > 0 ? Math.max(...models.map((m) => m.sortOrder)) + 1 : 0;
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, sortOrder: maxOrder }),
      });
      if (res.ok) {
        const created = await res.json();
        setModels((prev) => [...prev, created]);
        setShowAdd(false);
        setAddSearch("");
        toast.success("Model added");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to add");
      }
    } catch {
      toast.error("Failed to add model");
    }
  };

  const updateModel = async (id: string, updates: Partial<CuratedModelData>) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (res.ok) {
        const updated = await res.json();
        setModels((prev) => prev.map((m) => (m.id === id ? updated : m)));
      }
    } catch {
      toast.error("Update failed");
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== id));
        toast.success("Model removed");
      }
    } catch {
      toast.error("Delete failed");
    }
  };

  const moveModel = async (id: string, direction: "up" | "down") => {
    const idx = models.findIndex((m) => m.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= models.length) return;

    const newModels = [...models];
    [newModels[idx], newModels[swapIdx]] = [newModels[swapIdx], newModels[idx]];
    setModels(newModels);

    await Promise.all([
      updateModel(newModels[idx].id, { sortOrder: idx }),
      updateModel(newModels[swapIdx].id, { sortOrder: swapIdx }),
    ]);
  };

  const filteredAvailable = available
    .filter((m) => !models.some((cm) => cm.modelId === m.id))
    .filter((m) =>
      addSearch ? m.name.toLowerCase().includes(addSearch.toLowerCase()) || m.id.toLowerCase().includes(addSearch.toLowerCase()) : true
    )
    .slice(0, 20);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground/50" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
            Model Curation
          </h2>
          <span className="text-[10px] text-muted-foreground/30">{models.length} models</span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 rounded-lg border border-border/60 bg-card p-3">
          <input
            type="text"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="Search models to add..."
            className="w-full rounded-md border border-border/40 bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary/50 mb-2"
            autoFocus
          />
          <div className="max-h-[200px] overflow-y-auto space-y-0.5">
            {filteredAvailable.map((m) => (
              <button
                key={m.id}
                onClick={() => addModel(m.id)}
                className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-muted/50 transition-colors truncate"
              >
                <span className="text-foreground">{m.name}</span>
                <span className="ml-2 text-muted-foreground/40 text-[10px]">{m.id}</span>
              </button>
            ))}
            {filteredAvailable.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 px-2 py-1">No models found</p>
            )}
          </div>
        </div>
      )}

      {models.length === 0 ? (
        <p className="text-xs text-muted-foreground/50 text-center py-4">
          No curated models yet. Add models to show users a curated selection.
        </p>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
          {models.map((model, idx) => (
            <div
              key={model.id}
              className={`flex items-center gap-2 px-3 py-2 text-xs ${!model.enabled ? "opacity-40" : ""}`}
            >
              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveModel(model.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveModel(model.id, "down")}
                  disabled={idx === models.length - 1}
                  className="text-muted-foreground/40 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>

              {/* Name + ID */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  defaultValue={model.displayName || ""}
                  placeholder={available.find((a) => a.id === model.modelId)?.name || model.modelId}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (model.displayName || "")) {
                      updateModel(model.id, { displayName: val || null });
                    }
                  }}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground/30 focus:bg-muted/30 rounded px-1 -mx-1"
                />
                <p className="text-[10px] text-muted-foreground/30 truncate">{model.modelId}</p>
              </div>

              {/* Intelligence */}
              <select
                value={model.intelligenceLevel}
                onChange={(e) => updateModel(model.id, { intelligenceLevel: Number(e.target.value) })}
                className="bg-transparent text-[10px] text-muted-foreground border border-border/40 rounded px-1 py-0.5 outline-none"
                title="Intelligence level"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{"●".repeat(n)}{"○".repeat(5 - n)}</option>
                ))}
              </select>

              {/* Cost */}
              <select
                value={model.costLevel}
                onChange={(e) => updateModel(model.id, { costLevel: Number(e.target.value) })}
                className="bg-transparent text-[10px] text-muted-foreground border border-border/40 rounded px-1 py-0.5 outline-none"
                title="Cost level"
              >
                <option value={1}>$</option>
                <option value={2}>$$</option>
                <option value={3}>$$$</option>
              </select>

              {/* Category */}
              <select
                value={model.category || ""}
                onChange={(e) => updateModel(model.id, { category: e.target.value || null })}
                className="bg-transparent text-[10px] text-muted-foreground border border-border/40 rounded px-1 py-0.5 outline-none"
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Enabled toggle */}
              <button
                onClick={() => updateModel(model.id, { enabled: !model.enabled })}
                className={`shrink-0 h-4 w-7 rounded-full transition-colors ${model.enabled ? "bg-primary" : "bg-muted-foreground/20"}`}
              >
                <div className={`h-3 w-3 rounded-full bg-white transition-transform ${model.enabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteModel(model.id)}
                className="shrink-0 text-muted-foreground/30 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
