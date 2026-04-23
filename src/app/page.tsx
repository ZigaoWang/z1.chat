"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/sidebar";
import ChatView from "@/components/chat/chat-view";
import { useConversations } from "@/hooks/use-conversations";
import { useI18n } from "@/hooks/use-i18n";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { createConversation } = useConversations();
  const { t } = useI18n();
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Cmd/Ctrl + B: Toggle sidebar
      if (mod && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }

      // Cmd/Ctrl + Shift + S: Toggle sidebar (alternative)
      if (mod && e.shiftKey && e.key === "s") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }

      // Cmd/Ctrl + N: New chat
      if (mod && e.key === "n") {
        e.preventDefault();
        createConversation();
      }

      // Cmd/Ctrl + /: Toggle shortcuts help
      if (mod && e.key === "/") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Escape: close any open modal
      if (e.key === "Escape") {
        setShowShortcuts(false);
      }

      // / key: focus chat input (when not in an input)
      if (e.key === "/" && !mod && !isInput) {
        e.preventDefault();
        const chatInput = document.querySelector("textarea[placeholder]") as HTMLTextAreaElement;
        chatInput?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createConversation]);

  // On mobile, default sidebar closed
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={toggleSidebar} />

      <ChatView
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onCollapseSidebar={() => setSidebarOpen(false)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      {/* Shortcuts help modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border/50 bg-card p-6 shadow-lg animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">{t("shortcuts.title")}</h2>
            <div className="space-y-2">
              {[
                [t("shortcuts.newChat"), "\u2318 N"],
                [t("shortcuts.toggleSidebar"), "\u2318 B"],
                [t("shortcuts.modelSelector"), "\u2318 K"],
                [t("shortcuts.focusInput"), "/"],
                [t("shortcuts.help"), "\u2318 /"],
                [t("shortcuts.close"), "Esc"],
              ].map(([label, shortcut]) => (
                <div key={label} className="flex items-center justify-between py-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <kbd className="rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                    {shortcut}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
