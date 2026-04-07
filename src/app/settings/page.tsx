"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Trash2,
  Brain,
  Palette,
  User,
  Pencil,
  Check,
  X,
  AlertTriangle,
  Sun,
  Moon,
  Monitor,
  MessageSquare,
  Sparkles,
  CreditCard,
  Key,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import Link from "next/link";

interface Memory {
  id: string;
  category: string;
  content: string;
  sourceConversationId: string | null;
  sourceTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserSettings {
  name: string | null;
  email: string | null;
  preferences: {
    theme: "light" | "dark" | "system";
    defaultModel: string | null;
    responseStyle: "concise" | "balanced" | "detailed";
    language: string | null;
    customInstructions: string | null;
  };
}

const categoryLabel: Record<string, string> = {
  personal: "Personal Info",
  preferences: "Preferences",
  projects: "Projects",
  style: "Communication Style",
  facts: "Facts",
};

const categoryIcon: Record<string, React.ElementType> = {
  personal: User,
  preferences: Palette,
  projects: MessageSquare,
  style: Sparkles,
  facts: Brain,
};

const CATEGORY_ORDER = ["personal", "projects", "preferences", "style", "facts"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingMemory, setEditingMemory] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [instructionsSaved, setInstructionsSaved] = useState(true);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setCustomInstructions(data?.preferences?.customInstructions || "");
      })
      .catch(() => toast.error("Failed to load settings"));

    fetch("/api/memories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMemories(data);
      })
      .catch(() => toast.error("Failed to load memories"));
  }, []);

  const updatePreference = useCallback(
    async (key: string, value: string | null) => {
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preferences: { [key]: value },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSettings((prev) =>
            prev ? { ...prev, preferences: data.preferences } : prev
          );
          toast.success("Saved");
        }
      } catch {
        toast.error("Failed to save preference");
      }
    },
    []
  );

  const saveCustomInstructions = useCallback(async () => {
    await updatePreference("customInstructions", customInstructions || null);
    setInstructionsSaved(true);
  }, [customInstructions, updatePreference]);

  const deleteMemory = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
        toast.success("Memory deleted");
      }
    } catch {
      toast.error("Failed to delete memory");
    }
  }, []);

  const clearAllMemories = useCallback(async () => {
    try {
      const res = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      if (res.ok) {
        setMemories([]);
        setShowClearConfirm(false);
        toast.success("All memories cleared");
      }
    } catch {
      toast.error("Failed to clear memories");
    }
  }, []);

  const saveMemoryEdit = useCallback(
    async (id: string) => {
      try {
        const res = await fetch("/api/memories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, content: editContent }),
        });
        if (res.ok) {
          const updated = await res.json();
          setMemories((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: updated.content, updatedAt: updated.updatedAt } : m))
          );
          setEditingMemory(null);
          toast.success("Memory updated");
        }
      } catch {
        toast.error("Failed to update memory");
      }
    },
    [editContent]
  );

  const groupedMemories = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const catMemories = memories.filter((m) => m.category === cat);
      if (catMemories.length > 0) {
        groups[cat] = catMemories;
      }
    }
    for (const m of memories) {
      if (!CATEGORY_ORDER.includes(m.category)) {
        if (!groups[m.category]) groups[m.category] = [];
        if (!groups[m.category].some((gm) => gm.id === m.id)) {
          groups[m.category].push(m);
        }
      }
    }
    return groups;
  }, [memories]);

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        </div>

        {/* Profile Section */}
        <section className="mb-8">
          <SectionHeader icon={User} title="Profile" />
          <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs">Name</span>
              <span className="text-xs text-muted-foreground">
                {settings?.name || "Developer"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs">Email</span>
              <span className="text-xs text-muted-foreground">
                {settings?.email || "\u2014"}
              </span>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="mb-8">
          <SectionHeader icon={Palette} title="Appearance" />
          <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs">Theme</span>
              <div className="flex gap-1 rounded-lg border border-border/30 bg-muted/30 p-0.5">
                {([
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "System" },
                ] as const).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setTheme(t.value);
                      updatePreference("theme", t.value);
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                      theme === t.value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AI Preferences */}
        <section className="mb-8">
          <SectionHeader icon={Sparkles} title="AI Preferences" />
          <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 shadow-sm">
            {/* Response Style */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <span className="text-xs">Response Style</span>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">How detailed should responses be</p>
              </div>
              <div className="flex gap-1 rounded-lg border border-border/30 bg-muted/30 p-0.5">
                {(["concise", "balanced", "detailed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => updatePreference("responseStyle", s)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                      settings?.preferences?.responseStyle === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between px-4 py-3.5">
              <div>
                <span className="text-xs">Language</span>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">Preferred response language</p>
              </div>
              <select
                value={settings?.preferences?.language || ""}
                onChange={(e) =>
                  updatePreference("language", e.target.value || null)
                }
                className="rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/20 transition-all"
              >
                <option value="">Auto-detect</option>
                <option value="English">English</option>
                <option value="Chinese">{"\u4E2D\u6587"}</option>
                <option value="Spanish">{"\u0045\u0073\u0070\u0061\u00F1\u006F\u006C"}</option>
                <option value="Japanese">{"\u65E5\u672C\u8A9E"}</option>
                <option value="Korean">{"\uD55C\uAD6D\uC5B4"}</option>
                <option value="French">{"\u0046\u0072\u0061\u006E\u00E7\u0061\u0069\u0073"}</option>
                <option value="German">Deutsch</option>
              </select>
            </div>

            {/* Custom Instructions */}
            <div className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs">Custom Instructions</span>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    Tell the AI about yourself or how you&apos;d like it to respond
                  </p>
                </div>
                {!instructionsSaved && (
                  <button
                    onClick={saveCustomInstructions}
                    className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Save
                  </button>
                )}
              </div>
              <textarea
                value={customInstructions}
                onChange={(e) => {
                  setCustomInstructions(e.target.value);
                  setInstructionsSaved(false);
                }}
                onBlur={() => {
                  if (!instructionsSaved) saveCustomInstructions();
                }}
                placeholder="e.g., I'm a senior developer working on a React project. Prefer TypeScript examples with modern patterns..."
                rows={4}
                className="w-full rounded-lg border border-border/40 bg-muted/10 px-3 py-2 text-xs leading-relaxed resize-none outline-none placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-primary/20 focus:border-primary/20 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Memory */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <SectionHeader icon={Brain} title="Memory" count={memories.length} />
            {memories.length > 0 && !showClearConfirm && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-muted-foreground/50 transition-colors hover:text-destructive hover:bg-destructive/8"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {showClearConfirm && (
            <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive">
                  Delete all {memories.length} memories?
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllMemories}
                  className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {memories.length === 0 ? (
            <div className="rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm">
              <Brain className="mx-auto h-8 w-8 text-muted-foreground/15" />
              <p className="mt-2 text-xs text-muted-foreground/40">
                No memories yet. Start chatting and I&apos;ll remember important
                details about you.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMemories).map(([category, catMemories]) => {
                const Icon = categoryIcon[category] || Brain;
                return (
                  <div key={category}>
                    <div className="flex items-center gap-1.5 mb-2 px-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        {categoryLabel[category] || category}
                      </h3>
                      <span className="text-[11px] text-muted-foreground/30">
                        ({catMemories.length})
                      </span>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 shadow-sm">
                      {catMemories.map((memory) => (
                        <div
                          key={memory.id}
                          className="group px-4 py-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              {editingMemory === memory.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveMemoryEdit(memory.id);
                                      if (e.key === "Escape") setEditingMemory(null);
                                    }}
                                    className="flex-1 rounded-md bg-muted/30 px-2 py-1 text-xs outline-none ring-1 ring-primary/30 focus:ring-primary/50"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => saveMemoryEdit(memory.id)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingMemory(null)}
                                    className="text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-xs leading-relaxed">
                                  {memory.content}
                                </p>
                              )}
                              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/35">
                                <span>{formatDate(memory.updatedAt || memory.createdAt)}</span>
                                {memory.sourceTitle && memory.sourceConversationId && (
                                  <>
                                    <span>{"\u00B7"}</span>
                                    <Link
                                      href={`/?c=${memory.sourceConversationId}`}
                                      className="hover:text-muted-foreground/60 transition-colors truncate max-w-[200px]"
                                    >
                                      {memory.sourceTitle}
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                            {editingMemory !== memory.id && (
                              <div className="hidden items-center gap-1 group-hover:flex shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingMemory(memory.id);
                                    setEditContent(memory.content);
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => deleteMemory(memory.id)}
                                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-muted transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Coming Soon sections */}
        <section className="mb-8">
          <SectionHeader icon={CreditCard} title="Credits & Usage" />
          <div className="rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm">
            <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/15" />
            <p className="mt-2 text-xs text-muted-foreground/40">
              Credit system coming soon
            </p>
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader icon={Key} title="API Keys" />
          <div className="rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm">
            <Key className="mx-auto h-8 w-8 text-muted-foreground/15" />
            <p className="mt-2 text-xs text-muted-foreground/40">
              Bring your own API key — coming soon
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Shared section header ---
function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground/50" />
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/50">
        {title}
      </h2>
      {count !== undefined && (
        <span className="text-[11px] text-muted-foreground/35">
          ({count})
        </span>
      )}
    </div>
  );
}
