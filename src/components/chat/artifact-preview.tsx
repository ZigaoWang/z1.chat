"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Code2, Eye, ExternalLink, Copy, Check, RefreshCw, Download, Pencil, MessageSquare } from "lucide-react";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import MarkdownRenderer from "./markdown-renderer";

import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("plaintext", plaintext);

// --- Detection (legacy fallback) ---

export function isArtifact(language: string, code: string): boolean {
  const lang = language.toLowerCase().trim();
  const trimmed = code.trimStart();
  if (lang === "html") {
    if (/^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed)) return true;
    if (code.length > 500 && (/<body/i.test(code) || /<head/i.test(code) || /<style/i.test(code))) return true;
  }
  if (lang === "svg" && /^<svg/i.test(trimmed)) return true;
  return false;
}

// --- Artifact tag extraction (legacy) ---

export interface ExtractedArtifact {
  id: string;
  type: string;
  title: string;
  code: string;
}

const ARTIFACT_RE = /<artifact\s+[^>]*?type="([^"]*)"[^>]*?(?:title="([^"]*)")?[^>]*?>([\s\S]*?)<\/artifact>/g;
const ARTIFACT_TITLE_RE = /title="([^"]*)"/;

export function extractArtifacts(content: string): { cleanContent: string; artifacts: ExtractedArtifact[] } {
  const artifacts: ExtractedArtifact[] = [];
  let cleanContent = content;

  const re = new RegExp(ARTIFACT_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(content)) !== null) {
    const fullTag = match[0];
    const type = match[1];
    const code = match[3].trim();
    const titleMatch = fullTag.match(ARTIFACT_TITLE_RE);
    const title = titleMatch?.[1] || "Artifact";
    const idMatch = fullTag.match(/id="([^"]*)"/);
    const id = idMatch?.[1] || `artifact-${artifacts.length}`;
    if (type === "text/html" || type === "image/svg+xml") {
      artifacts.push({ id, type, title, code });
    }
  }

  cleanContent = cleanContent.replace(re, (fullMatch) => {
    const typeMatch = fullMatch.match(/type="([^"]*)"/);
    const type = typeMatch?.[1] || "";
    if (type === "text/html" || type === "image/svg+xml") return "";
    return fullMatch;
  });

  const partialArtifactRe = /<artifact\s+[^>]*?type="(text\/html|image\/svg\+xml)"[^>]*?>([\s\S]*)$/;
  const partialMatch = cleanContent.match(partialArtifactRe);
  if (partialMatch) {
    const type = partialMatch[1];
    const code = partialMatch[2].trim();
    const tagStart = cleanContent.match(/<artifact\s+[^>]*?type="(text\/html|image\/svg\+xml)"/);
    if (tagStart) {
      const fullTagPortion = cleanContent.slice(cleanContent.indexOf(tagStart[0]));
      const titleMatch = fullTagPortion.match(ARTIFACT_TITLE_RE);
      const title = titleMatch?.[1] || "Generating...";
      const idMatch = fullTagPortion.match(/id="([^"]*)"/);
      const id = idMatch?.[1] || `partial-artifact-${artifacts.length}`;
      if (code.length > 0 || type) {
        artifacts.push({ id, type, title, code });
      }
      cleanContent = cleanContent.slice(0, cleanContent.indexOf(tagStart[0])).trim();
    }
  }

  const codeBlockRe = /```html\n([\s\S]*?)```/g;
  const codeBlockRe2 = new RegExp(codeBlockRe.source, "g");
  let codeMatch: RegExpExecArray | null;

  while ((codeMatch = codeBlockRe2.exec(cleanContent)) !== null) {
    const code = codeMatch[1].trim();
    if (isArtifact("html", code)) {
      artifacts.push({
        id: `codeblock-${artifacts.length}`,
        type: "text/html",
        title: extractHtmlTitle(code) || "Website",
        code,
      });
    }
  }

  cleanContent = cleanContent.replace(codeBlockRe, (fullMatch, innerCode: string) => {
    if (isArtifact("html", innerCode.trim())) return "";
    return fullMatch;
  });

  const partialCodeBlockRe = /```html\n([\s\S]+)$/;
  const partialCodeMatch = cleanContent.match(partialCodeBlockRe);
  if (partialCodeMatch) {
    const code = partialCodeMatch[1].trim();
    if (code.length > 50 && isArtifact("html", code)) {
      artifacts.push({
        id: `partial-codeblock-${artifacts.length}`,
        type: "text/html",
        title: extractHtmlTitle(code) || "Generating...",
        code,
      });
      cleanContent = cleanContent.slice(0, cleanContent.lastIndexOf("```html")).trim();
    }
  }

  return { cleanContent: cleanContent.trim(), artifacts };
}

function extractHtmlTitle(code: string): string | null {
  const m = code.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

// --- Helpers ---

function wrapForPreview(code: string, language: string): string {
  if (language === "svg" || language === "image/svg+xml") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}</style></head><body>${code}</body></html>`;
  }
  const trimmed = code.trimStart();
  if (/^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed)) return code;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"><\/script><style>body{margin:0}</style></head><body>${code}</body></html>`;
}

function getDownloadExtension(type: string, language?: string | null): string {
  switch (type) {
    case "document": return ".md";
    case "html": return ".html";
    case "svg": return ".svg";
    case "mermaid": return ".mmd";
    case "code": {
      const extMap: Record<string, string> = {
        python: ".py", typescript: ".ts", javascript: ".js", java: ".java",
        go: ".go", rust: ".rs", cpp: ".cpp", c: ".c", ruby: ".rb",
        php: ".php", swift: ".swift", kotlin: ".kt", css: ".css",
      };
      return extMap[language || ""] || ".txt";
    }
    default: return ".txt";
  }
}

function getHighlightLang(type: string, language?: string | null): string {
  if (type === "html") return "xml";
  if (type === "svg") return "xml";
  if (type === "mermaid") return "plaintext";
  return language || "plaintext";
}

function highlightCode(code: string, lang: string): string {
  try {
    // Check if language is registered, fall back to plaintext
    const safeLang = hljs.getLanguage(lang) ? lang : "plaintext";
    const result = hljs.highlight(code, { language: safeLang, ignoreIllegals: true });
    return DOMPurify.sanitize(result.value, { USE_PROFILES: { html: true } });
  } catch {
    return DOMPurify.sanitize(code, { USE_PROFILES: { html: true } });
  }
}

// --- Mermaid renderer ---

function MermaidPreview({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
        if (!cancelled) setSvg(svg);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-sm text-red-500/60">
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center min-h-full p-8"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(svg) }}
    />
  );
}

// --- Text selection toolbar ---

function SelectionToolbar({
  onSendToChat,
  onEditRequest,
}: {
  onSendToChat: (text: string) => void;
  onEditRequest: (selectedText: string, instruction: string) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [instruction, setInstruction] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        // Delay hiding to allow button clicks
        setTimeout(() => {
          const sel2 = window.getSelection();
          if (!sel2 || sel2.isCollapsed) {
            setPos(null);
            setShowInput(false);
          }
        }, 200);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(sel.toString().trim());
      setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    };

    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, []);

  useEffect(() => {
    if (showInput && inputRef.current) inputRef.current.focus();
  }, [showInput]);

  if (!pos || !selectedText) return null;

  return (
    <div
      className="fixed z-50 -translate-x-1/2 -translate-y-full animate-fade-in"
      style={{ left: pos.x, top: pos.y }}
    >
      {showInput ? (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <input
            ref={inputRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && instruction.trim()) {
                onEditRequest(selectedText, instruction.trim());
                setShowInput(false);
                setInstruction("");
                setPos(null);
                window.getSelection()?.removeAllRanges();
              }
              if (e.key === "Escape") { setShowInput(false); setInstruction(""); }
            }}
            placeholder="Describe the change..."
            className="w-48 rounded-md bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/40"
          />
        </div>
      ) : (
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 shadow-lg">
          <button
            onMouseDown={(e) => { e.preventDefault(); setShowInput(true); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onSendToChat(selectedText);
              setPos(null);
              window.getSelection()?.removeAllRanges();
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            Quote
          </button>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export interface ArtifactData {
  id?: string;
  type: string; // document | code | html | svg | mermaid
  title: string;
  content: string;
  language?: string | null;
  version?: number;
}

interface ArtifactPreviewProps {
  artifact: ArtifactData;
  streaming?: boolean;
  onClose: () => void;
  onContentChange?: (content: string) => void;
  onSendToChat?: (text: string) => void;
  onEditRequest?: (selectedText: string, instruction: string) => void;
  onUndo?: () => void;
  onLoadVersion?: (version: number) => void;
}

export default function ArtifactPreview({
  artifact,
  streaming,
  onClose,
  onContentChange,
  onSendToChat,
  onEditRequest,
  onUndo,
  onLoadVersion,
}: ArtifactPreviewProps) {
  const { type, title, content, language, version } = artifact;
  const [tab, setTab] = useState<"preview" | "code">(streaming ? "code" : "preview");
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync editContent when content changes externally (AI updates)
  useEffect(() => { setEditContent(content); }, [content]);

  // Highlighted code for code tab
  const [highlightedCode, setHighlightedCode] = useState("");
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hLang = getHighlightLang(type, language);

  useEffect(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    if (!streaming) {
      setHighlightedCode(highlightCode(content, hLang));
      return;
    }
    highlightTimer.current = setTimeout(() => {
      setHighlightedCode(highlightCode(content, hLang));
    }, 300);
    return () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); };
  }, [content, streaming, hLang]);

  // Auto-scroll while streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [highlightedCode, streaming]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  // Auto-switch to preview when streaming ends
  const prevStreaming = useRef(streaming);
  useEffect(() => {
    if (prevStreaming.current && !streaming) setTab("preview");
    prevStreaming.current = streaming;
  }, [streaming]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleDownload = useCallback(() => {
    const ext = getDownloadExtension(type, language);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, type, language, title]);

  const handleOpenNew = useCallback(() => {
    if (type === "html" || type === "svg") {
      const html = wrapForPreview(content, type);
      const w = window.open("", "_blank");
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    }
  }, [content, type]);

  // Debounced save for user editing
  const handleEditChange = useCallback((newContent: string) => {
    setEditContent(newContent);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      onContentChange?.(newContent);
    }, 1000);
  }, [onContentChange]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Preview content by type
  const renderPreview = () => {
    if (streaming) {
      // Content not ready yet (tool still executing)
      if (!content) {
        return (
          <div className="flex-1 flex items-center justify-center bg-card">
            <div className="text-center">
              <div className="flex justify-center gap-1 mb-3">
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_infinite]" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.2s_infinite]" />
                <span className="h-2 w-2 rounded-full bg-primary/40 animate-[bounce_1.4s_ease-in-out_0.4s_infinite]" />
              </div>
              <p className="text-sm text-muted-foreground/50">Generating {title}...</p>
            </div>
          </div>
        );
      }
      // Content is available (legacy streaming HTML/SVG)
      return (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto min-w-0 bg-card">
          <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm border-b border-border/20">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span>Generating...</span>
          </div>
          <pre className="p-4 overflow-x-auto">
            <code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>
        </div>
      );
    }

    switch (type) {
      case "html":
        return (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={wrapForPreview(content, "html")}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="flex-1 w-full bg-white"
            title="HTML preview"
          />
        );
      case "svg":
        return (
          <iframe
            key={iframeKey}
            srcDoc={wrapForPreview(content, "svg")}
            sandbox="allow-scripts"
            className="flex-1 w-full bg-white"
            title="SVG preview"
          />
        );
      case "document":
        return (
          <div className="flex-1 overflow-auto p-6 max-w-3xl mx-auto">
            {onSendToChat && onEditRequest && (
              <SelectionToolbar onSendToChat={onSendToChat} onEditRequest={onEditRequest} />
            )}
            <MarkdownRenderer content={content} />
          </div>
        );
      case "mermaid":
        return (
          <div className="flex-1 overflow-auto bg-white dark:bg-card">
            <MermaidPreview code={content} />
          </div>
        );
      case "code":
      default:
        return (
          <div className="flex-1 overflow-auto">
            {onSendToChat && onEditRequest && (
              <SelectionToolbar onSendToChat={onSendToChat} onEditRequest={onEditRequest} />
            )}
            <pre className="p-4 overflow-x-auto">
              <code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
            </pre>
          </div>
        );
    }
  };

  const renderCodeView = () => (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto min-w-0">
      <pre className="p-4 overflow-x-auto">
        <code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  );

  const renderEditMode = () => (
    <div className="flex-1 flex flex-col min-h-0">
      <textarea
        value={editContent}
        onChange={(e) => handleEditChange(e.target.value)}
        className="flex-1 w-full resize-none bg-transparent p-4 text-[13px] leading-relaxed font-mono outline-none"
        spellCheck={type === "document"}
      />
    </div>
  );

  const canPreviewInNewTab = type === "html" || type === "svg";

  const renderContent = () => {
    if (editing) return renderEditMode();
    if (tab === "code") return renderCodeView();
    return renderPreview();
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-border/40 bg-background animate-slide-in-right">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-medium text-muted-foreground mr-2 max-w-[120px] truncate">{title}</span>
          {version && version > 1 && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">v{version}</span>
          )}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              onClick={() => { setTab("preview"); setEditing(false); }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                tab === "preview" && !editing ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
            <button
              onClick={() => { setTab("code"); setEditing(false); }}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                tab === "code" && !editing ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Code2 className="h-3 w-3" />
              Code
            </button>
            {!streaming && onContentChange && (
              <button
                onClick={() => { setEditing(!editing); setTab("code"); }}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  editing ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Pencil className="h-3 w-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {version && version > 1 && onLoadVersion && (
            <select
              value={version}
              onChange={(e) => onLoadVersion(Number(e.target.value))}
              className="h-7 rounded-md border border-border/40 bg-transparent px-1.5 text-[11px] text-muted-foreground outline-none cursor-pointer hover:bg-muted transition-colors"
            >
              {Array.from({ length: version }, (_, i) => i + 1).reverse().map((v) => (
                <option key={v} value={v}>v{v}{v === version ? " (current)" : ""}</option>
              ))}
            </select>
          )}
          {version && version === 1 && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums px-1">v1</span>
          )}
          <button onClick={handleDownload} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleCopy} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {!streaming && canPreviewInNewTab && (
            <button onClick={handleOpenNew} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Open in new tab">
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          {!streaming && tab === "preview" && (type === "html" || type === "svg") && (
            <button onClick={() => setIframeKey((k) => k + 1)} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
