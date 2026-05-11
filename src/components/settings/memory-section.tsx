"use client";

import { useState, useCallback, useRef } from "react";
import {
  Brain,
  Trash2,
  ChevronRight,
  Send,
  Loader2,
  Sparkles,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/use-i18n";

export default function MemorySection() {
  const { t, locale } = useI18n();
  const [document, setDocument] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const docRef = useRef(document);

  const loadMemory = useCallback(async () => {
    try {
      const res = await fetch("/api/memories");
      const data = await res.json();
      setDocument(data.document || "");
      docRef.current = data.document || "";
      setLoaded(true);
    } catch {
      toast.error(t("memory.failedToLoad"));
    }
  }, [t]);

  const handleExpand = useCallback(() => {
    if (!loaded) loadMemory();
    setExpanded((v) => !v);
  }, [loaded, loadMemory]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/memories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document }),
      });
      if (res.ok) {
        docRef.current = document;
        setDirty(false);
        toast.success(t("memory.updated"));
      }
    } catch {
      toast.error(t("memory.failedToUpdate"));
    } finally {
      setSaving(false);
    }
  }, [document, t]);

  const handleClear = useCallback(async () => {
    try {
      const res = await fetch("/api/memories", { method: "DELETE" });
      if (res.ok) {
        setDocument("");
        docRef.current = "";
        setDirty(false);
        setShowClearConfirm(false);
        toast.success(t("memory.allCleared"));
      }
    } catch {
      toast.error(t("memory.failedToClear"));
    }
  }, [t]);

  const readStream = useCallback(async (res: Response): Promise<string> => {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      const cleaned = accumulated
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/^```\w*\n?|```$/g, "")
        .trim();
      setDocument(cleaned);
    }

    return accumulated
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .replace(/^```\w*\n?|```$/g, "")
      .trim();
  }, []);

  const handleChatSubmit = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    setChatLoading(true);
    setChatResult(null);
    try {
      const res = await fetch("/api/memories/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || t("memory.chatError"));
        return;
      }

      const final = await readStream(res);
      setDocument(final);
      docRef.current = final;
      setDirty(false);
      setChatResult(locale === "zh" ? "已更新" : "Updated");
      setChatInput("");
    } catch {
      toast.error(t("memory.chatError"));
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, t, locale, readStream]);

  const handleOrganize = useCallback(async () => {
    if (chatLoading || !document.trim()) return;
    setChatLoading(true);
    setChatResult(null);
    try {
      const res = await fetch("/api/memories/organize", { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || t("memory.chatError"));
        return;
      }

      const final = await readStream(res);
      setDocument(final);
      docRef.current = final;
      setDirty(false);
      setChatResult(locale === "zh" ? "记忆已整理完成" : "Organized");
    } catch {
      toast.error(t("memory.chatError"));
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, document, t, locale, readStream]);

  const lineCount = document.trim() ? document.trim().split("\n").filter(Boolean).length : 0;

  return (
    <section>
      <button
        onClick={handleExpand}
        className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/50"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/8 dark:bg-primary/12">
          <Brain className="h-3.5 w-3.5 text-primary/70" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm font-medium text-foreground">{t("memory.title")}</span>
          {!expanded && document && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {lineCount} {locale === "zh" ? "条记忆" : lineCount === 1 ? "memory" : "memories"}
            </p>
          )}
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${expanded ? "rotate-90" : "group-hover:translate-x-0.5"}`} />
      </button>

      {expanded && (
        <div className="mt-2 ml-1 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Command bar */}
          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 dark:bg-muted/20 px-3 py-2 focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10 transition-all">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
              placeholder={t("memory.chatPlaceholder")}
              disabled={chatLoading}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
            />
            <button
              onClick={handleOrganize}
              disabled={chatLoading || !document.trim()}
              title={locale === "zh" ? "AI 整理" : "Organize"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/60"
            >
              {chatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={handleChatSubmit}
              disabled={chatLoading || !chatInput.trim()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/8 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/60"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          {chatResult && (
            <p className="text-xs text-muted-foreground/70 px-1">{chatResult}</p>
          )}

          {/* Document editor */}
          <div className="rounded-lg border border-border/50 bg-background dark:bg-muted/10 overflow-hidden transition-colors focus-within:border-border">
            <textarea
              value={document}
              onChange={(e) => { setDocument(e.target.value); setDirty(e.target.value !== docRef.current); }}
              placeholder={locale === "zh" ? "还没有记忆。开始聊天后会自动记住关于你的信息。" : "No memories yet. Start chatting and I'll remember things about you."}
              rows={Math.max(5, Math.min(14, document.split("\n").length + 1))}
              className="w-full px-3.5 py-3 text-sm leading-relaxed bg-transparent resize-none outline-none placeholder:text-muted-foreground/30 font-mono"
            />
            {(dirty || document) && (
              <div className="flex items-center justify-between border-t border-border/30 px-3.5 py-2">
                <span className="text-xs text-muted-foreground/50">
                  {lineCount} {locale === "zh" ? "条" : lineCount === 1 ? "item" : "items"}
                </span>
                <div className="flex items-center gap-2">
                  {document && (
                    showClearConfirm ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-destructive/80">
                          {locale === "zh" ? "确定？" : "Sure?"}
                        </span>
                        <button
                          onClick={handleClear}
                          className="rounded-md px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          {t("memory.delete")}
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="rounded-md px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                        >
                          {t("memory.cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-muted-foreground/50 hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                        {t("memory.clearAll")}
                      </button>
                    )
                  )}
                  {dirty && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      {locale === "zh" ? "保存" : "Save"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
