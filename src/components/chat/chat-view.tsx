"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelLeft, Plus, AlertCircle, RotateCcw } from "lucide-react";
import ChatMessages, { type VersionEntry, type EditBranch } from "@/components/chat/chat-messages";
import ChatInput, { type EditingState } from "@/components/chat/chat-input";
import ModelSelector from "@/components/chat/model-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useModels } from "@/hooks/use-models";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type UploadedFile, uploadFiles } from "./file-upload";
import { type ToolInvocation } from "./message-bubble";
import ArtifactPreview, { extractArtifacts, isArtifact } from "./artifact-preview";
import { toast } from "sonner";

interface ChatViewProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onCollapseSidebar: () => void;
  onOpenSidebar: () => void;
}

interface MessageAttachments {
  images: string[];
  files: { name: string; type: string; url: string; size?: number }[];
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function ChatView({ sidebarOpen, onToggleSidebar, onCollapseSidebar, onOpenSidebar }: ChatViewProps) {
  const { activeId, setActiveId, refreshConversations } = useConversations();
  const { selectedModel, selectModel } = useModels();
  const greeting = getGreeting();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [artifactPanel, setArtifactPanel] = useState<{ code: string; language: string; title?: string; streaming?: boolean } | null>(null);
  const [artifactWidth, setArtifactWidth] = useState(50); // percentage
  const [isDraggingArtifact, setIsDraggingArtifact] = useState(false);
  const savedInputRef = useRef("");
  const artifactAutoOpened = useRef(false);
  const lastArtifactLen = useRef(0);
  const sidebarWasOpen = useRef(false);
  const artifactDragging = useRef(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const initialLoadDone = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const selectedModelRef = useRef(selectedModel);
  const setActiveIdRef = useRef(setActiveId);

  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { selectedModelRef.current = selectedModel; }, [selectedModel]);
  useEffect(() => { setActiveIdRef.current = setActiveId; }, [setActiveId]);

  const isFirstMessageRef = useRef(false);

  useEffect(() => {
    // Don't stop the stream if this activeId change came from creating a new conversation
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      setConversationId(activeId);
      initialLoadDone.current = true;
      return;
    }
    stop();
    setConversationId(activeId);
    initialLoadDone.current = false;
    setEditingState(null);
    setArtifactPanel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
          try {
            const response = await fetch(url, init);
            if (!response.ok) {
              const text = await response.text();
              let errorMsg = `Request failed (${response.status})`;
              try {
                const json = JSON.parse(text);
                errorMsg = json.error || errorMsg;
              } catch {
                if (text) errorMsg = text;
              }
              throw new Error(errorMsg);
            }
            const newConvId = response.headers.get("X-Conversation-Id");
            if (newConvId && !conversationIdRef.current) {
              isFirstMessageRef.current = true;
              setConversationId(newConvId);
              setActiveIdRef.current(newConvId);
            }
            return response;
          } catch (error) {
            console.error("[transport] Fetch error:", error);
            throw error;
          }
        },
      })
  );

  const [chatError, setChatError] = useState<string | null>(null);
  const lastSendRef = useRef<{ text?: string; body?: Record<string, unknown> } | null>(null);

  const {
    messages,
    status,
    stop,
    setMessages,
    sendMessage,
  } = useChat({
    transport,
    onError: (error) => {
      const raw = error.message || "Something went wrong";
      // Parse the error into a human-readable message
      let msg = raw;
      try {
        // Error might be a JSON string from OpenRouter
        const parsed = JSON.parse(raw);
        msg = parsed.message || parsed.error || raw;
      } catch {
        // Not JSON, use as-is
      }
      // Simplify common errors
      if (msg.includes("rate") && (msg.includes("limit") || msg.includes("increased"))) {
        msg = "This model is currently rate-limited. Try a different model or wait a moment.";
      } else if (msg.includes("temporarily") && msg.includes("unavailable")) {
        msg = "This model is temporarily unavailable. Try a different model.";
      } else if (msg.length > 200) {
        msg = msg.slice(0, 200) + "...";
      }
      console.error("[chat] Error:", raw);
      setChatError(msg);
    },
    onFinish: () => {
      setChatError(null);
      refreshConversations();
      setTimeout(() => refreshConversations(), 3000);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const messageModelMap = useRef<Map<string, string>>(new Map());
  const [messageAttachments, setMessageAttachments] = useState<Record<string, MessageAttachments>>({});
  const [regenerationHistory, setRegenerationHistory] = useState<Record<string, VersionEntry[]>>({});
  const [editBranches, setEditBranches] = useState<Record<string, EditBranch[]>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [restoredToolInvocations, setRestoredToolInvocations] = useState<Record<string, ToolInvocation[]>>({});

  useEffect(() => {
    if (activeId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      messageModelMap.current.clear();
      setMessageAttachments({});
      setRegenerationHistory({});
      setEditBranches({});
      setRestoredToolInvocations({});
      fetch(`/api/conversations/${activeId}/messages`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            const filtered = data.filter(
              (m: { role: string }) =>
                m.role === "user" || m.role === "assistant"
            );
            const restoredAttachments: Record<string, MessageAttachments> = {};
            const restoredTools: Record<string, ToolInvocation[]> = {};
            for (const m of filtered) {
              if (m.model) messageModelMap.current.set(m.id, m.model);
              if (m.metadata?.attachments) {
                restoredAttachments[m.id] = m.metadata.attachments as MessageAttachments;
              }
              if (m.metadata?.toolInvocations) {
                restoredTools[m.id] = (m.metadata.toolInvocations as Array<{
                  toolCallId: string;
                  toolName: string;
                  args: Record<string, unknown>;
                  result?: unknown;
                }>).map((ti) => ({
                  toolCallId: ti.toolCallId,
                  toolName: ti.toolName,
                  state: "output-available" as const,
                  args: ti.args,
                  result: ti.result,
                }));
              }
            }
            if (Object.keys(restoredAttachments).length > 0) {
              setMessageAttachments(restoredAttachments);
            }
            if (Object.keys(restoredTools).length > 0) {
              setRestoredToolInvocations(restoredTools);
            }
            setMessages(
              filtered.map((m: { id: string; role: string; content: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content }],
              }))
            );
          } else {
            setMessages([]);
          }
        })
        .catch(console.error);
    } else if (!activeId) {
      setMessages([]);
      messageModelMap.current.clear();
      setMessageAttachments({});
      setRegenerationHistory({});
      setEditBranches({});
    }
  }, [activeId, setMessages]);

  const handleNewChat = useCallback(() => {
    stop();
    setConversationId(null);
    setActiveId(null);
    setMessages([]);
    setInput("");
    setFiles([]);
    setMessageAttachments({});
    setRegenerationHistory({});
    setEditBranches({});
    setEditingState(null);
    setArtifactPanel(null);
  }, [setActiveId, setMessages, stop]);

  const pendingAttachments = useRef<MessageAttachments>({ images: [], files: [] });

  const handleSendMessage = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isLoading) return;
      setChatError(null);

      const fileParts: Array<{ type: "file"; mediaType: string; url: string }> = [];
      const displayImages: string[] = [];
      const displayFiles: { name: string; type: string; url: string; size?: number }[] = [];
      const fileContentBlocks: string[] = [];

      if (files.length > 0) {
        for (const f of files) {
          if (f.isImage && f.dataUrl) {
            const dataUrlMediaType = f.dataUrl.match(/^data:([^;]+);/)?.[1] || "image/jpeg";
            fileParts.push({
              type: "file" as const,
              mediaType: dataUrlMediaType,
              url: f.dataUrl,
            });
            displayImages.push(f.url);
          } else if (f.isImage && f.url) {
            fileParts.push({
              type: "file" as const,
              mediaType: f.type || "image/png",
              url: `${window.location.origin}${f.url}`,
            });
            displayImages.push(f.url);
          } else {
            displayFiles.push({ name: f.name, type: f.type, url: f.url, size: f.size });
            if (f.textContent) {
              fileContentBlocks.push(`<file name="${f.name}">\n${f.textContent}\n</file>`);
            }
          }
        }
        setFiles([]);
      }

      pendingAttachments.current = { images: displayImages, files: displayFiles };

      let fullText = text;
      if (fileContentBlocks.length > 0) {
        fullText = `${fileContentBlocks.join("\n\n")}\n\n${text}`;
      }

      setInput("");
      sendMessage(
        { text: fullText, files: fileParts },
        {
          body: {
            conversationId: conversationIdRef.current,
            model: selectedModelRef.current,
            attachments: (displayImages.length > 0 || displayFiles.length > 0)
              ? { images: displayImages, files: displayFiles }
              : undefined,
          },
        }
      );
    },
    [input, isLoading, files, sendMessage]
  );

  useEffect(() => {
    const pending = pendingAttachments.current;
    if ((pending.images.length > 0 || pending.files.length > 0) && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const attachments = pendingAttachments.current;
        pendingAttachments.current = { images: [], files: [] };
        setMessageAttachments((prev) => {
          if (prev[lastUserMsg.id]) return prev;
          return { ...prev, [lastUserMsg.id]: attachments };
        });
      }
    }
  }, [messages]);

  const getMessageContent = useCallback(
    (msg: (typeof messages)[0]): string => {
      if (!msg.parts) return "";
      const raw = msg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
      return raw
        .replace(/<file name="[^"]*">[\s\S]*?<\/file>\s*/g, "")
        .replace(/<think>[\s\S]*?<\/think>\s*/g, "")
        .trim();
    },
    []
  );

  const getToolInvocations = useCallback(
    (msg: (typeof messages)[0]): ToolInvocation[] | undefined => {
      // First check live streaming tool parts
      if (msg.parts) {
        const invocations = msg.parts
          .filter((p) => p.type.startsWith("tool-"))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((p: any) => ({
            toolCallId: p.toolCallId as string,
            toolName: p.type.replace(/^tool-/, "") as string,
            state: p.state as string,
            args: p.input ?? {},
            result: p.output ?? undefined,
          } as ToolInvocation));
        if (invocations.length > 0) return invocations;
      }
      // Fall back to restored tool invocations from DB
      return restoredToolInvocations[msg.id] || undefined;
    },
    [restoredToolInvocations]
  );

  // --- Live artifact detection during streaming ---
  useEffect(() => {
    if (!isLoading) {
      // Streaming ended — finalize artifact if one was open
      if (artifactAutoOpened.current) {
        setArtifactPanel((prev) => prev?.streaming ? { ...prev, streaming: false } : prev);
      }
      artifactAutoOpened.current = false;
      lastArtifactLen.current = 0;
      return;
    }

    // Check the last assistant message for artifact content
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;

    const content = getMessageContent(lastMsg);
    if (!content || content.length < 50) return;

    // Detect <artifact> tags
    const { artifacts } = extractArtifacts(content);
    if (artifacts.length > 0) {
      const art = artifacts[artifacts.length - 1];
      const lang = art.type === "image/svg+xml" ? "svg" : "html";
      // Only update if code actually grew
      if (art.code.length !== lastArtifactLen.current) {
        lastArtifactLen.current = art.code.length;
        if (!artifactAutoOpened.current) {
          artifactAutoOpened.current = true;
          sidebarWasOpen.current = sidebarOpen;
          onCollapseSidebar();
        }
        setArtifactPanel({ code: art.code, language: lang, title: art.title, streaming: true });
      }
      return;
    }

    // Detect ```html code blocks with artifact-worthy content
    const htmlBlockMatch = content.match(/```html\n([\s\S]*?)(?:```|$)/);
    if (htmlBlockMatch) {
      const code = htmlBlockMatch[1];
      if (code.length > 100 && isArtifact("html", code)) {
        if (code.length !== lastArtifactLen.current) {
          lastArtifactLen.current = code.length;
          if (!artifactAutoOpened.current) {
            artifactAutoOpened.current = true;
            sidebarWasOpen.current = sidebarOpen;
            onCollapseSidebar();
          }
          setArtifactPanel({ code, language: "html", streaming: true });
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, messages]);

  const handleRegenerate = useCallback(() => {
    if (isLoading || messages.length < 2) return;

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;

    const userMsg = messages[messages.length - 2];
    if (userMsg?.role === "user") {
      const oldVersion: VersionEntry = {
        id: lastMsg.id,
        content: getMessageContent(lastMsg),
        model:
          messageModelMap.current.get(lastMsg.id) || selectedModelRef.current,
        toolInvocations: getToolInvocations(lastMsg),
      };
      setRegenerationHistory((prev) => {
        const key = userMsg.id;
        const existing = prev[key] || [];
        if (existing.some((v) => v.id === lastMsg.id)) return prev;
        return { ...prev, [key]: [...existing, oldVersion] };
      });
    }

    const withoutLast = messages.slice(0, -1);
    setMessages(withoutLast);

    sendMessage(undefined, {
      body: {
        conversationId: conversationIdRef.current,
        model: selectedModelRef.current,
        regenerate: true,
      },
    });
  }, [isLoading, messages, setMessages, sendMessage, getMessageContent, getToolInvocations]);

  // Enter edit mode: populate the input bar with the message content
  const handleStartEdit = useCallback(
    (messageIndex: number, currentContent: string) => {
      if (isLoading || messageIndex < 0 || messageIndex >= messages.length) return;
      const msg = messages[messageIndex];
      if (msg.role !== "user") return;

      // Save current input so we can restore on cancel
      savedInputRef.current = input;
      setEditingState({ messageIndex, originalContent: currentContent });
      setInput(currentContent);
    },
    [isLoading, messages, input]
  );

  // Actually perform the edit (called when user submits from editing mode)
  const handleSubmitEdit = useCallback(() => {
    if (!editingState) return;
    const { messageIndex } = editingState;
    const newContent = input.trim();
    if (!newContent || newContent === editingState.originalContent) {
      // No change — cancel
      setInput(savedInputRef.current);
      setEditingState(null);
      return;
    }

    const editedMsg = messages[messageIndex];
    if (!editedMsg || editedMsg.role !== "user") return;

    const oldUserContent = getMessageContent(editedMsg);
    const followingMessages = messages.slice(messageIndex + 1).map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: getMessageContent(m),
      model:
        messageModelMap.current.get(m.id) ||
        (m.role === "assistant" ? selectedModelRef.current : null),
      images: messageAttachments[m.id]?.images,
      files: messageAttachments[m.id]?.files,
      toolInvocations: getToolInvocations(m),
    }));

    const branch: EditBranch = {
      userContent: oldUserContent,
      followingMessages,
    };

    setEditBranches((prev) => {
      const key = editedMsg.id;
      const existing = prev[key] || [];
      return { ...prev, [key]: [...existing, branch] };
    });

    const truncated = messages.slice(0, messageIndex);
    setMessages(truncated);

    setEditingState(null);
    setInput("");

    sendMessage(
      { text: newContent },
      {
        body: {
          conversationId: conversationIdRef.current,
          model: selectedModelRef.current,
        },
      }
    );
  }, [editingState, input, messages, setMessages, sendMessage, getMessageContent, getToolInvocations, messageAttachments]);

  const handleCancelEdit = useCallback(() => {
    setInput(savedInputRef.current);
    setEditingState(null);
  }, []);

  // Edit last user message (triggered by up arrow in empty input)
  const handleEditLastMessage = useCallback(() => {
    if (isLoading || messages.length === 0) return;
    // Find last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        // We can't directly trigger the edit UI in the bubble from here,
        // but we can use the edit message handler approach
        // For now, just focus — the actual edit is handled by the message bubble
        break;
      }
    }
  }, [isLoading, messages]);

  const handleOpenArtifact = useCallback((code: string, language: string) => {
    sidebarWasOpen.current = sidebarOpen;
    setArtifactPanel({ code, language, streaming: false });
    onCollapseSidebar();
  }, [onCollapseSidebar, sidebarOpen]);

  const handleCloseArtifact = useCallback(() => {
    setArtifactPanel(null);
    if (sidebarWasOpen.current) {
      onOpenSidebar();
    }
  }, [onOpenSidebar]);

  const handleArtifactDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    artifactDragging.current = true;
    setIsDraggingArtifact(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMove = (ev: MouseEvent) => {
      if (!artifactDragging.current) return;
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const el = outerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pct = ((ev.clientX - rect.left) / rect.width) * 100;
        setArtifactWidth(Math.max(20, Math.min(80, 100 - pct)));
      });
    };
    const handleUp = () => {
      artifactDragging.current = false;
      setIsDraggingArtifact(false);
      cancelAnimationFrame(rafRef.current);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
  }, []);

  // Auto-focus input on mount and when returning to empty state
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        const ta = document.querySelector("textarea[placeholder]") as HTMLTextAreaElement;
        ta?.focus();
      }, 100);
    }
  }, [messages.length, activeId]);

  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length === 0) return;
      const uploaded = await uploadFiles(droppedFiles);
      if (uploaded.length > 0) {
        setFiles((prev) => [...prev, ...uploaded]);
      }
    },
    []
  );

  return (
    <div ref={outerRef} className="flex h-full flex-1 relative">
    <div
      style={artifactPanel ? { width: `${100 - artifactWidth}%` } : undefined}
      className={`relative flex h-full flex-col bg-background ${artifactPanel ? "" : "flex-1"}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity ${
          dragOver ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={handleDrop}
      >
        <div className="rounded-xl border-2 border-dashed border-border px-10 py-6 text-center pointer-events-none">
          <p className="text-sm font-medium text-muted-foreground">Drop files to attach</p>
          <p className="mt-0.5 text-xs text-muted-foreground/50">Images, documents, code, spreadsheets, and more</p>
        </div>
      </div>

      {/* Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <div className="flex items-center gap-1">
          {!sidebarOpen && (
            <>
              <Tooltip>
                <TooltipTrigger
                  onClick={onToggleSidebar}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PanelLeft className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">Open sidebar</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  onClick={handleNewChat}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent side="bottom">New chat</TooltipContent>
              </Tooltip>
            </>
          )}
          <ModelSelector value={selectedModel} onChange={selectModel} />
        </div>
      </header>

      {/* Messages or Empty State */}
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
          <div className="w-full max-w-lg text-center">
            <p className="text-2xl font-semibold text-foreground/90">
              {greeting}
            </p>
            <p className="mt-2 text-sm text-muted-foreground/60">
              How can I help you today?
            </p>
          </div>
        </div>
      ) : (
        <ChatMessages
          messages={messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant" | "system",
            content: getMessageContent(m),
            model:
              messageModelMap.current.get(m.id) ||
              (m.role === "assistant" ? selectedModelRef.current : null),
            images: messageAttachments[m.id]?.images,
            files: messageAttachments[m.id]?.files,
            toolInvocations: getToolInvocations(m),
          }))}
          isStreaming={isLoading}
          onRegenerate={handleRegenerate}
          onEditMessage={handleStartEdit}
          onOpenArtifact={handleOpenArtifact}
          regenerationHistory={regenerationHistory}
          editBranches={editBranches}
        />
      )}

      {/* Error banner */}
      {chatError && (
        <div className="shrink-0 px-4">
          <div className="mx-auto max-w-3xl flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="flex-1 text-sm text-red-700 dark:text-red-400">{chatError}</p>
            <button
              onClick={() => {
                setChatError(null);
                // Retry: resend the last user message
                if (messages.length > 0) {
                  const lastUser = [...messages].reverse().find((m) => m.role === "user");
                  if (lastUser) {
                    const lastAssistant = messages[messages.length - 1];
                    if (lastAssistant?.role !== "assistant" || getMessageContent(lastAssistant).length === 0) {
                      // Remove the failed empty assistant message if present
                      const cleaned = messages.filter((m) => m.role === "user" || getMessageContent(m).length > 0);
                      setMessages(cleaned);
                    }
                    sendMessage(undefined, {
                      body: {
                        conversationId: conversationIdRef.current,
                        model: selectedModelRef.current,
                        regenerate: true,
                      },
                    });
                  }
                }
              }}
              className="flex items-center gap-1 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
            <button
              onClick={() => setChatError(null)}
              className="shrink-0 rounded-md p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <span className="sr-only">Dismiss</span>
              <span className="text-xs">&#x2715;</span>
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={() => handleSendMessage()}
        onStop={stop}
        isLoading={isLoading}
        files={files}
        onFilesChange={setFiles}
        onEditLastMessage={handleEditLastMessage}
        editing={editingState}
        onCancelEdit={handleCancelEdit}
        onSubmitEdit={handleSubmitEdit}
      />
    </div>

    {/* Artifact Preview Panel */}
    {artifactPanel && (
      <>
        {/* Drag overlay — covers iframes so mouse events aren't swallowed */}
        {isDraggingArtifact && (
          <div className="fixed inset-0 z-50 cursor-col-resize" />
        )}
        {/* Drag handle */}
        <div
          onMouseDown={handleArtifactDragStart}
          className="w-1.5 h-full shrink-0 cursor-col-resize group/handle relative"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className={`h-full w-full transition-colors ${isDraggingArtifact ? "bg-primary/30" : "hover:bg-primary/20"}`} />
        </div>
        <div style={{ width: `${artifactWidth}%` }} className="h-full shrink-0">
          <ArtifactPreview
            code={artifactPanel.code}
            language={artifactPanel.language}
            title={artifactPanel.title}
            streaming={artifactPanel.streaming}
            onClose={handleCloseArtifact}
          />
        </div>
      </>
    )}
    </div>
  );
}
