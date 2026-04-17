"use client";

import { memo, useState, useCallback } from "react";
import {
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  Pencil,
  X,
  Copy,
  Eye,
  Globe,
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
  Code,
} from "lucide-react";
import MarkdownRenderer from "./markdown-renderer";
import { extractArtifacts } from "./artifact-preview";

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string;
  args: Record<string, unknown>;
  result?: unknown;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchToolResult {
  answer?: string | null;
  results?: SearchResult[];
  error?: string;
}

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  model?: string | null;
  images?: string[];
  files?: { name: string; type: string; url: string; size?: number }[];
  toolInvocations?: ToolInvocation[];
  isLast?: boolean;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onOpenArtifact?: (code: string, language: string) => void;
  versionCount?: number;
  currentVersion?: number;
  onVersionChange?: (index: number) => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function getFileIcon(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (type === "application/pdf" || ext === "pdf") return FileText;
  // Code files
  if ([
    "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "hpp",
    "cs", "swift", "kt", "php", "lua", "r", "dart", "vue", "svelte", "astro",
    "html", "css", "scss", "sass", "less", "sql", "sh", "bash", "zsh",
    "graphql", "proto", "dockerfile", "makefile", "env", "ini", "cfg", "conf",
  ].includes(ext || "")) return FileCode;
  // Spreadsheets
  if (["csv", "tsv", "xls", "xlsx"].includes(ext || "")) return FileSpreadsheet;
  // Documents and text
  if (["txt", "md", "json", "jsonl", "xml", "yaml", "yml", "toml", "log", "rtf", "docx", "doc", "pptx", "ppt", "odp"].includes(ext || "")) return FileText;
  return File;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);
  return { copied, copy };
}

// --- Search status (clean, no spinning globe) ---
function SearchStatus({ invocations }: { invocations: ToolInvocation[] }) {
  const [expanded, setExpanded] = useState(false);
  const searches = invocations.filter((t) => t.toolName === "web_search");
  if (searches.length === 0) return null;

  const activeSearch = searches.find((s) => s.state !== "output-available" && s.state !== "output-error");
  const isSearching = !!activeSearch;
  const activeQuery = activeSearch?.args?.query as string | undefined;

  const sources: SearchResult[] = [];
  for (const s of searches) {
    if (s.state === "output-available" && s.result) {
      const r = s.result as SearchToolResult;
      if (r.results) {
        for (const src of r.results) {
          if (!sources.some((x) => x.url === src.url)) sources.push(src);
        }
      }
    }
  }

  return (
    <div className="mb-2 text-xs text-muted-foreground/50">
      {isSearching ? (
        <span>{activeQuery ? `Searching for "${activeQuery}"` : "Searching the web"}...</span>
      ) : (
        <button
          onClick={() => sources.length > 0 && setExpanded(!expanded)}
          className={`inline-flex items-center gap-1 ${sources.length > 0 ? "hover:text-muted-foreground cursor-pointer" : ""}`}
        >
          <span>Used {sources.length} source{sources.length !== 1 ? "s" : ""}</span>
          {sources.length > 0 && <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />}
        </button>
      )}

      {expanded && sources.length > 0 && (
        <div className="mt-1.5 space-y-0.5 pl-0.5">
          {sources.map((src, i) => (
            <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 py-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors">
              <img src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`} alt="" className="h-3 w-3 rounded-sm shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span className="truncate">{src.title || getDomain(src.url)}</span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-0 group-hover:opacity-100" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

interface SandboxToolResult {
  text?: string | null;
  stdout?: string | null;
  stderr?: string | null;
  error?: string | null;
  images?: string[];
  exitCode?: number;
  path?: string;
  size?: number;
  filename?: string;
  type?: string;
  content?: string;
}

const SANDBOX_TOOL_NAMES = new Set(["code_execute", "shell_exec", "file_upload", "file_download"]);

function getSandboxLabel(toolName: string, isRunning: boolean): string {
  if (isRunning) {
    switch (toolName) {
      case "shell_exec": return "Running command...";
      case "file_upload": return "Uploading file...";
      case "file_download": return "Reading file...";
      default: return "Running code...";
    }
  }
  switch (toolName) {
    case "shell_exec": return "Ran command";
    case "file_upload": return "Uploaded file";
    case "file_download": return "Read file";
    default: return "Ran code";
  }
}

// --- Sandbox status (code_execute, shell_exec, file_upload, file_download) ---
function SandboxStatus({ invocations }: { invocations: ToolInvocation[] }) {
  const [expanded, setExpanded] = useState(false);
  const executions = invocations.filter((t) => SANDBOX_TOOL_NAMES.has(t.toolName));
  if (executions.length === 0) return null;

  const activeExec = executions.find((s) => s.state !== "output-available" && s.state !== "output-error");
  const isRunning = !!activeExec;

  // Collect output from completed executions
  const outputs: { stdout: string; stderr: string; error: string | null; toolName: string }[] = [];
  for (const e of executions) {
    if (e.state === "output-available" && e.result) {
      const r = e.result as SandboxToolResult;
      outputs.push({
        stdout: r.stdout || "",
        stderr: r.stderr || "",
        error: r.error || null,
        toolName: e.toolName,
      });
    }
  }

  const hasOutput = outputs.some((o) => o.stdout || o.stderr);

  // Determine label
  const label = isRunning
    ? getSandboxLabel(activeExec!.toolName, true)
    : (() => {
        const uniqueTools = [...new Set(executions.map((e) => e.toolName))];
        if (uniqueTools.length === 1) {
          const suffix = executions.length > 1 ? ` (${executions.length}x)` : "";
          return getSandboxLabel(uniqueTools[0], false) + suffix;
        }
        return `Ran ${executions.length} sandbox operations`;
      })();

  return (
    <div className="mb-2 text-xs text-muted-foreground/50">
      {isRunning ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" />
          {label}
        </span>
      ) : (
        <button
          onClick={() => hasOutput && setExpanded(!expanded)}
          className={`inline-flex items-center gap-1 ${hasOutput ? "hover:text-muted-foreground cursor-pointer" : ""}`}
        >
          <Code className="h-3 w-3" />
          <span>{label}</span>
          {hasOutput && <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />}
        </button>
      )}

      {expanded && hasOutput && (
        <div className="mt-1.5 pl-0.5 space-y-1">
          {outputs.map((o, i) => (
            <div key={i}>
              {o.stdout && (
                <pre className="text-[11px] text-muted-foreground/60 bg-muted/30 rounded px-2 py-1 overflow-x-auto max-h-40 whitespace-pre-wrap">
                  {o.stdout}
                </pre>
              )}
              {o.stderr && (
                <pre className="text-[11px] text-amber-500/60 bg-muted/30 rounded px-2 py-1 overflow-x-auto max-h-20 whitespace-pre-wrap">
                  {o.stderr}
                </pre>
              )}
              {o.error && (
                <pre className="text-[11px] text-red-500/60 bg-muted/30 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap">
                  {o.error}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Inline images from sandbox tools (code_execute, file_download) ---
function SandboxImages({ invocations, onLightbox }: { invocations: ToolInvocation[]; onLightbox: (src: string) => void }) {
  const allImages: string[] = [];
  for (const inv of invocations) {
    if (
      (inv.toolName === "code_execute" || inv.toolName === "file_download") &&
      inv.state === "output-available" &&
      inv.result
    ) {
      const r = inv.result as SandboxToolResult;
      if (r.images) allImages.push(...r.images);
    }
  }
  if (allImages.length === 0) return null;

  return (
    <div className="my-2 flex flex-wrap gap-2">
      {allImages.map((base64, i) => (
        <button
          key={i}
          onClick={() => onLightbox(`data:image/png;base64,${base64}`)}
          className="block overflow-hidden rounded-lg border border-border/30 hover:border-border transition-colors"
        >
          <img
            src={`data:image/png;base64,${base64}`}
            alt={`Code output ${i + 1}`}
            className="max-w-full sm:max-w-[400px] max-h-[300px] object-contain"
          />
        </button>
      ))}
    </div>
  );
}

function VersionNav({ current, total, onChange }: { current: number; total: number; onChange: (i: number) => void }) {
  return (
    <div className="inline-flex items-center">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 0}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs tabular-nums text-muted-foreground/60 select-none">
        {current + 1}&thinsp;/&thinsp;{total}
      </span>
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total - 1}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:text-foreground hover:bg-muted disabled:opacity-20 disabled:pointer-events-none"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function MessageBubble({
  role, content, isStreaming, model, images, files, toolInvocations,
  isLast, onRegenerate, onEdit, onOpenArtifact, versionCount, currentVersion, onVersionChange,
}: MessageBubbleProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { copied, copy } = useCopy();

  if (role === "system") return null;
  const hasVersions = versionCount !== undefined && versionCount > 1;

  // ── User message — right-aligned bubble ──
  if (role === "user") {
    const hasImages = images && images.length > 0;
    const hasFiles = files && files.length > 0;

    // Strip <attached_file ...> blocks from display — they're metadata for the AI, not for the user
    const displayContent = content.replace(/<attached_file\s[^>]*>[\s\S]*?<\/attached_file>\s*/g, "").replace(/<attached_file\s[^>]*\/>\s*/g, "").trim();

    return (
      <div className="group flex justify-end px-4 py-1">
        <div className="max-w-[80%] lg:max-w-[65%] flex flex-col items-end">
          {hasFiles && (
            <div className="flex flex-wrap justify-end gap-1.5 mb-1.5">
              {files.map((file, i) => {
                const FIcon = getFileIcon(file.type, file.name);
                return (
                  <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-muted/20 px-2 py-1 text-xs hover:bg-muted/40 transition-colors">
                    <FIcon className="h-3 w-3 text-muted-foreground/40" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    {file.size && <span className="text-muted-foreground/30 text-[11px]">{formatFileSize(file.size)}</span>}
                  </a>
                );
              })}
            </div>
          )}

          {hasImages && (
            <div className="flex flex-wrap justify-end gap-1.5 mb-1.5">
              {images.map((url, i) => (
                <button key={i} onClick={() => setLightboxSrc(url)} className="block overflow-hidden rounded-lg">
                  <img src={url} alt="" className="max-w-[240px] max-h-[180px] object-cover rounded-lg" />
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl rounded-br-sm bg-primary/[0.08] dark:bg-primary/[0.12] px-3.5 py-2">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
          </div>
          {/* Actions */}
          <div className={`flex justify-end items-center gap-1 mt-0.5 ${hasVersions ? "min-h-[1.625rem]" : "h-5 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
            {hasVersions && onVersionChange && currentVersion !== undefined && (
              <VersionNav current={currentVersion} total={versionCount!} onChange={onVersionChange} />
            )}
            <div className={`flex items-center gap-1 ${hasVersions ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
              {onEdit && !isStreaming && (
                <button onClick={() => onEdit(displayContent)} className="p-0.5 rounded text-muted-foreground/25 hover:text-muted-foreground hover:bg-muted/50" title="Edit"><Pencil className="h-3 w-3" /></button>
              )}
              <button onClick={() => copy(displayContent)} className="p-0.5 rounded text-muted-foreground/25 hover:text-muted-foreground hover:bg-muted/50" title="Copy">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>

        {lightboxSrc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setLightboxSrc(null)}>
            <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
          </div>
        )}
      </div>
    );
  }

  // ── Assistant message — left-aligned, no icon ──
  const modelLabel = model ? model.split("/").pop() : null;
  const hasSearches = toolInvocations && toolInvocations.some((t) => t.toolName === "web_search");
  const searchesDone = hasSearches && toolInvocations!.every(
    (t) => t.toolName !== "web_search" || t.state === "output-available" || t.state === "output-error"
  );
  const hasFetches = toolInvocations && toolInvocations.some((t) => t.toolName === "fetch_page");
  const activeFetch = hasFetches && toolInvocations!.find(
    (t) => t.toolName === "fetch_page" && t.state !== "output-available" && t.state !== "output-error"
  );
  const hasCodeExec = toolInvocations && toolInvocations.some((t) => SANDBOX_TOOL_NAMES.has(t.toolName));

  // Extract <artifact> tags from content
  const { cleanContent: displayContent, artifacts } = extractArtifacts(content);

  return (
    <div className="group px-4 py-1">
      <div className="mx-auto max-w-3xl">
        {hasSearches && <SearchStatus invocations={toolInvocations!} />}
        {hasCodeExec && <SandboxStatus invocations={toolInvocations!} />}

        {activeFetch && (
          <div className="mb-2 text-xs text-muted-foreground/50">
            <span>Reading {(activeFetch.args?.url as string) ? getDomain(activeFetch.args.url as string) : "page"}...</span>
          </div>
        )}

        {isStreaming && displayContent.length === 0 && !hasSearches && !hasCodeExec ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
          </div>
        ) : displayContent.length > 0 ? (
          <MarkdownRenderer content={displayContent} onOpenArtifact={onOpenArtifact} />
        ) : null}

        {/* Inline images from sandbox tools */}
        {hasCodeExec && <SandboxImages invocations={toolInvocations!} onLightbox={setLightboxSrc} />}

        {/* Artifact preview cards */}
        {artifacts.length > 0 && onOpenArtifact && (
          <div className="flex flex-wrap gap-2 my-2">
            {artifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => onOpenArtifact(artifact.code, artifact.type === "image/svg+xml" ? "svg" : "html")}
                className="group/art flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition-all hover:bg-muted/50 hover:border-border w-full max-w-xs"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover/art:bg-primary/10 group-hover/art:text-primary transition-colors">
                  {isStreaming ? (
                    <span className="h-3 w-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{artifact.title}</p>
                  <p className="text-[11px] text-muted-foreground/50">
                    {isStreaming ? "Generating..." : "Click to preview"}
                  </p>
                </div>
                <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover/art:text-muted-foreground transition-colors" />
              </button>
            ))}
          </div>
        )}

        {/* Sources inline after content */}
        {searchesDone && content.length > 0 && !isStreaming && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(() => {
              const sources: SearchResult[] = [];
              for (const s of toolInvocations!) {
                if (s.toolName === "web_search" && s.state === "output-available" && s.result) {
                  const r = s.result as SearchToolResult;
                  if (r.results) for (const src of r.results) { if (!sources.some((x) => x.url === src.url)) sources.push(src); }
                }
              }
              return sources.slice(0, 5).map((src, i) => (
                <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-border/40 px-1.5 py-0.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors">
                  <img src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`} alt="" className="h-3 w-3 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="max-w-[100px] truncate">{src.title || getDomain(src.url)}</span>
                </a>
              ));
            })()}
          </div>
        )}

        {/* Actions */}
        {!isStreaming && content.length > 0 && (
          <div className={`flex items-center gap-1 mt-1 ${hasVersions ? "min-h-[1.625rem]" : "h-5 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
            {hasVersions && onVersionChange && currentVersion !== undefined && (
              <VersionNav current={currentVersion} total={versionCount!} onChange={onVersionChange} />
            )}
            <div className={`flex items-center gap-0.5 ${hasVersions ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
              <button onClick={() => copy(content)} className="p-0.5 rounded text-muted-foreground/25 hover:text-muted-foreground hover:bg-muted/50" title="Copy">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
              {isLast && onRegenerate && (
                <button onClick={onRegenerate} className="p-0.5 rounded text-muted-foreground/25 hover:text-muted-foreground hover:bg-muted/50" title="Regenerate">
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
            {modelLabel && <span className="text-[10px] text-muted-foreground/20 ml-auto">{modelLabel}</span>}
          </div>
        )}
      </div>

      {lightboxSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}

export default memo(MessageBubble);
