"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useAuth } from "./use-auth";

export interface Conversation {
  id: string;
  title: string | null;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string | null;
}

interface ConversationContextType {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  setActiveId: (id: string | null) => void;
  createConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  regenerateTitle: (id: string) => Promise<void>;
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
    // Simply clear the active ID to start a new chat
    // The conversation will be created when the first message is sent
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
      // Show loading state
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

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeId,
        isLoading,
        setActiveId,
        createConversation,
        deleteConversation,
        renameConversation,
        regenerateTitle,
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
