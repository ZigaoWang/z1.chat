"use client";

import { useRef, useEffect, memo, useCallback, useState, useMemo } from "react";
import { ArrowDown } from "lucide-react";
import MessageBubble, { type ToolInvocation } from "./message-bubble";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string | null;
  images?: string[];
  files?: { name: string; type: string; url: string; size?: number }[];
  toolInvocations?: ToolInvocation[];
  segments?: MessageSegment[];
}

export type MessageSegment =
  | { type: "text"; content: string }
  | { type: "tool"; invocation: ToolInvocation };

export interface VersionEntry {
  id: string;
  content: string;
  model?: string | null;
  toolInvocations?: ToolInvocation[];
}

export interface EditBranch {
  userContent: string;
  followingMessages: Message[];
}

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
  wasInterrupted?: boolean;
  onRegenerate?: () => void;
  onEditMessage?: (messageIndex: number, newContent: string) => void;
  onOpenArtifact?: (code: string, language: string) => void;
  onOpenArtifactById?: (id: string) => void;
  regenerationHistory?: Record<string, VersionEntry[]>;
  editBranches?: Record<string, EditBranch[]>;
  onViewingOldBranch?: (viewing: boolean) => void;
}

interface MessageSlot {
  type: "single" | "assistant-versions" | "user-edit-group";
  messages: Message[];
  branches?: EditBranch[];
  originalIndex?: number;
}

function processMessages(
  messages: Message[],
  regenerationHistory?: Record<string, VersionEntry[]>,
  editBranches?: Record<string, EditBranch[]>
): MessageSlot[] {
  const slots: MessageSlot[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const prevSlot = slots[slots.length - 1];
      if (prevSlot && prevSlot.messages[0].role === "assistant") {
        prevSlot.type = "assistant-versions";
        prevSlot.messages.push(msg);
      } else {
        slots.push({ type: "single", messages: [msg], originalIndex: i });
      }
    } else {
      const branches = editBranches?.[msg.id];
      if (branches && branches.length > 0) {
        slots.push({ type: "user-edit-group", messages: [msg], branches, originalIndex: i });
      } else {
        slots.push({ type: "single", messages: [msg], originalIndex: i });
      }
    }
  }

  if (regenerationHistory) {
    for (let i = slots.length - 1; i >= 0; i--) {
      const slot = slots[i];
      if (slot.messages[0].role !== "assistant") continue;
      const prevSlot = slots[i - 1];
      if (!prevSlot || prevSlot.messages[0].role !== "user") continue;
      const userMsgId = prevSlot.messages[0].id;
      const history = regenerationHistory[userMsgId];
      if (!history || history.length === 0) continue;
      const historyAsMsgs: Message[] = history
        .filter((v) => !slot.messages.some((m) => m.id === v.id))
        .map((v) => ({ id: v.id, role: "assistant" as const, content: v.content, model: v.model, toolInvocations: v.toolInvocations }));
      if (historyAsMsgs.length > 0) {
        slot.messages = [...historyAsMsgs, ...slot.messages];
        slot.type = "assistant-versions";
      }
    }
  }

  return slots;
}

// Thinking indicator
function ThinkingIndicator() {
  return (
    <div className="px-4 py-1">
      <div className="mx-auto max-w-3xl flex items-center gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-[bounce_1.4s_ease-in-out_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-1.5 w-1.5 rounded-full bg-foreground/15 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
    </div>
  );
}

function ChatMessages({
  messages, isStreaming, wasInterrupted, onRegenerate, onEditMessage, onOpenArtifact, onOpenArtifactById, regenerationHistory, editBranches, onViewingOldBranch,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});
  const [selectedBranches, setSelectedBranches] = useState<Record<string, number>>({});

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    stickToBottom.current = true;
    setShowScrollBtn(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const d = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = d < 80;
    setShowScrollBtn(d > 200);
  }, []);

  const prevCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevCount.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "user") stickToBottom.current = true;
    }
    prevCount.current = messages.length;
  }, [messages.length, messages]);

  // Auto-scroll: only when user hasn't scrolled away
  const lastContentLen = useRef(0);
  useEffect(() => {
    if (!stickToBottom.current) return;
    const el = containerRef.current;
    if (!el) return;
    // Only scroll if content actually changed
    if (el.scrollHeight !== lastContentLen.current) {
      lastContentLen.current = el.scrollHeight;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) return null;

  const slots = useMemo(
    () => processMessages(messages, regenerationHistory, editBranches),
    [messages, regenerationHistory, editBranches]
  );
  let lastAssistantSlotIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].messages[0].role === "assistant") { lastAssistantSlotIdx = i; break; }
  }
  let lastUserSlotIdx = -1;
  for (let i = lastAssistantSlotIdx - 1; i >= 0; i--) {
    if (slots[i].messages[0].role === "user") { lastUserSlotIdx = i; break; }
  }

  // Show typing indicator when streaming but last message is user (no assistant response yet)
  const lastMsg = messages[messages.length - 1];
  const showTypingIndicator = isStreaming && lastMsg?.role === "user";

  // Determine if any edit group is viewing an old branch — if so, hide all slots after it
  let cutoffSlotIdx = slots.length; // by default, show all slots
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.type === "user-edit-group") {
      const branches = slot.branches!;
      const totalVersions = branches.length + 1;
      const selectedIdx = selectedBranches[slot.messages[0].id] ?? totalVersions - 1;
      if (selectedIdx !== totalVersions - 1) {
        // Viewing an old branch — cut off everything after this slot
        cutoffSlotIdx = i + 1;
        break;
      }
    }
  }

  const visibleSlots = slots.slice(0, cutoffSlotIdx);
  const isViewingOldBranch = cutoffSlotIdx < slots.length;

  // Notify parent about old branch viewing state
  const prevViewingOldBranch = useRef(false);
  useEffect(() => {
    if (prevViewingOldBranch.current !== isViewingOldBranch) {
      prevViewingOldBranch.current = isViewingOldBranch;
      onViewingOldBranch?.(isViewingOldBranch);
    }
  }, [isViewingOldBranch, onViewingOldBranch]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl pt-6 pb-4">
        {visibleSlots.map((slot, slotIdx) => {
          if (slot.type === "user-edit-group") {
            const msg = slot.messages[0];
            const branches = slot.branches!;
            const totalVersions = branches.length + 1;
            const rawIdx = selectedBranches[msg.id] ?? totalVersions - 1;
            // Clamp to valid range in case branches changed
            const selectedIdx = Math.max(0, Math.min(rawIdx, totalVersions - 1));
            const isOnCurrentBranch = selectedIdx === totalVersions - 1;

            if (isOnCurrentBranch) {
              return (
                <div key={`edit-${msg.id}`}>
                  <MessageBubble role={msg.role} content={msg.content} images={msg.images} files={msg.files}
                    onEdit={onEditMessage && slot.originalIndex !== undefined ? (c) => onEditMessage(slot.originalIndex!, c) : undefined}
                    onRegenerate={slotIdx === lastUserSlotIdx && !isStreaming ? onRegenerate : undefined}
                    versionCount={totalVersions} currentVersion={selectedIdx}
                    onVersionChange={(idx) => setSelectedBranches((p) => ({ ...p, [msg.id]: idx }))} />
                </div>
              );
            } else {
              const branch = branches[selectedIdx];
              return (
                <div key={`edit-${msg.id}-branch-${selectedIdx}`}>
                  <MessageBubble role="user" content={branch.userContent}
                    versionCount={totalVersions} currentVersion={selectedIdx}
                    onVersionChange={(idx) => setSelectedBranches((p) => ({ ...p, [msg.id]: idx }))} />
                  {branch.followingMessages.map((fm) => (
                    <MessageBubble key={fm.id} role={fm.role} content={fm.content} model={fm.model}
                      images={fm.images} files={fm.files} toolInvocations={fm.toolInvocations} onOpenArtifact={onOpenArtifact} onOpenArtifactById={onOpenArtifactById} />
                  ))}
                </div>
              );
            }
          }

          if (slot.type === "assistant-versions" && slot.messages.length > 1) {
            const groupKey = slot.messages[0].id;
            const vc = slot.messages.length;
            const sel = Math.max(0, Math.min(selectedVersions[groupKey] ?? vc - 1, vc - 1));
            const cur = slot.messages[sel];
            const isLA = slotIdx === lastAssistantSlotIdx;
            return (
              <MessageBubble key={`${groupKey}-v${sel}`} role={cur.role} content={cur.content} model={cur.model}
                images={cur.images} files={cur.files} toolInvocations={cur.toolInvocations}
                isStreaming={isStreaming && slotIdx === slots.length - 1 && sel === vc - 1}
                isLast={isLA} onRegenerate={isLA ? onRegenerate : undefined}
                interrupted={isLA && !isStreaming && !!wasInterrupted}
                onOpenArtifact={onOpenArtifact}
                onOpenArtifactById={onOpenArtifactById}
                versionCount={vc} currentVersion={sel}
                onVersionChange={(idx) => setSelectedVersions((p) => ({ ...p, [groupKey]: idx }))} />
            );
          }

          const msg = slot.messages[0];
          const isLA = slotIdx === lastAssistantSlotIdx && msg.role === "assistant";
          const isLastUser = slotIdx === lastUserSlotIdx && msg.role === "user";
          return (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} model={msg.model}
              images={msg.images} files={msg.files} toolInvocations={msg.toolInvocations}
              segments={msg.segments}
              isStreaming={isStreaming && slotIdx === slots.length - 1 && msg.role === "assistant"}
              isLast={isLA} onRegenerate={isLA ? onRegenerate : (isLastUser && !isStreaming ? onRegenerate : undefined)}
              interrupted={isLA && !isStreaming && !!wasInterrupted}
              onOpenArtifact={onOpenArtifact}
              onOpenArtifactById={onOpenArtifactById}
              onEdit={msg.role === "user" && onEditMessage && slot.originalIndex !== undefined
                ? (c) => onEditMessage(slot.originalIndex!, c) : undefined} />
          );
        })}

        {/* Typing indicator — visible when waiting for first token */}
        {showTypingIndicator && <ThinkingIndicator />}
      </div>
      </div>

      {showScrollBtn && (
        <button onClick={scrollToBottom}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-background shadow-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default memo(ChatMessages);
