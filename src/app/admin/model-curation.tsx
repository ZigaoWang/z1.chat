"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Cpu, Search, X } from "lucide-react";
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

function IntelligenceDots({ level }: { level: number }) {
  return (
    <span className="text-[11px] tracking-tight text-muted-foreground/70">
      {"●".repeat(level)}
      {"○".repeat(5 - level)}
    </span>
  );
}

function CostIndicator({ level }: { level: number }) {
  const colors = ["text-green-500", "text-amber-500", "text-orange-500"];
  return (
    <span className={`text-[11px] font-semibold ${colors[level - 1]}`}>
      {"$".repeat(level)}
    </span>
  );
}

export default function ModelCuration() {
  const [models, setModels] = useState<CuratedModelData[]>([]);
  const [available, setAvailable] = useState<AvailableModel[]>([]);
  const [addSearch, setAddSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/models");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed: ${res.status}`);
      }
      const data = await res.json();
      setModels(data.curated || []);
      setAvailable(data.availableModels || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setLoading(false);
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed: ${res.status}`);
      }
      const created = await res.json();
      setModels((prev) => [...prev, created]);
      setShowAdd(false);
      setAddSearch("");
      toast.success("Model added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add model");
    }
  };

  const updateModel = async (id: string, updates: Partial<CuratedModelData>) => {
    // Optimistic update
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
    try {
      const res = await fetch("/api/admin/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed: ${res.status}`);
      }
      const updated = await res.json();
      setModels((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
      load();
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed: ${res.status}`);
      }
      setModels((prev) => prev.filter((m) => m.id !== id));
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
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
      addSearch
        ? m.name.toLowerCase().includes(addSearch.toLowerCase()) ||
          m.id.toLowerCase().includes(addSearch.toLowerCase())
        : true,
    )
    .slice(0, 30);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground/50" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
            Model Curation
          </h2>
          <span className="text-[11px] text-muted-foreground/35">
            {loading ? "..." : `${models.length} curated / ${available.length} total`}
          </span>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 rounded-lg border border-border/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {showAdd ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {showAdd ? "Close" : "Add Model"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-3 rounded-xl border border-border/40 bg-card shadow-sm p-3">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input
              type="text"
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search models by name or ID..."
              className="w-full rounded-lg border border-border/40 bg-muted/20 pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20"
              autoFocus
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto rounded-lg border border-border/20 divide-y divide-border/20">
            {filteredAvailable.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/40 px-3 py-4 text-center">
                {addSearch ? "No models match" : "No models available"}
              </p>
            ) : (
              filteredAvailable.map((m) => (
                <button
                  key={m.id}
                  onClick={() => addModel(m.id)}
                  className="w-full text-left px-3 py-1.5 hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{m.id}</p>
                    </div>
                    <Plus className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary shrink-0" />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-xs text-muted-foreground/40">Loading...</div>
      ) : models.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
          <p className="text-xs text-muted-foreground/50">No curated models yet.</p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">Click &quot;Add Model&quot; to get started. Without curated models, users see all {available.length} available models.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
          {models.map((model, idx) => {
            const liveName = available.find((a) => a.id === model.modelId)?.name;
            const notFound = !liveName;
            return (
              <div
                key={model.id}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/20 last:border-b-0 ${
                  !model.enabled ? "opacity-40 bg-muted/10" : ""
                }`}
              >
                {/* Reorder */}
                <div className="flex flex-col shrink-0">
                  <button
                    onClick={() => moveModel(model.id, "up")}
                    disabled={idx === 0}
                    className="text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveModel(model.id, "down")}
                    disabled={idx === models.length - 1}
                    className="text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Name + ID */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={model.displayName || ""}
                    placeholder={liveName || model.modelId}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val !== (model.displayName || "")) {
                        updateModel(model.id, { displayName: val || null });
                      }
                    }}
                    className="w-full bg-transparent text-xs font-medium outline-none placeholder:text-muted-foreground/50 hover:bg-muted/30 focus:bg-muted/30 rounded px-1.5 py-0.5 -mx-1.5 transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground/40 font-mono truncate mt-0.5">
                    {model.modelId}
                    {notFound && <span className="ml-2 text-amber-500">⚠ not found</span>}
                  </p>
                </div>

                {/* Indicators (read-only visual) */}
                <div className="hidden sm:flex items-center gap-2 shrink-0 w-24 justify-end">
                  <IntelligenceDots level={model.intelligenceLevel} />
                  <CostIndicator level={model.costLevel} />
                </div>

                {/* Intelligence select */}
                <select
                  value={model.intelligenceLevel}
                  onChange={(e) =>
                    updateModel(model.id, { intelligenceLevel: Number(e.target.value) })
                  }
                  className="shrink-0 bg-muted/20 border border-border/30 rounded-md px-1.5 py-1 text-[11px] outline-none cursor-pointer hover:bg-muted/40"
                  title="Intelligence (1=basic, 5=frontier)"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      IQ {n}
                    </option>
                  ))}
                </select>

                {/* Cost select */}
                <select
                  value={model.costLevel}
                  onChange={(e) =>
                    updateModel(model.id, { costLevel: Number(e.target.value) })
                  }
                  className="shrink-0 bg-muted/20 border border-border/30 rounded-md px-1.5 py-1 text-[11px] outline-none cursor-pointer hover:bg-muted/40"
                  title="Cost level"
                >
                  <option value={1}>$</option>
                  <option value={2}>$$</option>
                  <option value={3}>$$$</option>
                </select>

                {/* Category */}
                <select
                  value={model.category || ""}
                  onChange={(e) =>
                    updateModel(model.id, { category: e.target.value || null })
                  }
                  className="shrink-0 bg-muted/20 border border-border/30 rounded-md px-1.5 py-1 text-[11px] outline-none cursor-pointer hover:bg-muted/40 w-24"
                >
                  <option value="">No tag</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {/* Enabled toggle */}
                <button
                  onClick={() => updateModel(model.id, { enabled: !model.enabled })}
                  className={`shrink-0 relative h-4 w-7 rounded-full transition-colors ${
                    model.enabled ? "bg-primary" : "bg-muted-foreground/20"
                  }`}
                  title={model.enabled ? "Enabled" : "Disabled"}
                >
                  <div
                    className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                      model.enabled ? "translate-x-3.5" : "translate-x-0.5"
                    }`}
                  />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteModel(model.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Remove from curated"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
