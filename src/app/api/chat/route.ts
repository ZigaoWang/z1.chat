import { UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { db } from "@/lib/db";
import { conversations, messages, users } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { DEFAULT_MODEL } from "@/lib/constants";
import { getOpenRouter } from "@/lib/openrouter";
import { buildSystemPrompt } from "@/lib/system-prompt";
import { generateConversationTitle } from "@/lib/title-generator";
import { extractMemories, updateConversationSummary, extractImmediateMemory } from "@/lib/memory";
import { checkAndCompactConversation } from "@/lib/context-manager";
import { getTools, SANDBOX_TOOL_NAMES, IMAGE_TOOL_NAMES, SandboxManager, ArtifactContext } from "@/lib/tools";
import { trackedStreamText, logSearchUsage, logSandboxUsage } from "@/lib/usage-logger";
import { getCachedModels } from "@/lib/models-cache";
import { Sandbox } from "@e2b/code-interpreter";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { eq, and, sql, desc, isNull } from "drizzle-orm";

export const maxDuration = 300;

const TEMP_DIR = join(tmpdir(), "one-uploads");
const SAFE_TEMP_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/;

// Patterns that indicate the user wants us to remember something
const REMEMBER_PATTERNS = [
  /\bremember\s+(this|that)\b/i,
  /\bdon'?t\s+forget\b/i,
  /\bkeep\s+in\s+mind\b/i,
  /\bremember\s+(?:i|my|me)\b/i,
  /\bnote\s+that\b/i,
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages: chatMessages,
      conversationId,
      model: modelId,
      attachments,
      regenerate,
      parentId,
      editedMessageId,
    } = body as {
      messages: UIMessage[];
      conversationId?: string;
      model?: string;
      attachments?: { images: string[]; files: { name: string; type: string; url: string; size?: number }[] };
      regenerate?: boolean;
      parentId?: string | null;
      editedMessageId?: string | null;
    };

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return Response.json({ error: "Messages are required" }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    // Credit check: block non-admin users with no credits from using paid models
    const [currentUser] = await db
      .select({ role: users.role, creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userBalance = Number(currentUser?.creditBalance || 0);
    const isAdmin = currentUser?.role === "admin";
    const hasCredits = userBalance > 0 || isAdmin;

    if (!hasCredits) {
      // Check if selected model is free
      const selectedModel = modelId || DEFAULT_MODEL;
      const allModels = await getCachedModels();
      const modelInfo = allModels.find((m) => m.id === selectedModel);
      const promptPrice = parseFloat(modelInfo?.pricing?.prompt || "0");
      const completionPrice = parseFloat(modelInfo?.pricing?.completion || "0");
      const isFreeModel = promptPrice === 0 && completionPrice === 0;

      if (!isFreeModel) {
        return Response.json(
          { error: "insufficient_credits", model: selectedModel },
          { status: 402 }
        );
      }
    }

    const selectedModel = modelId || DEFAULT_MODEL;
    console.log(`[chat] Request: model=${selectedModel}, messages=${chatMessages.length}, convId=${conversationId || "new"}, regenerate=${!!regenerate}`);

    const openrouter = getOpenRouter();

    // Create or update conversation
    let convId = conversationId;
    const isNewConversation = !convId;

    if (isNewConversation) {
      const [conv] = await db
        .insert(conversations)
        .values({
          userId,
          model: selectedModel,
          title: "New conversation",
        })
        .returning();
      convId = conv.id;
    } else {
      // Verify conversation belongs to user
      const [existingConv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, convId!), eq(conversations.userId, userId)))
        .limit(1);
      if (!existingConv) {
        return Response.json({ error: "Conversation not found" }, { status: 404 });
      }
      await db
        .update(conversations)
        .set({ updatedAt: new Date(), model: selectedModel })
        .where(eq(conversations.id, convId!));
    }

    // Save user message
    const lastUserMessage = chatMessages[chatMessages.length - 1];
    let userContent = "";
    if (lastUserMessage?.role === "user") {
      const parts = lastUserMessage.parts || [];
      userContent = parts
        .filter((p: { type: string }) => p.type === "text")
        .map((p: { type: string; text?: string }) => p.text || "")
        .join("");
    }

    // Resolve parentId for the new message in the tree.
    // - Edit (UUID editedMessageId): sibling of edited message → same parent
    // - Edit (non-UUID): use parentId from frontend, resolve if needed
    // - Regenerate: new assistant sibling under the user message
    // - Normal send: child of the latest message
    let resolvedParentId: string | null = null;
    const isEdit = !!editedMessageId;

    if (isEdit) {
      if (editedMessageId && UUID_RE.test(editedMessageId)) {
        // Look up the edited message's parent — new message becomes a sibling
        const [editedMsg] = await db
          .select({ parentId: messages.parentId })
          .from(messages)
          .where(eq(messages.id, editedMessageId))
          .limit(1);
        resolvedParentId = editedMsg?.parentId ?? null;
      } else if (parentId && UUID_RE.test(parentId)) {
        // Frontend sent the parent's DB UUID
        resolvedParentId = parentId;
      } else {
        // First message edit (parentId is null) or non-UUID parent → null is correct
        resolvedParentId = null;
      }
    } else if (parentId && UUID_RE.test(parentId)) {
      resolvedParentId = parentId;
    } else if (convId && !isNewConversation) {
      if (regenerate) {
        // Regenerate: parent is the last user message on the active branch
        const [lastUserDbMsg] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(and(eq(messages.conversationId, convId!), eq(messages.role, "user")))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        resolvedParentId = lastUserDbMsg?.id ?? null;
      } else {
        // Normal send: parent is the latest message in the conversation
        const [lastDbMsg] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, convId!))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        resolvedParentId = lastDbMsg?.id ?? null;
      }
    }

    // Save user message (or compute branchIndex for regenerate)
    let assistantParentId: string | null = null;
    let assistantBranchIndex = 0;

    if (userContent && !regenerate) {
      // Compute branchIndex: count existing siblings with same parentId
      let userBranchIndex = 0;
      if (resolvedParentId) {
        const [siblingCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(eq(messages.conversationId, convId!), eq(messages.parentId, resolvedParentId)));
        userBranchIndex = Number(siblingCount?.count || 0);
      } else if (isEdit) {
        // Editing the first message (parentId is null): count root-level user siblings
        const [siblingCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, convId!),
            isNull(messages.parentId),
            eq(messages.role, "user")
          ));
        userBranchIndex = Number(siblingCount?.count || 0);
      }

      const [savedMsg] = await db.insert(messages).values({
        conversationId: convId!,
        role: "user",
        content: userContent,
        parentId: resolvedParentId,
        branchIndex: userBranchIndex,
        metadata: attachments ? { attachments } : undefined,
      }).returning({ id: messages.id });
      assistantParentId = savedMsg.id;

      // Check for explicit "remember this" requests
      if (REMEMBER_PATTERNS.some((p) => p.test(userContent))) {
        extractImmediateMemory(userId, convId!, userContent).catch(
          console.error
        );
      }
    } else if (regenerate && resolvedParentId) {
      // Regenerate: assistant is a new sibling under the same parent (user message)
      assistantParentId = resolvedParentId;
      const [siblingCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(and(eq(messages.conversationId, convId!), eq(messages.parentId, resolvedParentId)));
      assistantBranchIndex = Number(siblingCount?.count || 0);
    }

    // Build dynamic system prompt with conversation context
    // For edits, skip conversation summary/compaction — the edited branch has its own context
    let systemPrompt = isEdit
      ? await buildSystemPrompt(userId, undefined, userContent)
      : await buildSystemPrompt(userId, convId!, userContent);

    if (!hasCredits) {
      systemPrompt += "\n\nNote: The user has no credits. Code execution tools are unavailable. If the user asks to run code, explain the code but mention they need to top up credits to execute it.";
    }

    // Check if conversation needs compaction (summarize old messages)
    // Skip compaction for edits — it would mix branches
    if (!isEdit) {
      await checkAndCompactConversation(convId!, userId).catch(console.error);
    }

    // Get available tools with shared sandbox lifecycle
    // Collect ALL attached files (images + non-images) for potential sandbox auto-upload
    const attachedFileUrls: { url: string; name: string }[] = [];
    // From attachments body field (images + files)
    if (attachments?.files) {
      for (const f of attachments.files) {
        if (f.url) attachedFileUrls.push({ url: f.url, name: f.name });
      }
    }
    if (attachments?.images) {
      // Images are stored as temp URLs like /api/upload/temp/uuid.jpg
      for (const imgUrl of attachments.images) {
        if (imgUrl.startsWith("/api/upload/temp/")) {
          const name = imgUrl.split("/").pop() || "image";
          attachedFileUrls.push({ url: imgUrl, name });
        }
      }
    }
    // Also extract from <attached_file> tags in message text (for non-image files)
    const fileTagRegex = /<attached_file\s[^>]*?url="([^"]+)"[^>]*?name="([^"]+)"[^>]*?\/?>/g;
    let fileMatch: RegExpExecArray | null;
    while ((fileMatch = fileTagRegex.exec(userContent)) !== null) {
      if (!attachedFileUrls.some(f => f.url === fileMatch![1])) {
        attachedFileUrls.push({ url: fileMatch[1], name: fileMatch[2] });
      }
    }
    const fileTagRegex2 = /<attached_file\s[^>]*?name="([^"]+)"[^>]*?url="([^"]+)"[^>]*?\/?>/g;
    while ((fileMatch = fileTagRegex2.exec(userContent)) !== null) {
      if (!attachedFileUrls.some(f => f.url === fileMatch![2])) {
        attachedFileUrls.push({ url: fileMatch[2], name: fileMatch[1] });
      }
    }

    const e2bKey = process.env.E2B_API_KEY;
    let sandbox: Sandbox | null = null;
    const sandboxManager: SandboxManager | undefined = e2bKey
      ? {
          async get() {
            if (!sandbox) {
              sandbox = await Sandbox.create({ apiKey: e2bKey });
              // Auto-upload any attached files into the sandbox
              for (const file of attachedFileUrls) {
                try {
                  const urlFilename = basename(file.url);
                  if (!SAFE_TEMP_FILENAME.test(urlFilename)) {
                    console.warn(`[sandbox] Skipping unsafe filename: ${urlFilename}`);
                    continue;
                  }
                  const localPath = join(TEMP_DIR, urlFilename);
                  const buffer = await readFile(localPath);
                  const destPath = `/home/user/${file.name}`;
                  await sandbox.files.write(destPath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);
                  console.log(`[sandbox] Auto-uploaded ${file.name} → ${destPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
                } catch (err) {
                  // File might have been cleaned up (1hr TTL) — not fatal
                  const msg = err instanceof Error ? err.message : String(err);
                  console.warn(`[sandbox] Could not auto-upload ${file.name}: ${msg}`);
                }
              }
            }
            return sandbox;
          },
          async kill() {
            if (sandbox) {
              await sandbox.kill().catch(console.error);
              sandbox = null;
            }
          },
        }
      : undefined;

    const artifactCtx: ArtifactContext = { conversationId: convId!, userId };
    const tools = getTools(sandboxManager, artifactCtx);

    // At zero credits, remove sandbox tools (code execution costs money)
    if (!hasCredits) {
      for (const name of SANDBOX_TOOL_NAMES) {
        delete tools[name];
      }
    }

    const hasToolsDefined = Object.keys(tools).length > 0;

    // Convert UI messages to model messages.
    // Strip base64 images from sandbox tool results to avoid sending
    // massive payloads back to the model (the model doesn't need them).
    const cleanedMessages = chatMessages.map((msg: UIMessage) => {
      if (!msg.parts) return msg;
      const hasImageToolResult = msg.parts.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.type === "tool-invocation" && IMAGE_TOOL_NAMES.has(p.toolInvocation?.toolName)
      );
      if (!hasImageToolResult) return msg;
      return {
        ...msg,
        parts: msg.parts.map((p) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const part = p as any;
          if (
            part.type === "tool-invocation" &&
            IMAGE_TOOL_NAMES.has(part.toolInvocation?.toolName) &&
            part.toolInvocation?.result?.images
          ) {
            return {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                result: {
                  ...part.toolInvocation.result,
                  images: [], // strip for model
                },
              },
            };
          }
          return p;
        }),
      };
    });
    const modelMessages = await convertToModelMessages(cleanedMessages);

    // Create assistant message immediately so other tabs can see it
    let assistantMessageId: string | null = null;
    try {
      const [saved] = await db.insert(messages).values({
        conversationId: convId!,
        role: "assistant",
        content: "",
        model: selectedModel,
        parentId: assistantParentId,
        branchIndex: assistantBranchIndex,
      }).returning({ id: messages.id });
      assistantMessageId = saved.id;
    } catch (err) {
      console.error("[chat] Failed to create assistant message:", err);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allToolInvocations: Array<Record<string, any>> = [];
    let searchCallCount = 0;
    let sandboxCallCount = 0;
    let accumulatedReasoning: string[] = [];

    // Periodically flush accumulated text to DB so stop/refresh preserves content
    let accumulatedText = "";
    let lastSavedLen = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushTextToDB = async () => {
      if (!assistantMessageId || accumulatedText.length <= lastSavedLen) return;
      lastSavedLen = accumulatedText.length;
      try {
        const metadata: Record<string, unknown> = {};
        if (allToolInvocations.length > 0) metadata.toolInvocations = allToolInvocations;
        const reasoningSegments = accumulatedReasoning.filter(s => s.trim()); if (reasoningSegments.length > 0) metadata.reasoning = reasoningSegments;
        await db.update(messages)
          .set({ content: accumulatedText, metadata: Object.keys(metadata).length > 0 ? metadata : undefined })
          .where(eq(messages.id, assistantMessageId));
      } catch {
        // Non-fatal — onFinish will do final save
      }
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushTextToDB();
      }, 1000); // Flush every 1s during streaming
    };

    const result = trackedStreamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: hasToolsDefined ? tools : undefined,
      stopWhen: hasToolsDefined ? stepCountIs(10) : undefined,
      onError: (error) => {
        console.error(`[chat] Stream error with model ${selectedModel}:`, error);
        // Flush whatever we have on error
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flushTextToDB();
      },
      onChunk: ({ chunk }) => {
        if (chunk.type === "text-delta" && chunk.text) {
          accumulatedText += chunk.text;
          scheduleFlush();
        } else if (chunk.type === "reasoning-delta") {
          const c = chunk as any;
          const delta = c.text || c.delta || "";
          if (delta) {
            if (accumulatedReasoning.length === 0) {
              accumulatedReasoning.push(delta);
            } else {
              accumulatedReasoning[accumulatedReasoning.length - 1] += delta;
            }
          }
        }
      },
      onStepFinish: async ({ text, toolCalls, toolResults }) => {
        // Start a new reasoning segment for the next step
        if (accumulatedReasoning.length > 0 && accumulatedReasoning[accumulatedReasoning.length - 1].trim()) {
          accumulatedReasoning.push("");
        }
        const stepText = text || accumulatedText || "";
        // Collect tool invocations from this step
        if (toolCalls) {
          for (const tc of toolCalls) {
            if (tc.toolName === "web_search") searchCallCount++;
            if (SANDBOX_TOOL_NAMES.has(tc.toolName)) sandboxCallCount++;
            const tr = toolResults?.find(
              (r: any) => r.toolCallId === tc.toolCallId
            );
            allToolInvocations.push({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: (tc as any).input ?? {},
              result: tr ? (tr as any).output : undefined,
            });
          }
        }

        // Update assistant message with latest content + tool results
        try {
          if (assistantMessageId) {
            const content = stepText;
            const metadata: Record<string, unknown> = {};
            if (allToolInvocations.length > 0) metadata.toolInvocations = allToolInvocations;
            const reasoningSegments = accumulatedReasoning.filter(s => s.trim()); if (reasoningSegments.length > 0) metadata.reasoning = reasoningSegments;
            await db.update(messages)
              .set({ content, metadata: Object.keys(metadata).length > 0 ? metadata : undefined })
              .where(eq(messages.id, assistantMessageId));
          }
        } catch (err) {
          console.error("[chat] Failed to save step:", err);
        }
      },
      onAbort: async () => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        if (assistantMessageId && (accumulatedText.length > 0 || accumulatedReasoning.some(s => s.trim()))) {
          try {
            const metadata: Record<string, unknown> = {};
            if (allToolInvocations.length > 0) metadata.toolInvocations = allToolInvocations;
            const reasoningSegments = accumulatedReasoning.filter(s => s.trim()); if (reasoningSegments.length > 0) metadata.reasoning = reasoningSegments;
            await db.update(messages).set({ content: accumulatedText, metadata: Object.keys(metadata).length > 0 ? metadata : undefined }).where(eq(messages.id, assistantMessageId));
          } catch (err) { console.error("[chat] Failed to save on abort:", err); }
        }
        if (sandboxManager) sandboxManager.kill().catch(console.error);
      },
      onFinish: async ({ text, usage }) => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

        // Use whichever has more content
        const finalText = (text && text.length >= accumulatedText.length) ? text : (accumulatedText || text || "");

        // Final update with complete text and token counts
        try {
          const metadata: Record<string, unknown> = {};
          if (allToolInvocations.length > 0) metadata.toolInvocations = allToolInvocations;
          const reasoningSegments = accumulatedReasoning.filter(s => s.trim()); if (reasoningSegments.length > 0) metadata.reasoning = reasoningSegments;

          if (assistantMessageId) {
            await db.update(messages)
              .set({
                content: finalText,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
              })
              .where(eq(messages.id, assistantMessageId));
          }
        } catch (err) {
          console.error("[chat] Failed to save final message:", err);
        }

        // Log search usage
        for (let i = 0; i < searchCallCount; i++) {
          logSearchUsage(userId, convId!).catch(console.error);
        }
        // Log sandbox usage
        for (let i = 0; i < sandboxCallCount; i++) {
          logSandboxUsage(userId, convId!).catch(console.error);
        }

        // Kill sandbox
        if (sandboxManager) {
          sandboxManager.kill().catch(console.error);
        }

        // Background tasks
        if (finalText && userContent) {
          generateConversationTitle(convId!, userContent, finalText, userId).catch(console.error);
        }
        if (!isEdit) {
          updateConversationSummary(convId!, userId).catch(console.error);
        }
        if (finalText && userContent) {
          extractMemories(userId, convId!, userContent, finalText).catch(console.error);
        }
      },
    }, { userId, conversationId: convId!, type: "chat", model: selectedModel });

    return result.toUIMessageStreamResponse({
      headers: {
        "X-Conversation-Id": convId!,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    // Return proper error with status so the client can display it
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
