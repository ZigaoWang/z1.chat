"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Code2, Eye, ExternalLink, Copy, Check, RefreshCw } from "lucide-react";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);

// --- Detection ---

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

// --- Artifact tag extraction ---
// Models like Claude output <artifact id="..." type="text/html" title="...">HTML</artifact>

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

  // 1. Extract completed <artifact> tags
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

  // 1b. Strip PARTIAL (unclosed) <artifact> tags (still streaming)
  const partialArtifactRe = /<artifact\s+[^>]*?type="(text\/html|image\/svg\+xml)"[^>]*?>([\s\S]*)$/;
  const partialMatch = cleanContent.match(partialArtifactRe);
  if (partialMatch) {
    const type = partialMatch[1];
    const code = partialMatch[2].trim();
    const tagStart = cleanContent.match(/<artifact\s+[^>]*?type="(text\/html|image\/svg\+xml)"/);
    const fullTagPortion = cleanContent.slice(cleanContent.indexOf(tagStart![0]));
    const titleMatch = fullTagPortion.match(ARTIFACT_TITLE_RE);
    const title = titleMatch?.[1] || "Generating...";
    const idMatch = fullTagPortion.match(/id="([^"]*)"/);
    const id = idMatch?.[1] || `partial-artifact-${artifacts.length}`;

    if (code.length > 0 || type) {
      artifacts.push({ id, type, title, code });
    }
    // Remove everything from <artifact onwards
    cleanContent = cleanContent.slice(0, cleanContent.indexOf(tagStart![0])).trim();
  }

  // 2. Extract completed ```html code blocks that qualify as artifacts
  const codeBlockRe = /```html\n([\s\S]*?)```/g;
  let codeMatch: RegExpExecArray | null;
  const codeBlockRe2 = new RegExp(codeBlockRe.source, "g");

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

  // Remove completed artifact-eligible ```html blocks
  cleanContent = cleanContent.replace(codeBlockRe, (fullMatch, innerCode: string) => {
    if (isArtifact("html", innerCode.trim())) return "";
    return fullMatch;
  });

  // 2b. Strip PARTIAL (unclosed) ```html blocks (still streaming)
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
      // Remove from ```html onwards
      cleanContent = cleanContent.slice(0, cleanContent.lastIndexOf("```html")).trim();
    }
  }

  return { cleanContent: cleanContent.trim(), artifacts };
}

/** Try to pull a <title> from HTML */
function extractHtmlTitle(code: string): string | null {
  const m = code.match(/<title[^>]*>(.*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

// --- Wrap partial HTML for preview ---

function wrapForPreview(code: string, language: string): string {
  if (language === "svg" || language === "image/svg+xml") {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}</style></head><body>${code}</body></html>`;
  }

  const trimmed = code.trimStart();
  if (/^<!doctype/i.test(trimmed) || /^<html/i.test(trimmed)) {
    return code;
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"><\/script>
<style>body{margin:0}</style>
</head>
<body>
${code}
</body>
</html>`;
}

// --- Component ---

interface ArtifactPreviewProps {
  code: string;
  language: string;
  title?: string;
  streaming?: boolean;
  onClose: () => void;
}

export default function ArtifactPreview({ code, language, title, streaming, onClose }: ArtifactPreviewProps) {
  const [tab, setTab] = useState<"preview" | "code">(streaming ? "code" : "preview");
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const html = useMemo(() => wrapForPreview(code, language), [code, language]);

  // Debounce syntax highlighting during streaming to prevent page freeze
  const [highlightedCode, setHighlightedCode] = useState("");
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);

    const sanitize = (html: string) =>
      DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });

    // If not streaming, highlight immediately
    if (!streaming) {
      try {
        setHighlightedCode(sanitize(hljs.highlight(code, { language: "xml" }).value));
      } catch {
        setHighlightedCode(sanitize(code));
      }
      return;
    }

    // While streaming, debounce to every 300ms
    highlightTimer.current = setTimeout(() => {
      try {
        setHighlightedCode(sanitize(hljs.highlight(code, { language: "xml" }).value));
      } catch {
        setHighlightedCode(sanitize(code));
      }
    }, 300);

    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, [code, streaming]);

  // Auto-scroll to bottom while streaming, but respect manual scroll-up
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, [highlightedCode, streaming]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottom.current = distFromBottom < 40;
  }, []);

  // When streaming ends, switch to preview tab
  const prevStreaming = useRef(streaming);
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      setTab("preview");
    }
    prevStreaming.current = streaming;
  }, [streaming]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleOpenNew = useCallback(() => {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  }, [html]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="flex h-full w-full flex-col border-l border-border/40 bg-background animate-fade-in">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/40 px-3">
        <div className="flex items-center gap-1">
          {title && (
            <span className="text-xs font-medium text-muted-foreground mr-2 max-w-[150px] truncate">{title}</span>
          )}
          {/* Tabs */}
          <button
            onClick={() => setTab("preview")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === "preview"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
          <button
            onClick={() => setTab("code")}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              tab === "code"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <Code2 className="h-3 w-3" />
            Code
          </button>
        </div>

        <div className="flex items-center gap-1">
          {!streaming && tab === "preview" && (
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Refresh preview"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleOpenNew}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === "preview" ? (
        streaming ? (
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto min-w-0 bg-card">
            <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-card/90 backdrop-blur-sm border-b border-border/20">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span>Generating...</span>
              <button
                onClick={handleCopy}
                className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
              >
                {copied ? (
                  <><Check className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                ) : (
                  <><Copy className="h-3 w-3" />Copy</>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-x-auto">
              <code
                className="text-[13px] leading-relaxed font-mono hljs"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
              />
            </pre>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            ref={iframeRef}
            srcDoc={html}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            className="flex-1 w-full bg-white"
            title="Artifact preview"
          />
        )
      ) : (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-auto min-w-0">
          <div className="sticky top-0 z-10 flex items-center justify-end px-3 py-1.5 bg-background/80 backdrop-blur-sm border-b border-border/20">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <><Check className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
              ) : (
                <><Copy className="h-3 w-3" />Copy</>
              )}
            </button>
          </div>
          <pre className="p-4 overflow-x-auto">
            <code
              ref={codeRef}
              className="text-[13px] leading-relaxed font-mono hljs"
              dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}
