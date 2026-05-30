import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import sharp from "sharp";
import { db } from "./db";
import { artifacts } from "./db/schema";
import { eq, and, sql } from "drizzle-orm";

/** Strip markdown code fences that models sometimes wrap artifact content in */
function stripCodeFences(content: string): string {
  const trimmed = content.trim();
  const match = trimmed.match(/^```\w*\n([\s\S]*?)```$/);
  return match ? match[1].trim() : trimmed;
}

const MAX_PAGE_TEXT = 30_000;
const MAX_IMAGES_PER_EXEC = 3;
const MAX_IMAGE_BASE64_SIZE = 500_000; // ~500KB base64
const MAX_FILE_DOWNLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOWNLOAD_IMAGE_DIMENSION = 800;
const MAX_OUTPUT_LENGTH = 20_000; // cap stdout/stderr to avoid huge tool results
const TEMP_DIR = join(tmpdir(), "one-uploads");

// Safe filename pattern — only allow UUID.ext from our upload route
const SAFE_TEMP_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

export interface SandboxManager {
  get: () => Promise<Sandbox>;
  kill: () => Promise<void>;
}

function truncateOutput(text: string, max = MAX_OUTPUT_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... [truncated, ${text.length - max} chars omitted]`;
}

function resolveLocalTempPath(fileUrl: string): string | null {
  const filename = basename(fileUrl);
  if (!SAFE_TEMP_FILENAME.test(filename)) return null;
  return join(TEMP_DIR, filename);
}

export interface ArtifactContext {
  conversationId: string;
  userId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTools(sandboxManager?: SandboxManager, artifactCtx?: ArtifactContext): Record<string, any> {
  const tools: Record<string, unknown> = {};

  // Web search via Tavily
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    tools.web_search = tool({
      description:
        "Search the web for current information, facts, prices, news, product details, comparisons, or anything the model might not know or might be outdated on. Always use this instead of guessing.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("The search query — be specific and concise"),
      }),
      execute: async ({ query }) => {
        try {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: tavilyKey,
              query,
              search_depth: "basic",
              max_results: 5,
              include_answer: true,
            }),
          });

          if (!res.ok) {
            return { error: `Search failed: ${res.status}` };
          }

          const data = await res.json();

          return {
            answer: data.answer || null,
            results: (data.results || []).map(
              (r: { title: string; url: string; content: string }) => ({
                title: r.title,
                url: r.url,
                snippet: r.content?.slice(0, 300),
              })
            ),
          };
        } catch (error) {
          console.error("Web search error:", error);
          return { error: "Search failed" };
        }
      },
    });
  }

  // Fetch page content from a URL via Jina Reader
  tools.fetch_page = tool({
    description:
      "Fetch the content of a web page by URL. Use this when the user shares a link and wants you to read, summarize, or discuss its content. Returns the page title and extracted markdown text. Works on JS-rendered sites, articles, docs, and most public pages.",
    inputSchema: z.object({
      url: z
        .string()
        .url()
        .describe("The full URL to fetch (must start with http:// or https://)"),
    }),
    execute: async ({ url }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const res = await fetch(`https://r.jina.ai/${url}`, {
          signal: controller.signal,
          headers: {
            Accept: "text/markdown",
            "X-No-Cache": "true",
          },
        });

        clearTimeout(timeout);

        if (!res.ok) {
          return { error: `Failed to fetch page: HTTP ${res.status}` };
        }

        let content = await res.text();
        let truncated = false;

        if (content.length > MAX_PAGE_TEXT) {
          content = content.slice(0, MAX_PAGE_TEXT);
          truncated = true;
        }

        if (!content.trim()) {
          return { url, error: "Page loaded but no readable content was found." };
        }

        const titleMatch = content.match(/^Title:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : null;

        return { url, title, content, truncated };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("abort")) {
          return { error: "Request timed out after 30 seconds." };
        }
        return { error: `Failed to fetch page: ${msg}` };
      }
    },
  });

  // Sandbox tools — only when E2B key is configured and sandboxManager is provided
  const e2bKey = process.env.E2B_API_KEY;
  if (e2bKey && sandboxManager) {
    tools.code_execute = tool({
      description:
        "Execute Python or JavaScript code in a sandboxed Linux environment with persistent state. Use for math, statistics, data analysis, charts (matplotlib), file conversions, text processing, or any task where running code gives a better answer. Pre-installed: pandas, numpy, matplotlib, scipy, sympy, pillow, openpyxl. Variables persist between calls.",
      inputSchema: z.object({
        code: z.string().describe("Code to execute"),
        language: z
          .enum(["python", "javascript"])
          .optional()
          .describe("Language to run — defaults to python"),
      }),
      execute: async ({ code, language }) => {
        try {
          const sandbox = await sandboxManager.get();
          const execution = await sandbox.runCode(code, {
            language: language || "python",
            timeoutMs: 30_000,
          });

          const stdout = truncateOutput(execution.logs.stdout.join(""));
          const stderr = truncateOutput(execution.logs.stderr.join(""));

          const images: string[] = [];
          const textParts: string[] = [];
          for (const result of execution.results) {
            if (result.png && images.length < MAX_IMAGES_PER_EXEC) {
              if (result.png.length <= MAX_IMAGE_BASE64_SIZE) {
                images.push(result.png);
              }
            }
            if (result.text) {
              textParts.push(result.text);
            }
          }

          return {
            text: textParts.join("\n") || null,
            stdout: stdout || null,
            stderr: stderr || null,
            error: execution.error
              ? `${execution.error.name}: ${execution.error.value}`
              : null,
            images,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[code_execute] Sandbox error:", msg);
          return { text: null, stdout: null, stderr: null, error: `Sandbox error: ${msg}`, images: [] };
        }
      },
    });

    tools.shell_exec = tool({
      description:
        "Run a shell command in the sandbox. Use for installing packages (pip install, apt-get install -y), running CLI tools (ffmpeg, pandoc, imagemagick, tesseract), listing files, or any system operation. The sandbox is a full Linux environment.",
      inputSchema: z.object({
        command: z.string().describe("Shell command to execute"),
      }),
      execute: async ({ command }) => {
        try {
          const sandbox = await sandboxManager.get();
          const result = await sandbox.commands.run(command, {
            requestTimeoutMs: 60_000,
          });

          return {
            stdout: truncateOutput(result.stdout || ""),
            stderr: truncateOutput(result.stderr || ""),
            exitCode: result.exitCode,
            error: result.error || null,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[shell_exec] Sandbox error:", msg);
          return { stdout: null, stderr: null, exitCode: -1, error: `Sandbox error: ${msg}` };
        }
      },
    });

    tools.file_upload = tool({
      description:
        "Copy a user's uploaded file into the sandbox so it can be processed by code or shell commands. When the user attaches a file, you see it in your message history as an <attached_file> tag with a url attribute (e.g. /api/upload/temp/uuid.ext). Pass that URL as the fileUrl parameter.",
      inputSchema: z.object({
        fileUrl: z
          .string()
          .describe("The URL from the <attached_file> tag. Example: /api/upload/temp/12345-abcde.mid"),
        sandboxPath: z
          .string()
          .optional()
          .describe("Destination path in the sandbox — defaults to /home/user/<filename>"),
      }),
      execute: async ({ fileUrl, sandboxPath }) => {
        try {
          const localPath = resolveLocalTempPath(fileUrl);
          if (!localPath) {
            return { error: "Invalid file URL. Expected /api/upload/temp/<uuid>.<ext>" };
          }

          const buffer = await readFile(localPath);
          const urlFilename = basename(fileUrl);
          const destPath = sandboxPath || `/home/user/${urlFilename}`;

          const sandbox = await sandboxManager.get();
          await sandbox.files.write(destPath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

          return { path: destPath, size: buffer.length };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[file_upload] Error:", msg);
          return { error: `File upload failed: ${msg}` };
        }
      },
    });

    tools.file_download = tool({
      description:
        "Read a file from the sandbox to show the user. This is the ONLY way to return generated/modified images or files to the user. After saving a file with code_execute (e.g. PIL image.save, ffmpeg output), call this tool with the file path to display it. For images, returns inline base64. For text, returns content.",
      inputSchema: z.object({
        sandboxPath: z.string().describe("Absolute path to the file in the sandbox"),
      }),
      execute: async ({ sandboxPath }) => {
        try {
          const sandbox = await sandboxManager.get();
          const ext = sandboxPath.split(".").pop()?.toLowerCase() || "";

          if (IMAGE_EXTENSIONS.has(ext)) {
            const bytes = await sandbox.files.read(sandboxPath, { format: "bytes" });
            if (bytes.length > MAX_FILE_DOWNLOAD_SIZE) {
              return { error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB). Max 5MB.` };
            }

            // Resize + JPEG compress to keep base64 small
            let outputBuffer: Buffer;
            try {
              outputBuffer = await sharp(Buffer.from(bytes))
                .resize(MAX_DOWNLOAD_IMAGE_DIMENSION, MAX_DOWNLOAD_IMAGE_DIMENSION, {
                  fit: "inside",
                  withoutEnlargement: true,
                })
                .jpeg({ quality: 80 })
                .toBuffer();
            } catch {
              const raw = Buffer.from(bytes);
              if (raw.length > MAX_IMAGE_BASE64_SIZE) {
                return { error: "Image too large to return inline." };
              }
              outputBuffer = raw;
            }

            const base64 = outputBuffer.toString("base64");
            if (base64.length > MAX_IMAGE_BASE64_SIZE) {
              try {
                const smaller = await sharp(outputBuffer)
                  .resize(400, 400, { fit: "inside", withoutEnlargement: true })
                  .jpeg({ quality: 60 })
                  .toBuffer();
                return { filename: basename(sandboxPath), type: "image", images: [smaller.toString("base64")] };
              } catch {
                return { error: "Image too large to return inline." };
              }
            }
            return { filename: basename(sandboxPath), type: "image", images: [base64] };
          } else {
            // Text file — read with graceful error for binary
            try {
              const content = await sandbox.files.read(sandboxPath, { format: "text" });
              return {
                filename: basename(sandboxPath),
                type: "text",
                content: content.length > MAX_FILE_DOWNLOAD_SIZE
                  ? content.slice(0, MAX_FILE_DOWNLOAD_SIZE) + "\n[truncated]"
                  : content,
                truncated: content.length > MAX_FILE_DOWNLOAD_SIZE,
              };
            } catch {
              return { error: `Could not read file as text. It may be a binary file.` };
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[file_download] Error:", msg);
          return { error: `File download failed: ${msg}` };
        }
      },
    });
  }

  // Artifact tools — always available when we have a conversation context
  if (artifactCtx) {
    const { conversationId, userId } = artifactCtx;

    tools.create_artifact = tool({
      description:
        "Create a substantial piece of content in the artifact panel. Use for documents/essays/reports (type: document), code files over 15 lines (type: code), full HTML pages (type: html), or diagrams (type: mermaid). Do NOT use for short answers or small code snippets.",
      inputSchema: z.object({
        type: z.enum(["document", "code", "html", "svg", "mermaid"]).describe("The artifact type"),
        title: z.string().describe("A short descriptive title"),
        content: z.string().describe("The full content"),
        language: z.string().optional().describe("Programming language for code artifacts (e.g. python, typescript)"),
      }),
      execute: async ({ type, title, content, language }) => {
        try {
          const cleanContent = stripCodeFences(content);
          const [artifact] = await db.insert(artifacts).values({
            conversationId,
            userId,
            type,
            title,
            content: cleanContent,
            language: language || null,
          }).returning();
          return { id: artifact.id, type, title };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[create_artifact] Error:", msg);
          return { error: `Failed to create artifact: ${msg}` };
        }
      },
    });

    tools.update_artifact = tool({
      description:
        "Replace the entire content of an existing artifact. Use for major rewrites. Creates a version snapshot for undo. Identify the artifact by its title.",
      inputSchema: z.object({
        identifier: z.string().describe("The artifact title to update"),
        content: z.string().describe("The complete new content"),
      }),
      execute: async ({ identifier, content }) => {
        try {
          const cleanContent = stripCodeFences(content);
          // Find by title within this conversation
          const existing = await db.query.artifacts.findFirst({
            where: and(
              eq(artifacts.conversationId, conversationId),
              eq(artifacts.title, identifier),
            ),
          });
          if (!existing) {
            return { error: `Artifact "${identifier}" not found` };
          }

          await db.update(artifacts)
            .set({ content: cleanContent, updatedAt: new Date() })
            .where(eq(artifacts.id, existing.id));

          return { id: existing.id, title: existing.title };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[update_artifact] Error:", msg);
          return { error: `Failed to update artifact: ${msg}` };
        }
      },
    });

    tools.edit_artifact = tool({
      description:
        "Make a small edit to an existing artifact by finding and replacing text. Does not create a version snapshot. Use for minor fixes like typos, small paragraph changes, or updating a function.",
      inputSchema: z.object({
        identifier: z.string().describe("The artifact title to edit"),
        find: z.string().describe("Exact text to find in the artifact"),
        replace: z.string().describe("Text to replace it with"),
      }),
      execute: async ({ identifier, find, replace }) => {
        try {
          const existing = await db.query.artifacts.findFirst({
            where: and(
              eq(artifacts.conversationId, conversationId),
              eq(artifacts.title, identifier),
            ),
          });
          if (!existing) {
            return { error: `Artifact "${identifier}" not found` };
          }

          if (!existing.content.includes(find)) {
            return { error: `Text not found in artifact`, changed: false };
          }

          const newContent = existing.content.replace(find, replace);
          await db.update(artifacts)
            .set({ content: newContent, updatedAt: new Date() })
            .where(eq(artifacts.id, existing.id));

          return { id: existing.id, title: existing.title, changed: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[edit_artifact] Error:", msg);
          return { error: `Failed to edit artifact: ${msg}` };
        }
      },
    });
  }

  return tools;
}

export function hasTools(): boolean {
  return true; // fetch_page is always available
}

// Sandbox tool names for identification
export const SANDBOX_TOOL_NAMES = new Set(["code_execute", "shell_exec", "file_upload", "file_download"]);

// Tool names that can produce images
export const IMAGE_TOOL_NAMES = new Set(["code_execute", "file_download"]);

// Artifact tool names
export const ARTIFACT_TOOL_NAMES = new Set(["create_artifact", "update_artifact", "edit_artifact"]);
