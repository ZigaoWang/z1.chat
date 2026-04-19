"use client";

import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PanelLeft, Plus, AlertCircle, RotateCcw, X, Eye } from "lucide-react";
import ChatMessages, { type VersionEntry, type EditBranch } from "@/components/chat/chat-messages";
import ChatInput, { type EditingState } from "@/components/chat/chat-input";
import ModelSelector from "@/components/chat/model-selector";
import { useConversations } from "@/hooks/use-conversations";
import { useModels } from "@/hooks/use-models";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { type UploadedFile, uploadFiles } from "./file-upload";
import { type ToolInvocation } from "./message-bubble";
import ArtifactPreview, { extractArtifacts, isArtifact, type ArtifactData } from "./artifact-preview";

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

export default function ChatView({ sidebarOpen, onToggleSidebar, onCollapseSidebar, onOpenSidebar }: ChatViewProps) {
  const { activeId, setActiveId, refreshConversations } = useConversations();
  const { selectedModel, selectModel, currentModel } = useModels();
  const [greeting, setGreeting] = useState("What's on your mind?");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [viewingOldBranch, setViewingOldBranch] = useState(false);
  const [artifactPanel, setArtifactPanel] = useState<ArtifactData | null>(null);
  const [artifactStreaming, setArtifactStreaming] = useState(false);
  const [artifactWidth, setArtifactWidth] = useState(50);
  const [isDraggingArtifact, setIsDraggingArtifact] = useState(false);
  const savedInputRef = useRef("");
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

  const [chatError, setChatError] = useState<ReactNode | null>(null);

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
      let msg = raw;
      try {
        const parsed = JSON.parse(raw);
        msg = parsed.message || parsed.error || raw;
      } catch {
        // Not JSON, use as-is
      }
      if (msg.includes("No endpoints found that support image input") || msg.includes("does not represent a valid image")) {
        msg = "This model doesn't support images. Try a model with the Vision badge.";
      } else if (msg.includes("context length") || msg.includes("too long") || msg.includes("maximum")) {
        msg = "This message is too long for the current model. Try a shorter message or switch to a model with more context.";
      } else if (msg.includes("rate") && (msg.includes("limit") || msg.includes("increased"))) {
        msg = "This model is currently rate-limited. Try a different model or wait a moment.";
      } else if (msg.includes("temporarily") && msg.includes("unavailable")) {
        msg = "This model is temporarily unavailable. Try a different model.";
      } else if (msg.includes("credits") || msg.includes("balance")) {
        msg = "You've run out of credits. Contact an admin to add more.";
      } else if (msg.length > 200) {
        msg = "Something went wrong. Please try again.";
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

  // Reset state when switching conversations
  const stopRef = useRef(stop);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  useEffect(() => {
    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      setConversationId(activeId);
      initialLoadDone.current = true;
      return;
    }
    stopRef.current();
    setConversationId(activeId);
    initialLoadDone.current = false;
    setEditingState(null);
    setViewingOldBranch(false);
    setArtifactPanel(null);
    setArtifactStreaming(false);
    sidebarWasOpen.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const messageModelMap = useRef<Map<string, string>>(new Map());
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const [messageAttachments, setMessageAttachments] = useState<Record<string, MessageAttachments>>({});
  const [regenerationHistory, setRegenerationHistory] = useState<Record<string, VersionEntry[]>>({});
  const [editBranches, setEditBranches] = useState<Record<string, EditBranch[]>>({});
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
              (m: { role: string }) => m.role === "user" || m.role === "assistant"
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

            const hasBranchData = filtered.some((m: { parentId?: string | null }) => m.parentId != null);
            const rootMessages = filtered.filter((m: { parentId?: string | null }) => m.parentId == null);
            const hasRootSiblings = rootMessages.filter((m: { role: string }) => m.role === "user").length > 1
              || rootMessages.filter((m: { role: string }) => m.role === "assistant").length > 1;

            if (hasBranchData || hasRootSiblings) {
              const childrenMap = new Map<string | null, typeof filtered>();
              for (const m of filtered) {
                const pid = m.parentId ?? null;
                if (!childrenMap.has(pid)) childrenMap.set(pid, []);
                childrenMap.get(pid)!.push(m);
              }
              for (const children of childrenMap.values()) {
                children.sort((a: { branchIndex: number }, b: { branchIndex: number }) => a.branchIndex - b.branchIndex);
              }

              const activePath: typeof filtered = [];
              let currentParentId: string | null = null;
              while (true) {
                const children = childrenMap.get(currentParentId);
                if (!children || children.length === 0) break;
                const active = children[children.length - 1];
                activePath.push(active);
                currentParentId = active.id;
              }

              if (activePath.length === 0) {
                setMessageAttachments(restoredAttachments);
                setRestoredToolInvocations(restoredTools);
                setMessages(
                  filtered.map((m: { id: string; role: string; content: string }) => ({
                    id: m.id,
                    role: m.role as "user" | "assistant",
                    parts: [{ type: "text" as const, text: m.content }],
                  }))
                );
                return;
              }

              const newRegenHistory: Record<string, VersionEntry[]> = {};
              const newEditBranches: Record<string, EditBranch[]> = {};

              for (const msg of activePath) {
                const pid = msg.parentId ?? null;
                const siblings = childrenMap.get(pid) || [];
                if (siblings.length <= 1) continue;

                if (msg.role === "assistant") {
                  const userMsgId = pid;
                  if (userMsgId) {
                    const oldVersions: VersionEntry[] = siblings
                      .filter((s: { id: string }) => s.id !== msg.id)
                      .map((s: { id: string; content: string; model?: string | null; metadata?: Record<string, unknown> }) => ({
                        id: s.id,
                        content: s.content,
                        model: s.model,
                        toolInvocations: restoredTools[s.id],
                      }));
                    if (oldVersions.length > 0) {
                      newRegenHistory[userMsgId] = oldVersions;
                    }
                  }
                } else if (msg.role === "user") {
                  const olderSiblings = siblings.filter((s: { id: string }) => s.id !== msg.id);
                  if (olderSiblings.length > 0) {
                    const branches: EditBranch[] = olderSiblings.map((s: any) => {
                      const following: typeof filtered = [];
                      let walkId: string | null = s.id;
                      while (walkId) {
                        const kids = childrenMap.get(walkId);
                        if (!kids || kids.length === 0) break;
                        const best = kids[kids.length - 1];
                        following.push(best);
                        walkId = best.id;
                      }
                      return {
                        userContent: s.content,
                        followingMessages: following.map((fm: { id: string; role: string; content: string; model?: string | null }) => ({
                          id: fm.id,
                          role: fm.role as "user" | "assistant" | "system",
                          content: fm.content,
                          model: fm.model || messageModelMap.current.get(fm.id) || null,
                          images: restoredAttachments[fm.id]?.images,
                          files: restoredAttachments[fm.id]?.files,
                          toolInvocations: restoredTools[fm.id],
                        })),
                      };
                    });
                    newEditBranches[msg.id] = branches;
                  }
                }
              }

              if (Object.keys(restoredAttachments).length > 0) setMessageAttachments(restoredAttachments);
              if (Object.keys(restoredTools).length > 0) setRestoredToolInvocations(restoredTools);
              if (Object.keys(newRegenHistory).length > 0) setRegenerationHistory(newRegenHistory);
              if (Object.keys(newEditBranches).length > 0) setEditBranches(newEditBranches);

              setMessages(
                activePath.map((m: { id: string; role: string; content: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  parts: [{ type: "text" as const, text: m.content }],
                }))
              );
            } else {
              if (Object.keys(restoredAttachments).length > 0) setMessageAttachments(restoredAttachments);
              if (Object.keys(restoredTools).length > 0) setRestoredToolInvocations(restoredTools);
              setMessages(
                filtered.map((m: { id: string; role: string; content: string }) => ({
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  parts: [{ type: "text" as const, text: m.content }],
                }))
              );
            }
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
  }, [activeId, setMessages, refreshConversations]);

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
    setArtifactStreaming(false);
    sidebarWasOpen.current = false;
    artifactOpenedRef.current = false;
    streamedArtifactContent.current = {};
    handledToolCallsRef.current.clear();
  }, [setActiveId, setMessages, stop]);

  const pendingAttachments = useRef<MessageAttachments>({ images: [], files: [] });

  const handleSendMessage = useCallback(
    (overrideText?: string) => {
      const text = (overrideText ?? input).trim();
      if (!text || isLoading || viewingOldBranch) return;
      setChatError(null);

      const fileParts: Array<{ type: "file"; mediaType: string; url: string }> = [];
      const displayImages: string[] = [];
      const displayFiles: { name: string; type: string; url: string; size?: number }[] = [];
      const fileContentBlocks: string[] = [];

      const hasImages = files.some(f => f.isImage && f.dataUrl);
      const modelSupportsVision = currentModel?.supportsVision !== false;

      if (hasImages && !modelSupportsVision) return;

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
          } else {
            displayFiles.push({ name: f.name, type: f.type, url: f.url, size: f.size });
            if (f.textContent) {
              fileContentBlocks.push(`<attached_file name="${f.name}" url="${f.url}" sandbox_path="/home/user/${f.name}">\n${f.textContent}\n</attached_file>`);
            } else {
              fileContentBlocks.push(`<attached_file name="${f.name}" url="${f.url}" sandbox_path="/home/user/${f.name}" />`);
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
            parentId: messagesRef.current.length > 0 ? messagesRef.current[messagesRef.current.length - 1].id : null,
            attachments: (displayImages.length > 0 || displayFiles.length > 0)
              ? { images: displayImages, files: displayFiles }
              : undefined,
          },
        }
      );
    },
    [input, isLoading, viewingOldBranch, files, sendMessage, currentModel]
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

  const messageContentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messages) {
      map.set(m.id, getMessageContent(m));
    }
    return map;
  }, [messages, getMessageContent]);

  const getCachedContent = useCallback(
    (msg: (typeof messages)[0]): string => messageContentMap.get(msg.id) ?? getMessageContent(msg),
    [messageContentMap, getMessageContent]
  );

  const getToolInvocations = useCallback(
    (msg: (typeof messages)[0]): ToolInvocation[] | undefined => {
      if (msg.parts) {
        const invocations = msg.parts
          .filter((p): p is any => p.type.startsWith("tool-") || p.type === "dynamic-tool")
          .map((p: any) => ({
            toolCallId: p.toolCallId as string,
            toolName: (p.type === "dynamic-tool" ? p.toolName : p.type.replace(/^tool-/, "")) as string,
            state: p.state as string,
            args: p.input ?? {},
            result: p.output ?? undefined,
          }));
        if (invocations.length > 0) return invocations;
      }
      return restoredToolInvocations[msg.id] || undefined;
    },
    [restoredToolInvocations]
  );

  // Track artifact streaming state via refs (avoid stale closures / infinite loops)
  const handledToolCallsRef = useRef<Set<string>>(new Set());
  const streamedArtifactContent = useRef<Record<string, string>>({});
  const artifactOpenedRef = useRef(false);
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Separate effect for tool invocation -> DB sync after tool completes
  useEffect(() => {
    if (!isLoading) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;

    const toolInvs = getToolInvocations(lastMsg);
    if (!toolInvs) return;

    for (const t of toolInvs) {
      if (t.state !== "output-available" || !t.result || handledToolCallsRef.current.has(t.toolCallId)) continue;
      const result = t.result as { id?: string; error?: string };
      if (result.error || !result.id) continue;

      handledToolCallsRef.current.add(t.toolCallId);

      fetch(`/api/artifacts/${result.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((artifact) => {
          if (artifact) {
            setArtifactPanel(artifact);
            setArtifactStreaming(false);
          }
        })
        .catch(console.error);
    }
  }, [isLoading, messages, getToolInvocations]);

  // Streaming artifact content — uses an interval to poll messagesRef
  // instead of depending on `messages` state (which would cause infinite loops).
  useEffect(() => {
    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    if (!isLoading) {
      setArtifactStreaming(false);
      streamedArtifactContent.current = {};
      return;
    }

    const pollArtifactContent = () => {
      const msgs = messagesRef.current;
      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg || lastMsg.role !== "assistant") return;

      // Check tool invocations for create_artifact / update_artifact
      let toolInvs: ToolInvocation[] | undefined;
      if (lastMsg.parts) {
        const invocations = lastMsg.parts
          .filter((p: any) => p.type?.startsWith("tool-") || p.type === "dynamic-tool")
          .map((p: any) => ({
            toolCallId: p.toolCallId as string,
            toolName: (p.type === "dynamic-tool" ? p.toolName : p.type.replace(/^tool-/, "")) as string,
            state: p.state as string,
            args: p.input ?? {},
            result: p.output ?? undefined,
          }));
        if (invocations.length > 0) toolInvs = invocations;
      }

      if (toolInvs && toolInvs.length > 0) {
        for (const t of toolInvs) {
          const isCreate = t.toolName === "create_artifact";
          const isUpdate = t.toolName === "update_artifact";
          if (!isCreate && !isUpdate) continue;
          if (t.state !== "input-streaming" && t.state !== "input-available") continue;

          const args = t.args as { title?: string; type?: string; content?: string };
          const newContent = args.content || "";
          const prevLen = streamedArtifactContent.current[t.toolCallId]?.length || 0;

          if (newContent.length <= prevLen) continue;
          streamedArtifactContent.current[t.toolCallId] = newContent;

          if (!artifactOpenedRef.current) {
            artifactOpenedRef.current = true;
            sidebarWasOpen.current = true;
            onCollapseSidebar();
          }

          setArtifactPanel({
            type: args.type || "document",
            title: args.title || "Creating...",
            content: newContent,
          });
          setArtifactStreaming(true);
          return;
        }
        return;
      }

      // Fallback: detect <artifact> tags
      const content = getMessageContent(lastMsg);
      if (!content || content.length < 50) return;

      const { artifacts } = extractArtifacts(content);
      if (artifacts.length > 0) {
        const art = artifacts[artifacts.length - 1];
        const artType = art.type === "image/svg+xml" ? "svg" : "html";
        const prevLen = streamedArtifactContent.current["__tag__"]?.length || 0;
        if (art.code.length > prevLen) {
          streamedArtifactContent.current["__tag__"] = art.code;
          if (!artifactOpenedRef.current) {
            artifactOpenedRef.current = true;
            sidebarWasOpen.current = true;
            onCollapseSidebar();
          }
          setArtifactPanel({ type: artType, title: art.title, content: art.code });
          setArtifactStreaming(true);
        }
        return;
      }

      // Detect ```html code blocks
      const htmlBlockMatch = content.match(/```html\n([\s\S]*?)(?:```|$)/);
      if (htmlBlockMatch) {
        const code = htmlBlockMatch[1];
        if (code.length > 100 && isArtifact("html", code)) {
          const prevLen = streamedArtifactContent.current["__html__"]?.length || 0;
          if (code.length > prevLen) {
            streamedArtifactContent.current["__html__"] = code;
            if (!artifactOpenedRef.current) {
              artifactOpenedRef.current = true;
              sidebarWasOpen.current = true;
              onCollapseSidebar();
            }
            setArtifactPanel({ type: "html", title: "Website", content: code });
            setArtifactStreaming(true);
          }
        }
      }
    };

    // Poll every 150ms during streaming — fast enough for smooth UX, no infinite loops
    streamingTimerRef.current = setInterval(pollArtifactContent, 150);
    // Run immediately too
    pollArtifactContent();

    return () => {
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }
    };
  }, [isLoading, getMessageContent, onCollapseSidebar]);

  const handleRegenerate = useCallback(() => {
    if (isLoading || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return;
    const userMsg = messages[messages.length - 2];
    if (userMsg?.role === "user") {
      const oldVersion: VersionEntry = {
        id: lastMsg.id,
        content: getMessageContent(lastMsg),
        model: messageModelMap.current.get(lastMsg.id) || selectedModelRef.current,
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
        parentId: userMsg.id,
        regenerate: true,
      },
    });
  }, [isLoading, messages, setMessages, sendMessage, getMessageContent, getToolInvocations]);

  const handleStartEdit = useCallback(
    (messageIndex: number, currentContent: string) => {
      if (isLoading || messageIndex < 0 || messageIndex >= messages.length) return;
      const msg = messages[messageIndex];
      if (msg.role !== "user") return;
      savedInputRef.current = input;
      setEditingState({ messageIndex, originalContent: currentContent });
      setInput(currentContent);
    },
    [isLoading, messages, input]
  );

  const pendingRegenTransfer = useRef<{ oldUserMsgId: string; messageIndex: number } | null>(null);

  useEffect(() => {
    const transfer = pendingRegenTransfer.current;
    if (!transfer) return;
    const { oldUserMsgId, messageIndex } = transfer;
    const newMsg = messages[messageIndex];
    if (newMsg && newMsg.role === "user" && newMsg.id !== oldUserMsgId) {
      pendingRegenTransfer.current = null;
      setRegenerationHistory((prev) => {
        const history = prev[oldUserMsgId];
        if (!history) return prev;
        const { [oldUserMsgId]: _, ...rest } = prev;
        return { ...rest, [newMsg.id]: history };
      });
    }
  }, [messages]);

  const pendingEditTransfer = useRef<{ oldId: string; messageIndex: number } | null>(null);

  useEffect(() => {
    const transfer = pendingEditTransfer.current;
    if (!transfer) return;
    const { oldId, messageIndex } = transfer;
    let newMsg = messages[messageIndex];
    if (!newMsg || newMsg.role !== "user") {
      for (let i = Math.max(0, messageIndex - 1); i < Math.min(messages.length, messageIndex + 2); i++) {
        if (messages[i]?.role === "user" && messages[i].id !== oldId) {
          newMsg = messages[i];
          break;
        }
      }
    }
    if (!newMsg || newMsg.role !== "user" || newMsg.id === oldId) return;
    pendingEditTransfer.current = null;
    setEditBranches((prev) => {
      const branches = prev[oldId];
      if (!branches) return prev;
      const { [oldId]: _, ...rest } = prev;
      return { ...rest, [newMsg.id]: branches };
    });
  }, [messages]);

  const handleSubmitEdit = useCallback(() => {
    if (!editingState) return;
    const { messageIndex } = editingState;
    const newContent = input.trim();
    if (!newContent || newContent === editingState.originalContent) {
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
      model: messageModelMap.current.get(m.id) || (m.role === "assistant" ? selectedModelRef.current : null),
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
    pendingEditTransfer.current = { oldId: editedMsg.id, messageIndex };
    const truncated = messages.slice(0, messageIndex);
    setMessages(truncated);
    setEditingState(null);
    setInput("");
    const editParentId = messageIndex > 0 ? messages[messageIndex - 1].id : null;
    sendMessage(
      { text: newContent },
      {
        body: {
          conversationId: conversationIdRef.current,
          model: selectedModelRef.current,
          parentId: editParentId,
          editedMessageId: editedMsg.id,
        },
      }
    );
  }, [editingState, input, messages, setMessages, sendMessage, getMessageContent, getToolInvocations, messageAttachments]);

  const handleCancelEdit = useCallback(() => {
    setInput(savedInputRef.current);
    setEditingState(null);
  }, []);

  const handleOpenArtifact = useCallback((code: string, language: string) => {
    sidebarWasOpen.current = sidebarOpen;
    setArtifactPanel({ type: language === "svg" ? "svg" : "html", title: "Preview", content: code });
    setArtifactStreaming(false);
    onCollapseSidebar();
  }, [onCollapseSidebar, sidebarOpen]);

  const handleOpenArtifactById = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/artifacts/${id}`);
      if (!res.ok) return;
      const artifact = await res.json();
      sidebarWasOpen.current = sidebarOpen;
      setArtifactPanel(artifact);
      setArtifactStreaming(false);
      artifactOpenedRef.current = true;
      onCollapseSidebar();
    } catch (err) {
      console.error("Failed to open artifact:", err);
    }
  }, [onCollapseSidebar, sidebarOpen]);

  const handleArtifactContentChange = useCallback(async (content: string) => {
    if (!artifactPanel?.id) return;
    try {
      const res = await fetch(`/api/artifacts/${artifactPanel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const updated = await res.json();
        setArtifactPanel(updated);
      }
    } catch (err) {
      console.error("Failed to save artifact:", err);
    }
  }, [artifactPanel?.id]);

  const handleLoadVersion = useCallback(async (targetVersion: number) => {
    if (!artifactPanel?.id) return;
    if (targetVersion === artifactPanel.version) return;
    try {
      const res = await fetch(`/api/artifacts/${artifactPanel.id}/versions`);
      if (!res.ok) return;
      const versions = await res.json();
      const target = versions.find((v: { version: number }) => v.version === targetVersion);
      if (!target) return;
      const patchRes = await fetch(`/api/artifacts/${artifactPanel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: target.content, restoreVersion: targetVersion }),
      });
      if (patchRes.ok) {
        const updated = await patchRes.json();
        setArtifactPanel(updated);
      }
    } catch (err) {
      console.error("Failed to load version:", err);
    }
  }, [artifactPanel?.id, artifactPanel?.version]);

  const handleCloseArtifact = useCallback(() => {
    setArtifactPanel(null);
    setArtifactStreaming(false);
    artifactOpenedRef.current = false;
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

  // Reset streaming refs when conversation changes
  useEffect(() => {
    artifactOpenedRef.current = false;
    streamedArtifactContent.current = {};
    handledToolCallsRef.current.clear();
  }, [activeId]);

  return (
    <div ref={outerRef} className="flex h-full flex-1 relative">
    <div
      style={artifactPanel ? { width: `${100 - artifactWidth}%`, transition: isDraggingArtifact ? 'none' : 'width 0.2s ease-out' } : undefined}
      className={`relative flex h-full flex-col bg-background ${artifactPanel ? "max-lg:flex-1" : "flex-1"}`}
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
            content: getCachedContent(m),
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
          onOpenArtifactById={handleOpenArtifactById}
          regenerationHistory={regenerationHistory}
          editBranches={editBranches}
          onViewingOldBranch={setViewingOldBranch}
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
                if (messages.length > 0) {
                  const lastUser = [...messages].reverse().find((m) => m.role === "user");
                  if (lastUser) {
                    const lastAssistant = messages[messages.length - 1];
                    if (lastAssistant?.role !== "assistant" || getMessageContent(lastAssistant).length === 0) {
                      const cleaned = messages.filter((m) => m.role === "user" || getMessageContent(m).length > 0);
                      setMessages(cleaned);
                    }
                    sendMessage(undefined, {
                      body: {
                        conversationId: conversationIdRef.current,
                        model: selectedModelRef.current,
                        parentId: lastUser.id,
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

      {/* Vision warning */}
      {files.some(f => f.isImage && f.dataUrl) && currentModel && !currentModel.supportsVision && (
        <div className="shrink-0 px-4">
          <div className="mx-auto max-w-3xl flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="flex-1 text-sm text-amber-700 dark:text-amber-400">
              {currentModel.name || selectedModel.split("/").pop()} doesn&apos;t support images. Switch to a model with the{" "}
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 gap-0.5 font-medium bg-blue-500/10 text-blue-500 border-0 inline-flex align-text-bottom">
                <Eye className="h-2.5 w-2.5" />
                Vision
              </Badge>
              {" "}badge, or remove the image.
            </p>
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
        disabled={viewingOldBranch}
        placeholder={viewingOldBranch ? "Switch to the latest version to continue chatting" : undefined}
        files={files}
        onFilesChange={setFiles}
        onEditLastMessage={() => {}}
        editing={editingState}
        onCancelEdit={handleCancelEdit}
        onSubmitEdit={handleSubmitEdit}
      />
    </div>

    {/* Artifact Preview Panel */}
    {artifactPanel && (
      <>
        {/* Mobile: full-screen overlay — ArtifactPreview has its own header */}
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <ArtifactPreview
            artifact={artifactPanel}
            streaming={artifactStreaming}
            onClose={handleCloseArtifact}
            onContentChange={artifactPanel.id ? handleArtifactContentChange : undefined}
            onLoadVersion={artifactPanel.id ? handleLoadVersion : undefined}
          />
        </div>

        {/* Desktop: side-by-side split */}
        <div className="hidden lg:contents">
          {isDraggingArtifact && (
            <div className="fixed inset-0 z-50 cursor-col-resize" />
          )}
          <div
            onMouseDown={handleArtifactDragStart}
            className="w-1.5 h-full shrink-0 cursor-col-resize group/handle relative"
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
            <div className={`h-full w-full transition-colors ${isDraggingArtifact ? "bg-primary/30" : "hover:bg-primary/20"}`} />
          </div>
          <div style={{ width: `${artifactWidth}%` }} className="h-full shrink-0">
            <ArtifactPreview
              artifact={artifactPanel}
              streaming={artifactStreaming}
              onClose={handleCloseArtifact}
              onContentChange={artifactPanel.id ? handleArtifactContentChange : undefined}
              onLoadVersion={artifactPanel.id ? handleLoadVersion : undefined}
              totalVersions={artifactPanel.version}
            />
          </div>
        </div>
      </>
    )}
    </div>
  );
}
