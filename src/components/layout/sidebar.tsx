"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { Plus, Search, Trash2, Pencil, Check, X, MessageSquare, PanelLeftClose, Settings, MoreHorizontal, Sparkles } from "lucide-react";
import { useConversations, type Conversation } from "@/hooks/use-conversations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ThemeToggle from "./theme-toggle";
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

function groupConversationsByDate(conversations: Conversation[]): DateGroup[] {
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
  if (today.length > 0) groups.push({ label: "Today", conversations: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", conversations: yesterday });
  if (prev7.length > 0) groups.push({ label: "Previous 7 Days", conversations: prev7 });
  if (prev30.length > 0) groups.push({ label: "Previous 30 Days", conversations: prev30 });
  if (older.length > 0) groups.push({ label: "Older", conversations: older });
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
    if (!oldText || oldText === "New conversation" || oldText === text) {
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
    <span className={`block truncate text-sm leading-tight ${isActive ? "font-medium" : "text-foreground/75"}`}>
      {display || "New conversation"}
    </span>
  );
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 250;
const STORAGE_KEY = "one:sidebar-width";

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const {
    conversations, activeId, setActiveId, createConversation,
    deleteConversation, renameConversation, regenerateTitle, searchQuery, setSearchQuery,
  } = useConversations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [mounted, setMounted] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // Resize drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
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

  const grouped = useMemo(() => groupConversationsByDate(conversations), [conversations]);

  const saveEdit = async () => {
    if (editingId && editTitle.trim()) {
      await renameConversation(editingId, editTitle.trim());
      toast.success("Renamed");
    }
    setEditingId(null);
  };

  const confirmDelete = useCallback(async (id: string) => {
    await deleteConversation(id);
    setDeletingId(null);
    toast.success("Deleted");
  }, [deleteConversation]);

  const renderConversation = (conv: Conversation) => {
    const isActive = activeId === conv.id;

    if (deletingId === conv.id) {
      return (
        <div key={conv.id} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground">
          <span className="flex-1 truncate text-destructive">Delete this chat?</span>
          <button onClick={() => confirmDelete(conv.id)} className="rounded p-0.5 text-destructive hover:bg-destructive/10"><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => setDeletingId(null)} className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
        </div>
      );
    }

    if (editingId === conv.id) {
      return (
        <div key={conv.id} className="flex items-center gap-1 px-1 py-0.5">
          <input ref={editInputRef} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingId(null); }}
            className="flex-1 min-w-0 rounded-md bg-background px-2 py-1 text-xs outline-none ring-1 ring-border focus:ring-ring/50" />
          <button onClick={saveEdit} className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><Check className="h-3 w-3" /></button>
          <button onClick={() => setEditingId(null)} className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
        </div>
      );
    }

    return (
      <div key={conv.id} className="relative group">
        <button
          onClick={() => setActiveId(conv.id)}
          className={`w-full flex items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
            isActive ? "bg-muted" : "hover:bg-muted/50"
          }`}
        >
          <div className="min-w-0 flex-1">
            <TypewriterTitle text={conv.title || "New conversation"} isActive={isActive} />
          </div>
          <span
            className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conv.id ? null : conv.id); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </span>
        </button>

        {menuOpenId === conv.id && (
          <div ref={menuRef} className="absolute right-1 top-full z-20 mt-0.5 w-36 rounded-lg border border-border bg-popover py-1 shadow-lg">
            <button
              onClick={() => { setMenuOpenId(null); regenerateTitle(conv.id); }}
              className="flex w-full items-center gap-2 px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted transition-colors"
            >
              <Sparkles className="h-3 w-3" /> Generate title
            </button>
            <button
              onClick={() => { setMenuOpenId(null); setEditingId(conv.id); setEditTitle(conv.title || ""); }}
              className="flex w-full items-center gap-2 px-2.5 py-1 text-xs text-foreground/80 hover:bg-muted transition-colors"
            >
              <Pencil className="h-3 w-3" /> Rename
            </button>
            <button
              onClick={() => { setMenuOpenId(null); setDeletingId(conv.id); }}
              className="flex w-full items-center gap-2 px-2.5 py-1 text-xs text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        style={mounted ? { width: isOpen ? width : 0 } : undefined}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-200 ease-out lg:relative ${
          !mounted ? "w-[250px] " : ""
        }${isOpen ? "translate-x-0" : "-translate-x-full"
        } ${isOpen ? "" : "lg:-translate-x-full lg:w-0 lg:overflow-hidden"}`}
      >
        <div className="flex h-10 shrink-0 items-center justify-between px-2.5 border-b border-sidebar-border/50">
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger onClick={createConversation}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">New chat</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger onClick={onClose}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground transition-colors">
                <PanelLeftClose className="h-3.5 w-3.5" />
              </TooltipTrigger>
              <TooltipContent side="bottom">Close sidebar</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="px-1.5 py-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 w-full rounded-md border-0 bg-muted/40 pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground/25 focus:bg-muted/60 transition-colors" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-1.5 pb-1.5 scrollbar-thin">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground/15" />
              <p className="mt-1.5 text-xs text-muted-foreground/25">{searchQuery ? "No results" : "No conversations"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.label}>
                  <div className="px-1.5 pb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground/30 uppercase tracking-wider">{group.label}</span>
                  </div>
                  <div className="space-y-px">
                    {group.conversations.map(renderConversation)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-sidebar-border/40 px-1.5 py-1 space-y-px">
          <ThemeToggle />
          <Link href="/settings"
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground/50 hover:bg-muted/50 hover:text-foreground transition-colors">
            <Settings className="h-3.5 w-3.5" /> Settings
          </Link>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleDragStart}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
        />
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] lg:hidden" onClick={onClose} />
      )}
    </>
  );
}
