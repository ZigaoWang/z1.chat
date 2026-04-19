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
  FileText,
  FileCode,
  FileSpreadsheet,
  File,
} from "lucide-react";
import MarkdownRenderer from "./markdown-renderer";
import { extractArtifacts } from "./artifact-preview";
import type { MessageSegment } from "./chat-messages";

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
  onOpenArtifactById?: (id: string) => void;
  interrupted?: boolean;
  segments?: MessageSegment[];
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

  const label = isSearching
    ? (activeQuery ? `Searching "${activeQuery}"` : "Searching the web")
    : `Found ${sources.length} source${sources.length !== 1 ? "s" : ""}`;

  return (
    <div className="mt-3">
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <button
          onClick={() => sources.length > 0 && setExpanded(!expanded)}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${sources.length > 0 ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}
        >
          {isSearching ? (
            <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" />
          ) : (
            <Check className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          )}
          <span className="font-medium text-foreground/70 truncate">{label}</span>
          {!isSearching && sources.length > 0 && (
            <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground/30 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
          )}
        </button>
        {isSearching && (
          <div className="h-px bg-muted overflow-hidden">
            <div className="h-full w-1/3 bg-primary/30 animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        )}
        {expanded && sources.length > 0 && (
          <div className="border-t border-border/30 px-3 py-2 space-y-0.5">
            {sources.map((src, i) => (
              <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 py-1 rounded px-1 -mx-1 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors">
                <img src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`} alt="" className="h-3.5 w-3.5 rounded-sm shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span className="truncate">{src.title || getDomain(src.url)}</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40" />
              </a>
            ))}
          </div>
        )}
      </div>
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
const ARTIFACT_TOOL_NAMES = new Set(["create_artifact", "update_artifact", "edit_artifact"]);

function getToolLabel(toolName: string, isRunning: boolean): string {
  if (isRunning) {
    switch (toolName) {
      case "shell_exec": return "Running command";
      case "file_upload": return "Uploading file";
      case "file_download": return "Reading file";
      default: return "Running code";
    }
  }
  switch (toolName) {
    case "shell_exec": return "Ran command";
    case "file_upload": return "Uploaded file";
    case "file_download": return "Read file";
    default: return "Ran code";
  }
}

function getLanguageLabel(args: Record<string, unknown>): string {
  const lang = args.language as string | undefined;
  if (!lang) return "";
  const labels: Record<string, string> = {
    python: "Python", javascript: "JavaScript", typescript: "TypeScript",
    bash: "Bash", sh: "Shell", ruby: "Ruby", go: "Go", rust: "Rust",
    java: "Java", cpp: "C++", c: "C", r: "R",
  };
  return labels[lang] || lang;
}

function getArtifactTypeLabel(type: string): string {
  switch (type) {
    case "html": return "Website";
    case "svg": return "SVG";
    case "mermaid": return "Diagram";
    case "code": return "Code";
    case "document": return "Document";
    default: return "Artifact";
  }
}

// --- Sandbox execution cards ---
function SandboxStatus({ invocations, onLightbox }: { invocations: ToolInvocation[]; onLightbox: (src: string) => void }) {
  const executions = invocations.filter((t) => SANDBOX_TOOL_NAMES.has(t.toolName));
  if (executions.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {executions.map((exec) => (
        <SandboxCard key={exec.toolCallId} invocation={exec} onLightbox={onLightbox} />
      ))}
    </div>
  );
}

function SandboxCard({ invocation: exec, onLightbox }: { invocation: ToolInvocation; onLightbox: (src: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = exec.state !== "output-available" && exec.state !== "output-error";
  const result = !isRunning ? exec.result as SandboxToolResult : null;
  const hasError = !!result?.error || exec.state === "output-error";
  const hasOutput = !!(result?.stdout || result?.stderr || result?.error);
  const langLabel = getLanguageLabel(exec.args);
  const label = getToolLabel(exec.toolName, isRunning);
  const command = exec.args.command as string | undefined;
  const codeSnippet = exec.args.code as string | undefined;
  const preview = command
    ? (command.length > 60 ? command.slice(0, 60) + "..." : command)
    : codeSnippet
    ? (codeSnippet.split("\n")[0].slice(0, 60) + (codeSnippet.includes("\n") ? "..." : ""))
    : null;

  // Images from this specific execution
  const execImages: string[] = [];
  if (!isRunning && result) {
    const r = result as SandboxToolResult;
    if (r.images) execImages.push(...r.images);
  }

  return (
    <div className="rounded-lg border border-border/40 overflow-hidden">
      <button
        onClick={() => hasOutput && setExpanded(!expanded)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${hasOutput ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}
      >
        {isRunning ? (
          <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" />
        ) : hasError ? (
          <X className="h-3 w-3 shrink-0 text-destructive/60" />
        ) : (
          <Check className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        )}
        <span className="font-medium text-foreground/70">{label}</span>
        {langLabel && <span className="rounded bg-muted/60 px-1 py-px text-[10px] text-muted-foreground/50">{langLabel}</span>}
        {!isRunning && hasOutput && (
          <ChevronDown className={`h-3 w-3 shrink-0 text-muted-foreground/30 ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>
      {/* Running: show code scrolling down (last lines visible) */}
      {isRunning && codeSnippet && (
        <>
          <div className="h-px bg-muted overflow-hidden"><div className="h-full w-1/3 bg-primary/30 animate-[shimmer_1.5s_ease-in-out_infinite]" /></div>
          <div className="border-t border-border/20 px-3 py-2 max-h-32 overflow-hidden relative flex flex-col justify-end">
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-card to-transparent z-10" />
            <pre className="text-[11px] text-muted-foreground/40 font-mono whitespace-pre-wrap">{codeSnippet}</pre>
          </div>
        </>
      )}
      {isRunning && !codeSnippet && (
        <div className="h-px bg-muted overflow-hidden"><div className="h-full w-1/3 bg-primary/30 animate-[shimmer_1.5s_ease-in-out_infinite]" /></div>
      )}
      {/* Completed: text output (expandable) */}
      {(expanded || (!isRunning && hasError)) && hasOutput && (
        <div className="border-t border-border/30 px-3 py-2 space-y-2">
          {result?.stdout && (
            <pre className="text-[11px] text-muted-foreground/60 bg-muted/20 rounded px-2.5 py-1.5 overflow-x-auto max-h-48 whitespace-pre-wrap font-mono">{result.stdout}</pre>
          )}
          {result?.stderr && (
            <pre className="text-[11px] text-amber-600/60 dark:text-amber-400/60 bg-amber-500/5 rounded px-2.5 py-1.5 overflow-x-auto max-h-24 whitespace-pre-wrap font-mono">{result.stderr}</pre>
          )}
          {result?.error && (
            <pre className="text-[11px] text-red-600/60 dark:text-red-400/60 bg-red-500/5 rounded px-2.5 py-1.5 overflow-x-auto whitespace-pre-wrap font-mono">{result.error}</pre>
          )}
        </div>
      )}
      {/* Images always visible — never hidden behind expand */}
      {execImages.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-2">
          {execImages.map((base64, i) => {
            const isJpeg = base64.startsWith("/9j/");
            const src = `data:${isJpeg ? "image/jpeg" : "image/png"};base64,${base64}`;
            return (
              <button key={i} onClick={(e) => { e.stopPropagation(); onLightbox(src); }} className="block overflow-hidden rounded-lg border border-border/30 hover:border-border transition-colors">
                <img src={src} alt={`Output ${i + 1}`} className="max-w-full sm:max-w-[400px] max-h-[300px] object-contain" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Artifact tool cards (create, update, edit) ---
function ArtifactToolCards({ invocations, onOpenArtifactById, parentStreaming }: { invocations: ToolInvocation[]; onOpenArtifactById: (id: string) => void; parentStreaming?: boolean }) {
  const artifactTools = invocations.filter((t) => ARTIFACT_TOOL_NAMES.has(t.toolName));
  if (artifactTools.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {artifactTools.map((t) => {
        const isComplete = t.state === "output-available";
        const isToolStreaming = t.state === "input-streaming" || t.state === "input-available";
        const isRunning = isToolStreaming && !!parentStreaming;
        const wasStopped = isToolStreaming && !parentStreaming;
        if (!isComplete && !isRunning && !wasStopped) return null;

        const result = isComplete ? (t.result as { id?: string; type?: string; title?: string; version?: number; error?: string }) : null;
        if (result?.error) return null;

        const args = t.args as { title?: string; type?: string; artifactId?: string };
        const artifactId = result?.id || args.artifactId;
        const displayTitle = result?.title || args.title || "Untitled";
        const displayType = result?.type || args.type || "document";
        const typeLabel = getArtifactTypeLabel(displayType);
        const actionLabel = isRunning
          ? (t.toolName === "create_artifact" ? "Creating" : t.toolName === "update_artifact" ? "Rewriting" : "Editing")
          : wasStopped
          ? "Stopped"
          : (t.toolName === "create_artifact" ? typeLabel : t.toolName === "update_artifact" ? "Rewrote" : "Edited");
        const version = result?.version;

        return (
          <button
            key={t.toolCallId}
            onClick={() => artifactId && onOpenArtifactById(artifactId)}
            disabled={!artifactId}
            className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30 disabled:cursor-default"
          >
            {isRunning ? (
              <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" />
            ) : (
              <Eye className="h-3 w-3 shrink-0 text-muted-foreground/40" />
            )}
            <span className="font-medium text-foreground/70 truncate">{displayTitle}</span>
            <span className="text-muted-foreground/40 shrink-0">{isRunning ? `${actionLabel}...` : actionLabel}</span>
            {version && version > 1 && <span className="text-[10px] text-muted-foreground/30 tabular-nums">v{version}</span>}
          </button>
        );
      })}
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
  isLast, onRegenerate, onEdit, onOpenArtifact, onOpenArtifactById, interrupted, segments, versionCount, currentVersion, onVersionChange,
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
      <div className="group flex justify-end px-4 py-1.5">
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

          <div className="rounded-2xl rounded-br-sm bg-primary/[0.06] dark:bg-primary/[0.10] px-3.5 py-2.5">
            <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{displayContent}</p>
          </div>
          {/* Actions */}
          <div className={`flex justify-end items-center gap-1 mt-0.5 ${hasVersions ? "min-h-[1.625rem]" : "h-5 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
            {hasVersions && onVersionChange && currentVersion !== undefined && (
              <VersionNav current={currentVersion} total={versionCount!} onChange={onVersionChange} />
            )}
            <div className={`flex items-center gap-1 ${hasVersions ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
              {onEdit && !isStreaming && (
                <button onClick={() => onEdit(displayContent)} className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50" title="Edit"><Pencil className="h-3 w-3" /></button>
              )}
              <button onClick={() => copy(displayContent)} className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50" title="Copy">
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
  const { cleanContent: displayContent, artifacts } = extractArtifacts(content);

  // Helper to render a single tool invocation inline
  const renderToolInline = (t: ToolInvocation) => {
    if (t.toolName === "web_search") return <SearchStatus key={t.toolCallId} invocations={[t]} />;
    if (t.toolName === "fetch_page") {
      const isActive = t.state !== "output-available" && t.state !== "output-error";
      const url = t.args?.url as string | undefined;
      const domain = url ? getDomain(url) : "page";
      return (
        <div key={t.toolCallId} className="mt-3 rounded-lg border border-border/40 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-xs">
            {isActive ? <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" /> : <Check className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
            <span className="font-medium text-foreground/70 truncate">{isActive ? `Reading ${domain}` : `Read ${domain}`}</span>
          </div>
          {isActive && <div className="h-px bg-muted overflow-hidden"><div className="h-full w-1/3 bg-primary/30 animate-[shimmer_1.5s_ease-in-out_infinite]" /></div>}
        </div>
      );
    }
    if (SANDBOX_TOOL_NAMES.has(t.toolName)) return <div key={t.toolCallId} className="mt-3"><SandboxCard invocation={t} onLightbox={setLightboxSrc} /></div>;
    if (ARTIFACT_TOOL_NAMES.has(t.toolName)) return <div key={t.toolCallId} className="mt-3"><ArtifactToolCards invocations={[t]} onOpenArtifactById={onOpenArtifactById!} parentStreaming={isStreaming} /></div>;
    return null;
  };

  // Use ordered segments when available (live streaming), fall back to old layout (restored)
  const hasSegments = segments && segments.length > 0;
  const hasAnyContent = displayContent.length > 0 || (toolInvocations && toolInvocations.length > 0) || (segments && segments.length > 0);

  return (
    <div className="group px-4 py-1.5">
      <div className="mx-auto max-w-3xl">
        {/* Streaming placeholder — only when nothing to show yet */}
        {isStreaming && !hasAnyContent && (
          <div className="flex items-center gap-1.5 py-1">
            <div className="flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
            </div>
          </div>
        )}

        {/* Ordered segments — renders text and tools in chronological order */}
        {hasSegments ? (
          <>
            {segments!.map((seg, i) => {
              if (seg.type === "text") {
                const { cleanContent: segClean, artifacts: segArtifacts } = extractArtifacts(seg.content);
                return (
                  <div key={i}>
                    {segClean && <MarkdownRenderer content={segClean} onOpenArtifact={onOpenArtifact} />}
                    {segArtifacts.length > 0 && onOpenArtifact && (
                      <div className="flex flex-col gap-1.5 mt-3">
                        {segArtifacts.map((art) => (
                          <button key={art.id} onClick={() => onOpenArtifact(art.code, art.type === "image/svg+xml" ? "svg" : "html")}
                            className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30">
                            <Eye className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                            <span className="font-medium text-foreground/70 truncate">{art.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return renderToolInline(seg.invocation);
            })}
            {/* Trailing dots — shows the AI is still working after tools/text */}
            {isStreaming && (
              <div className="flex items-center gap-1 mt-4 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/10 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
              </div>
            )}
          </>
        ) : displayContent.length > 0 || (toolInvocations && toolInvocations.length > 0) ? (
          <>
            {/* Fallback: old layout for restored messages */}
            {displayContent.length > 0 && <MarkdownRenderer content={displayContent} onOpenArtifact={onOpenArtifact} />}

            {toolInvocations && toolInvocations.filter(t => t.toolName === "web_search").length > 0 && (
              <SearchStatus invocations={toolInvocations} />
            )}
            {toolInvocations && toolInvocations.filter(t => t.toolName === "fetch_page").map(f => {
              const isActive = f.state !== "output-available" && f.state !== "output-error";
              const domain = (f.args?.url as string) ? getDomain(f.args.url as string) : "page";
              return (
                <div key={f.toolCallId} className="mt-3 rounded-lg border border-border/40 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 text-xs">
                    {isActive ? <span className="h-3 w-3 shrink-0 rounded-full border-[1.5px] border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" /> : <Check className="h-3 w-3 shrink-0 text-muted-foreground/40" />}
                    <span className="font-medium text-foreground/70 truncate">{isActive ? `Reading ${domain}` : `Read ${domain}`}</span>
                  </div>
                </div>
              );
            })}
            {toolInvocations && toolInvocations.some(t => SANDBOX_TOOL_NAMES.has(t.toolName)) && (
              <SandboxStatus invocations={toolInvocations} onLightbox={setLightboxSrc} />
            )}
            {artifacts.length > 0 && onOpenArtifact && (
              <div className="flex flex-col gap-1.5 mt-3">
                {artifacts.map((art) => (
                  <button key={art.id} onClick={() => onOpenArtifact(art.code, art.type === "image/svg+xml" ? "svg" : "html")}
                    className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/30">
                    <Eye className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    <span className="font-medium text-foreground/70 truncate">{art.title}</span>
                  </button>
                ))}
              </div>
            )}
            {toolInvocations && toolInvocations.some(t => ARTIFACT_TOOL_NAMES.has(t.toolName)) && onOpenArtifactById && (
              <ArtifactToolCards invocations={toolInvocations} onOpenArtifactById={onOpenArtifactById} parentStreaming={isStreaming} />
            )}
          </>
        ) : null}

        {/* Interrupted notice */}
        {!isStreaming && interrupted && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground/50">
              Stopped generating
            </span>
          </div>
        )}

        {/* Sources inline after content */}
        {toolInvocations && !isStreaming && (() => {
          const searches = toolInvocations.filter(t => t.toolName === "web_search" && t.state === "output-available" && t.result);
          if (searches.length === 0 || content.length === 0) return null;
          const sources: SearchResult[] = [];
          for (const s of searches) {
            const r = s.result as SearchToolResult;
            if (r.results) for (const src of r.results) { if (!sources.some(x => x.url === src.url)) sources.push(src); }
          }
          if (sources.length === 0) return null;
          return (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sources.slice(0, 5).map((src, i) => (
                <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded border border-border/40 px-1.5 py-0.5 text-[11px] text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors">
                  <img src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=32`} alt="" className="h-3 w-3 rounded-sm"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="max-w-[100px] truncate">{src.title || getDomain(src.url)}</span>
                </a>
              ))}
            </div>
          );
        })()}

        {/* Actions */}
        {!isStreaming && content.length > 0 && (
          <div className={`flex items-center gap-1 mt-1 ${hasVersions ? "min-h-[1.625rem]" : "h-5 opacity-0 group-hover:opacity-100 transition-opacity"}`}>
            {hasVersions && onVersionChange && currentVersion !== undefined && (
              <VersionNav current={currentVersion} total={versionCount!} onChange={onVersionChange} />
            )}
            <div className={`flex items-center gap-0.5 ${hasVersions ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
              <button onClick={() => copy(content)} className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50" title="Copy">
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
              {isLast && onRegenerate && (
                <button onClick={onRegenerate} className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted/50" title="Regenerate">
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
            {modelLabel && <span className="text-[10px] text-muted-foreground/30 ml-auto">{modelLabel}</span>}
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
