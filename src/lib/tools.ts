import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import sharp from "sharp";

const MAX_PAGE_TEXT = 30_000; // chars to return from fetched page
const MAX_IMAGES_PER_EXEC = 3;
const MAX_IMAGE_BASE64_SIZE = 500_000; // ~500KB base64
const MAX_FILE_DOWNLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_DOWNLOAD_IMAGE_DIMENSION = 800; // resize downloaded images to fit this
const TEMP_DIR = join(tmpdir(), "one-uploads");

// Image extensions for file_download
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

export interface SandboxManager {
  get: () => Promise<Sandbox>;
  kill: () => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTools(sandboxManager?: SandboxManager): Record<string, any> {
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

        // Jina returns markdown with a "Title: ..." line at the top
        const titleMatch = content.match(/^Title:\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : null;

        return {
          url,
          title,
          content,
          truncated,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("abort")) {
          return { error: "Request timed out after 30 seconds." };
        }
        return { error: `Failed to fetch page: ${msg}` };
      }
    },
  });

  // Sandbox tools — only when E2B key is configured
  const e2bKey = process.env.E2B_API_KEY;
  if (e2bKey && sandboxManager) {
    // Code execution (Python or JavaScript)
    tools.code_execute = tool({
      description:
        "Execute Python or JavaScript code in a sandboxed Linux environment with persistent state. Use for math, statistics, data analysis, charts (matplotlib), file conversions, text processing, or any task where running code gives a better answer. Pre-installed: pandas, numpy, matplotlib, scipy, sympy, pillow, openpyxl. Variables persist between calls.",
      inputSchema: z.object({
        code: z
          .string()
          .describe("Code to execute"),
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

          const stdout = execution.logs.stdout.join("");
          const stderr = execution.logs.stderr.join("");

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

          const text = textParts.join("\n") || undefined;
          const error = execution.error
            ? `${execution.error.name}: ${execution.error.value}`
            : undefined;

          return {
            text: text || null,
            stdout: stdout || null,
            stderr: stderr || null,
            error: error || null,
            images,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[code_execute] Sandbox error:", msg);
          return {
            text: null,
            stdout: null,
            stderr: null,
            error: `Sandbox error: ${msg}`,
            images: [],
          };
        }
      },
    });

    // Shell command execution
    tools.shell_exec = tool({
      description:
        "Run a shell command in the sandbox. Use for installing packages (pip install, apt-get install -y), running CLI tools (ffmpeg, pandoc, imagemagick, tesseract), listing files, or any system operation. The sandbox is a full Linux environment.",
      inputSchema: z.object({
        command: z
          .string()
          .describe("Shell command to execute"),
      }),
      execute: async ({ command }) => {
        try {
          const sandbox = await sandboxManager.get();
          const result = await sandbox.commands.run(command, {
            requestTimeoutMs: 60_000,
          });

          return {
            stdout: result.stdout || null,
            stderr: result.stderr || null,
            exitCode: result.exitCode,
            error: result.error || null,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[shell_exec] Sandbox error:", msg);
          return {
            stdout: null,
            stderr: null,
            exitCode: -1,
            error: `Sandbox error: ${msg}`,
          };
        }
      },
    });

    // File upload — push user files into sandbox
    tools.file_upload = tool({
      description:
        "Copy a user's uploaded file into the sandbox so it can be processed by code or shell commands. When the user attaches a file, you see it in your message history as an <attached_file> tag with a url attribute (e.g. /api/upload/temp/uuid.ext). Pass that URL as the fileUrl parameter. The file stays at this URL across all messages in the conversation.",
      inputSchema: z.object({
        fileUrl: z
          .string()
          .describe("The URL from the <attached_file> tag in the conversation. Example: /api/upload/temp/12345-abcde.mid. Find this in earlier messages where the user attached a file."),
        sandboxPath: z
          .string()
          .optional()
          .describe("Destination path in the sandbox — defaults to /home/user/<filename>"),
      }),
      execute: async ({ fileUrl, sandboxPath }) => {
        try {
          // Extract filename from URL
          const urlFilename = fileUrl.split("/").pop() || "file";

          // Read from temp directory directly (server-side)
          const localPath = join(TEMP_DIR, urlFilename);
          const buffer = await readFile(localPath);

          const destPath = sandboxPath || `/home/user/${urlFilename}`;

          const sandbox = await sandboxManager.get();
          await sandbox.files.write(destPath, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

          return {
            path: destPath,
            size: buffer.length,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[file_upload] Error:", msg);
          return { error: `File upload failed: ${msg}` };
        }
      },
    });

    // File download — read files from sandbox
    tools.file_download = tool({
      description:
        "Read a file from the sandbox to show the user. This is the ONLY way to return generated/modified images or files to the user. After saving a file with code_execute (e.g. PIL image.save, ffmpeg output), call this tool with the file path to display it. For images, returns inline base64. For text, returns content.",
      inputSchema: z.object({
        sandboxPath: z
          .string()
          .describe("Absolute path to the file in the sandbox"),
      }),
      execute: async ({ sandboxPath }) => {
        try {
          const sandbox = await sandboxManager.get();
          const ext = sandboxPath.split(".").pop()?.toLowerCase() || "";

          if (IMAGE_EXTENSIONS.has(ext)) {
            // Read as bytes, resize/compress, return base64 JPEG
            const bytes = await sandbox.files.read(sandboxPath, { format: "bytes" });
            if (bytes.length > MAX_FILE_DOWNLOAD_SIZE) {
              return { error: `File too large (${(bytes.length / 1024 / 1024).toFixed(1)}MB). Max 5MB.` };
            }
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
              // If sharp fails (e.g. SVG), use raw bytes but cap size
              const raw = Buffer.from(bytes);
              if (raw.length > MAX_IMAGE_BASE64_SIZE) {
                return { error: "Image too large to return inline." };
              }
              outputBuffer = raw;
            }
            // Final safety check — don't return huge base64
            const base64 = outputBuffer.toString("base64");
            if (base64.length > MAX_IMAGE_BASE64_SIZE) {
              // Re-compress at lower quality
              try {
                const smaller = await sharp(outputBuffer)
                  .resize(400, 400, { fit: "inside", withoutEnlargement: true })
                  .jpeg({ quality: 60 })
                  .toBuffer();
                const smallBase64 = smaller.toString("base64");
                return {
                  filename: sandboxPath.split("/").pop(),
                  type: "image",
                  images: [smallBase64],
                };
              } catch {
                return { error: "Image too large to return inline." };
              }
            }
            return {
              filename: sandboxPath.split("/").pop(),
              type: "image",
              images: [base64],
            };
          } else {
            // Try reading as text
            const content = await sandbox.files.read(sandboxPath, { format: "text" });
            if (content.length > MAX_FILE_DOWNLOAD_SIZE) {
              return {
                filename: sandboxPath.split("/").pop(),
                type: "text",
                content: content.slice(0, MAX_FILE_DOWNLOAD_SIZE),
                truncated: true,
              };
            }
            return {
              filename: sandboxPath.split("/").pop(),
              type: "text",
              content,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[file_download] Error:", msg);
          return { error: `File download failed: ${msg}` };
        }
      },
    });
  } else if (e2bKey && !sandboxManager) {
    // Fallback: code_execute without sandbox manager (stateless, backward compat)
    tools.code_execute = tool({
      description:
        "Execute Python code in a sandboxed environment. Use for math, statistics, data analysis, charts (matplotlib), file conversions, text processing, or any task where running code gives a better answer. Pre-installed: pandas, numpy, matplotlib, scipy, sympy, pillow, openpyxl.",
      inputSchema: z.object({
        code: z
          .string()
          .describe("Python code to execute"),
      }),
      execute: async ({ code }) => {
        let sandbox: Sandbox | null = null;
        try {
          sandbox = await Sandbox.create({ apiKey: e2bKey });
          const execution = await sandbox.runCode(code, {
            timeoutMs: 30_000,
          });

          const stdout = execution.logs.stdout.join("");
          const stderr = execution.logs.stderr.join("");

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

          const text = textParts.join("\n") || undefined;
          const error = execution.error
            ? `${execution.error.name}: ${execution.error.value}`
            : undefined;

          return {
            text: text || null,
            stdout: stdout || null,
            stderr: stderr || null,
            error: error || null,
            images,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[code_execute] Sandbox error:", msg);
          return {
            text: null,
            stdout: null,
            stderr: null,
            error: `Sandbox error: ${msg}`,
            images: [],
          };
        } finally {
          if (sandbox) {
            sandbox.kill().catch(console.error);
          }
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
