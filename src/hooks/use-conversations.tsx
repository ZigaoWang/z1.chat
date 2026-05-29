"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from "react";
import { useAuth } from "./use-auth";

export interface Conversation {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
  pinOrder?: number | null;
}

interface ConversationContextType {
  conversations: Conversation[];
  pinnedConversations: Conversation[];
  unpinnedConversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  setActiveId: (id: string | null) => void;
  createConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  regenerateTitle: (id: string) => Promise<void>;
  pinConversation: (id: string) => Promise<void>;
  unpinConversation: (id: string) => Promise<void>;
  reorderPinned: (orderedIds: string[]) => Promise<void>;
  refreshConversations: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const ConversationContext = createContext<ConversationContextType | null>(null);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const pinnedConversations = useMemo(
    () => conversations.filter((c) => c.pinOrder != null).sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0)),
    [conversations]
  );

  const unpinnedConversations = useMemo(
    () => conversations.filter((c) => c.pinOrder == null),
    [conversations]
  );

  const refreshConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (user) {
      refreshConversations();
    } else {
      setConversations([]);
      setIsLoading(false);
    }
  }, [user, refreshConversations]);

  const createConversation = useCallback(() => {
    setActiveId(null);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeId === id) setActiveId(null);
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    },
    [activeId]
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title } : c))
        );
      }
    } catch (error) {
      console.error("Failed to rename conversation:", error);
    }
  }, []);

  const regenerateTitle = useCallback(async (id: string) => {
    try {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: "Generating..." } : c))
      );
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateTitle: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: data.title } : c))
        );
      }
    } catch (error) {
      console.error("Failed to regenerate title:", error);
      await refreshConversations();
    }
  }, [refreshConversations]);

  const pinConversation = useCallback(async (id: string) => {
    // Optimistic: assign next pinOrder
    const maxPin = conversations.reduce((max, c) => Math.max(max, c.pinOrder ?? -1), -1);
    const newOrder = maxPin + 1;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinOrder: newOrder } : c))
    );
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinOrder: newOrder }),
      });
    } catch (error) {
      console.error("Failed to pin conversation:", error);
      await refreshConversations();
    }
  }, [conversations, refreshConversations]);

  const unpinConversation = useCallback(async (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinOrder: null } : c))
    );
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinOrder: null }),
      });
    } catch (error) {
      console.error("Failed to unpin conversation:", error);
      await refreshConversations();
    }
  }, [refreshConversations]);

  const reorderPinned = useCallback(async (orderedIds: string[]) => {
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => {
        const idx = orderedIds.indexOf(c.id);
        return idx >= 0 ? { ...c, pinOrder: idx } : c;
      })
    );
    try {
      await fetch("/api/conversations/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
    } catch (error) {
      console.error("Failed to reorder:", error);
      await refreshConversations();
    }
  }, [refreshConversations]);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        pinnedConversations,
        unpinnedConversations,
        activeId,
        isLoading,
        setActiveId,
        createConversation,
        deleteConversation,
        renameConversation,
        regenerateTitle,
        pinConversation,
        unpinConversation,
        reorderPinned,
        refreshConversations,
        searchQuery,
        setSearchQuery,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationContext);
  if (!ctx) throw new Error("useConversations must be used within ConversationProvider");
  return ctx;
}
