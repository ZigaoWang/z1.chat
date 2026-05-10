"use client";

import { useState, useCallback, useRef } from "react";
import {
  Brain,
  Trash2,
  ChevronDown,
  AlertTriangle,
  Send,
  Loader2,
  Wand2,
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
      const data = await res.json();
      if (data.document !== undefined) {
        setDocument(data.document);
        docRef.current = data.document;
        setDirty(false);
      }
      setChatResult(data.summary);
      setChatInput("");
    } catch {
      toast.error(t("memory.chatError"));
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, t]);

  const handleOrganize = useCallback(async () => {
    if (chatLoading || !document.trim()) return;
    setChatLoading(true);
    setChatResult(null);
    try {
      const res = await fetch("/api/memories/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Organize and clean up my memories. Remove outdated or redundant info, improve wording, make it concise." }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.error || t("memory.chatError"));
        return;
      }
      const data = await res.json();
      if (data.document !== undefined) {
        setDocument(data.document);
        docRef.current = data.document;
        setDirty(false);
      }
      setChatResult(data.summary);
    } catch {
      toast.error(t("memory.chatError"));
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, document, t]);

  const wordCount = document.trim() ? document.trim().split(/\s+/).length : 0;

  return (
    <section className="mb-8">
      {/* Collapsed header */}
      <button
        onClick={handleExpand}
        className="w-full rounded-xl border border-border/40 bg-card px-4 py-3.5 shadow-sm flex items-center gap-3 transition-colors hover:bg-muted/30"
      >
        <Brain className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">{t("memory.title")}</span>
            {document && (
              <span className="text-[11px] text-muted-foreground/50">
                {wordCount} {locale === "zh" ? "词" : "words"}
              </span>
            )}
          </div>
          {!expanded && document && (
            <p className="text-[11px] text-muted-foreground/40 mt-0.5 truncate">
              {document.slice(0, 100)}
            </p>
          )}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/40 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* AI Chat input */}
          <div className="rounded-xl border border-border/40 bg-card px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
                placeholder={t("memory.chatPlaceholder")}
                disabled={chatLoading}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/30 disabled:opacity-50"
              />
              <button
                onClick={handleOrganize}
                disabled={chatLoading || !document.trim()}
                title={locale === "zh" ? "AI 整理" : "AI Organize"}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              >
                <Wand2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleChatSubmit}
                disabled={chatLoading || !chatInput.trim()}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
              >
                {chatLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
            {chatResult && (
              <p className="mt-1.5 text-[11px] text-muted-foreground/60 border-t border-border/20 pt-1.5">{chatResult}</p>
            )}
          </div>

          {/* Memory document textarea */}
          <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
            <textarea
              value={document}
              onChange={(e) => { setDocument(e.target.value); setDirty(e.target.value !== docRef.current); }}
              placeholder={locale === "zh" ? "还没有记忆。开始聊天后会自动记住关于你的信息。" : "No memories yet. Start chatting and I'll remember things about you."}
              rows={Math.max(4, Math.min(12, document.split("\n").length + 1))}
              className="w-full px-4 py-3 text-xs leading-relaxed bg-transparent resize-none outline-none placeholder:text-muted-foreground/30"
            />
            {dirty && (
              <div className="flex justify-end px-3 pb-2.5">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  {locale === "zh" ? "保存" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Clear all */}
          {document && (
            <div className="flex justify-end">
              {showClearConfirm ? (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-[11px] text-destructive">
                    {locale === "zh" ? "确定清除所有记忆？" : "Clear all memories?"}
                  </span>
                  <button onClick={handleClear} className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/90">
                    {t("memory.delete")}
                  </button>
                  <button onClick={() => setShowClearConfirm(false)} className="rounded-md px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                    {t("memory.cancel")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted-foreground/40 hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  {t("memory.clearAll")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
