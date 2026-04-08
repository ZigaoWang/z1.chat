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
import { getTools } from "@/lib/tools";
import { trackedStreamText, logSearchUsage } from "@/lib/usage-logger";
import { eq, and } from "drizzle-orm";

export const maxDuration = 120;

// Patterns that indicate the user wants us to remember something
const REMEMBER_PATTERNS = [
  /\bremember\s+(this|that)\b/i,
  /\bdon'?t\s+forget\b/i,
  /\bkeep\s+in\s+mind\b/i,
  /\bremember\s+(?:i|my|me)\b/i,
  /\bnote\s+that\b/i,
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages: chatMessages,
      conversationId,
      model: modelId,
      attachments,
      regenerate,
    } = body as {
      messages: UIMessage[];
      conversationId?: string;
      model?: string;
      attachments?: { images: string[]; files: { name: string; type: string; url: string; size?: number }[] };
      regenerate?: boolean;
    };

    if (!chatMessages || !Array.isArray(chatMessages) || chatMessages.length === 0) {
      return Response.json({ error: "Messages are required" }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    // Credit check: block non-admin users with no credits
    const [currentUser] = await db
      .select({ role: users.role, creditBalance: users.creditBalance })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (currentUser && currentUser.role !== "admin" && currentUser.creditBalance <= 0) {
      return Response.json(
        { error: "You've run out of credits. Contact an admin to add more." },
        { status: 402 }
      );
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

    if (userContent && !regenerate) {
      await db.insert(messages).values({
        conversationId: convId!,
        role: "user",
        content: userContent,
        metadata: attachments ? { attachments } : undefined,
      });

      // Check for explicit "remember this" requests
      if (REMEMBER_PATTERNS.some((p) => p.test(userContent))) {
        extractImmediateMemory(userId, convId!, userContent).catch(
          console.error
        );
      }
    }

    // Build dynamic system prompt with conversation context
    const systemPrompt = await buildSystemPrompt(userId, convId!, userContent);

    // Check if conversation needs compaction (summarize old messages)
    await checkAndCompactConversation(convId!, userId).catch(console.error);

    // Get available tools
    const tools = getTools();
    const hasToolsDefined = Object.keys(tools).length > 0;

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(chatMessages);

    const result = trackedStreamText({
      model: openrouter(selectedModel),
      system: systemPrompt,
      messages: modelMessages,
      tools: hasToolsDefined ? tools : undefined,
      stopWhen: hasToolsDefined ? stepCountIs(10) : undefined,
      onError: (error) => {
        console.error(`[chat] Stream error with model ${selectedModel}:`, error);
      },
      onFinish: async ({ text, usage, steps }) => {
        if (!text || text.trim().length === 0) {
          console.warn(`[chat] Empty response from model ${selectedModel} for conversation ${convId}`);
        }

        // Collect tool invocations from all steps for persistence
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolInvocations: Array<Record<string, any>> = [];
        let searchCallCount = 0;
        if (steps) {
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                if (tc.toolName === "web_search") searchCallCount++;
                const result = step.toolResults?.find(
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (tr: any) => tr.toolCallId === tc.toolCallId
                );
                toolInvocations.push({
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  args: (tc as any).input ?? {},
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  result: result ? (result as any).output : undefined,
                });
              }
            }
          }
        }

        // Log search tool usage
        if (searchCallCount > 0) {
          for (let i = 0; i < searchCallCount; i++) {
            logSearchUsage(userId, convId!).catch(console.error);
          }
        }

        // Save assistant message with tool invocations
        await db.insert(messages).values({
          conversationId: convId!,
          role: "assistant",
          content: text,
          model: selectedModel,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          metadata: toolInvocations.length > 0
            ? { toolInvocations }
            : undefined,
        });

        // Background: Generate/update title on every exchange
        if (text && userContent) {
          generateConversationTitle(convId!, userContent, text, userId).catch(
            console.error
          );
        }

        // Background: Update conversation summary (Layer 1)
        updateConversationSummary(convId!, userId).catch(console.error);

        // Background: Extract user memories (Layer 2)
        if (text && userContent) {
          extractMemories(userId, convId!, userContent, text).catch(
            console.error
          );
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
