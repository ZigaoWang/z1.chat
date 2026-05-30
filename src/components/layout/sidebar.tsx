"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { Plus, Search, Trash2, Pencil, Check, X, MessageSquare, PanelLeftClose, Settings, MoreHorizontal, Sparkles, LogOut, CreditCard, ChevronUp, Languages, Pin, PinOff } from "lucide-react";
import { useConversations, type Conversation } from "@/hooks/use-conversations";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useI18n } from "@/hooks/use-i18n";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ThemeToggle from "./theme-toggle";
import { formatCNY } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { toast } from "sonner";
import Link from "next/link";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DateGroup {
  label: string;
  conversations: Conversation[];
}

function groupConversationsByDate(conversations: Conversation[], labels: { today: string; yesterday: string; prev7: string; prev30: string; older: string }): DateGroup[] {
  const groups: DateGroup[] = [];
  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const prev7: Conversation[] = [];
  const prev30: Conversation[] = [];
  const older: Conversation[] = [];
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const thirtyDaysAgo = subDays(now, 30);
  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (isToday(date)) today.push(conv);
    else if (isYesterday(date)) yesterday.push(conv);
    else if (isAfter(date, sevenDaysAgo)) prev7.push(conv);
    else if (isAfter(date, thirtyDaysAgo)) prev30.push(conv);
    else older.push(conv);
  }
  if (today.length > 0) groups.push({ label: labels.today, conversations: today });
  if (yesterday.length > 0) groups.push({ label: labels.yesterday, conversations: yesterday });
  if (prev7.length > 0) groups.push({ label: labels.prev7, conversations: prev7 });
  if (prev30.length > 0) groups.push({ label: labels.prev30, conversations: prev30 });
  if (older.length > 0) groups.push({ label: labels.older, conversations: older });
  return groups;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
}

// --- Typewriter title ---
function TypewriterTitle({ text, isActive }: { text: string; isActive: boolean }) {
  const [display, setDisplay] = useState(text);
  const prevText = useRef(text);

  useEffect(() => {
    if (text === prevText.current) return;
    const oldText = prevText.current;
    prevText.current = text;

    // Only animate if title actually changed (not just first render)
    if (!oldText || oldText === "New conversation" || oldText === "新对话" || oldText === text) {
      setDisplay(text);
      return;
    }

    // Typewriter: reveal characters one by one
    let i = 0;
    setDisplay("");
    const interval = setInterval(() => {
      i++;
      setDisplay(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, 25);
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={`block truncate text-[13px] leading-tight ${isActive ? "font-medium text-foreground" : "text-foreground/70"}`}>
      {display || "New conversation"}
    </span>
  );
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 250;
const STORAGE_KEY = "z1:sidebar-width";

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    conversations, pinnedConversations, unpinnedConversations,
    activeId, setActiveId, createConversation,
    deleteConversation, renameConversation, regenerateTitle,
    pinConversation, unpinConversation, reorderPinned,
    searchQuery, setSearchQuery, isLoading,
  } = useConversations();
  const { user, signOut } = useAuth();
  const { creditBalance, isZero, isLow, isCritical } = useCredits();
  const { t, locale, setLocale } = useI18n();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [mounted, setMounted] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const footerRef = useRef<HTMLDivElement>(null);

  // Load saved width after mount to avoid hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) setWidth(n);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (editingId) { editInputRef.current?.focus(); editInputRef.current?.select(); }
  }, [editingId]);

  useEffect(() => {
    if (deletingId) {
      deleteTimerRef.current = setTimeout(() => setDeletingId(null), 3000);
      return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
    }
  }, [deletingId]);

  // Resize drag handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      // If dragged far left, close immediately
      if (ev.clientX < 100) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        const saved = localStorage.getItem(STORAGE_KEY);
        setWidth(saved ? parseInt(saved, 10) : DEFAULT_WIDTH);
        onClose();
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleUp);
        return;
      }
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX));
      setWidth(newWidth);
    };
    const handleUp = (ev: MouseEvent) => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const final = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX));
      setWidth(final);
      localStorage.setItem(STORAGE_KEY, String(final));
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, [onClose]);

  const grouped = useMemo(() => groupConversationsByDate(unpinnedConversations, {
    today: t("sidebar.today"),
    yesterday: t("sidebar.yesterday"),
    prev7: t("sidebar.prev7"),
    prev30: t("sidebar.prev30"),
    older: t("sidebar.older"),
  }), [unpinnedConversations, t]);

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
      toast.success(t("sidebar.renamed"));
    }
    setEditingId(null);
  };

  const confirmDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    setDeletingId(null);
    toast.success(t("sidebar.deleted"));
  }, [deleteConversation, t]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (id !== dragId) setDragOverId(id);
  }, [dragId]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const ids = pinnedConversations.map((c) => c.id);
    const fromIdx = ids.indexOf(dragId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { setDragId(null); setDragOverId(null); return; }
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, dragId);
    reorderPinned(ids);
    setDragId(null);
    setDragOverId(null);
  }, [dragId, pinnedConversations, reorderPinned]);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDragOverId(null);
  }, []);

  const renderConversation = (conv: Conversation, { pinned }: { pinned: boolean }) => {
    const isActive = activeId === conv.id;

    if (deletingId === conv.id) {
      return (
        <div key={conv.id}>
          <div className="flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 bg-destructive/5">
            <span className="flex-1 truncate text-[13px] text-destructive">{t("sidebar.deleteChat")}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => confirmDelete(conv.id)} className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => setDeletingId(null)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      );
    }

    if (editingId === conv.id) {
      return (
        <div key={conv.id} className="flex items-center gap-1 px-1 py-0.5">
          <input ref={editInputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
            className="flex-1 min-w-0 rounded-md bg-background px-2 py-1 text-[13px] outline-none ring-1 ring-border focus:ring-foreground/20" />
          <button onClick={saveEdit} className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => setEditingId(null)} className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      );
    }

    return (
      <div
        key={conv.id}
        draggable={pinned}
        onDragStart={pinned ? (e) => handleDragStart(e, conv.id) : undefined}
        onDragOver={pinned ? (e) => handleDragOver(e, conv.id) : undefined}
        onDrop={pinned ? (e) => handleDrop(e, conv.id) : undefined}
        onDragEnd={pinned ? handleDragEnd : undefined}
        className={cn(
          "group flex items-center rounded-md",
          isActive ? "bg-muted" : "hover:bg-muted/50",
          pinned && "cursor-grab active:cursor-grabbing",
          dragId === conv.id && "opacity-40",
          dragOverId === conv.id && "border-t-2 border-primary/40"
        )}
      >
        <button
          onClick={() => {
            setActiveId(conv.id);
            if (window.innerWidth < 1024) onClose();
          }}
          className="min-w-0 flex-1 px-2 py-1.5 text-left"
        >
          <TypewriterTitle text={conv.title || t("sidebar.newConversation")} isActive={isActive} />
        </button>
        <Popover>
          <PopoverTrigger
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground mr-0.5 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100 transition-opacity duration-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </PopoverTrigger>
          <PopoverContent side="right" align="start" sideOffset={4} className="w-[160px] p-1 gap-0 !duration-0">
            <button
              onClick={() => { regenerateTitle(conv.id); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted"
            >
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground/60" /> {t("sidebar.generateTitle")}
            </button>
            <button
              onClick={() => { setEditingId(conv.id); setEditTitle(conv.title || ""); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground/60" /> {t("sidebar.rename")}
            </button>
            {pinned ? (
              <button
                onClick={() => { unpinConversation(conv.id); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted"
              >
                <PinOff className="h-3.5 w-3.5 text-muted-foreground/60" /> {t("sidebar.unpin")}
              </button>
            ) : (
              <button
                onClick={() => { pinConversation(conv.id); }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted"
              >
                <Pin className="h-3.5 w-3.5 text-muted-foreground/60" /> {t("sidebar.pin")}
              </button>
            )}
            <button
              onClick={() => { setDeletingId(conv.id); }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("sidebar.delete")}
            </button>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  // On mobile (fixed), use default width so -translate-x-full works.
  // On desktop (lg:relative), use inline width for resizable behavior.
  const sidebarStyle = mounted
    ? isOpen
      ? { width }
      : undefined
    : undefined;

  return (
    <>
      <div
        style={sidebarStyle}
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar border-r border-border/40 transition-[transform,width] duration-200 ease-out lg:relative",
          // Mobile: always keep a width so -translate-x-full moves it fully off-screen
          !isOpen ? "w-[250px]" : "",
          // When open on desktop with mounted, inline style sets width; otherwise fallback
          !mounted ? "w-[250px]" : "",
          // Slide transform
          isOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop closed: collapse to 0 width + hide overflow
          !isOpen ? "lg:w-0 lg:overflow-hidden" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="flex h-11 shrink-0 items-center justify-between px-2.5 border-b border-border/40">
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger onClick={() => {
                createConversation();
                if (window.innerWidth < 1024) onClose();
              }}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <Plus className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("sidebar.newChat")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                <PanelLeftClose className="h-4 w-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("sidebar.closeSidebar")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="px-2.5 py-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("sidebar.search")}
              className="h-7 w-full rounded-md bg-transparent pl-7 pr-3 text-[13px] outline-none placeholder:text-muted-foreground/40 focus:bg-muted/50" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-2 scrollbar-thin">
          {isLoading && conversations.length === 0 ? (
            <div className="space-y-1 px-0.5 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 rounded-md bg-muted/30 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground/25" />
              <p className="mt-1.5 text-xs text-muted-foreground/40">{searchQuery ? t("sidebar.noResults") : t("sidebar.noConversations")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pinnedConversations.length > 0 && (
                <div>
                  <div className="px-2 pb-1">
                    <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wide">{t("sidebar.pinned")}</span>
                  </div>
                  <div className="space-y-px">
                    {pinnedConversations.map((c) => renderConversation(c, { pinned: true }))}
                  </div>
                </div>
              )}
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pb-1">
                    <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wide">{group.label}</span>
                  </div>
                  <div className="space-y-px">
                    {group.conversations.map((c) => renderConversation(c, { pinned: false }))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border/40 px-2 py-1.5" ref={footerRef}>
          <Popover>
            <PopoverTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-foreground/5 text-left transition-colors duration-100">
              <span className="flex-1 truncate font-medium text-foreground/80">{user?.name || user?.email}</span>
              <span className={cn(
                "tabular-nums text-xs text-muted-foreground/50 shrink-0",
                isCritical && "text-amber-500",
                isZero && "text-red-500/70"
              )}>
                {formatCNY(creditBalance)}
              </span>
              <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            </PopoverTrigger>
            <PopoverContent side="top" align="center" sideOffset={8} className="p-1 gap-0 !duration-0" style={{ width: width - 16 }}>
                <div className="px-2 py-1.5 text-xs text-muted-foreground/50 border-b border-border/50 mb-1">
                  {user?.email}
                </div>
                <ThemeToggle />
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Languages className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <div className="relative flex flex-1 items-center rounded-md bg-muted/50 p-0.5">
                    <div
                      className="absolute left-0.5 top-0.5 bottom-0.5 rounded bg-background shadow-sm transition-transform duration-200 ease-in-out"
                      style={{
                        width: "calc((100% - 4px) / 2)",
                        transform: `translateX(${locale === "zh" ? "100%" : "0%"})`,
                      }}
                    />
                    <button
                      onClick={() => setLocale("en")}
                      className={`relative flex-1 rounded h-6 text-xs text-center transition-colors duration-200 ${
                        locale === "en" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >EN</button>
                    <button
                      onClick={() => setLocale("zh")}
                      className={`relative flex-1 rounded h-6 text-xs text-center transition-colors duration-200 ${
                        locale === "zh" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >中文</button>
                  </div>
                </div>
                <Link href="/settings#credits"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/50">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="flex-1">{t("sidebar.balance")}</span>
                  <span className={cn(
                    "tabular-nums text-xs text-muted-foreground/60",
                    isCritical && "text-amber-500",
                    isZero && "text-red-500/70"
                  )}>
                    {formatCNY(creditBalance)}
                  </span>
                </Link>
                <Link href="/settings"
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/50">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground/60" />
                  {t("sidebar.settings")}
                </Link>
                <div className="border-t border-border/50 mt-0.5 pt-0.5">
                  <button
                    onClick={signOut}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted/50">
                    <LogOut className="h-3.5 w-3.5 text-muted-foreground/60" />
                    {t("sidebar.signOut")}
                  </button>
                </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Resize handle — hidden on mobile where sidebar is an overlay */}
        <div
          onMouseDown={handleResizeStart}
          className="hidden lg:block absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} />
      )}
    </>
  );
}
