"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  X, ExternalLink, Copy, Check,
  RefreshCw, Download, ChevronDown, FileText, FileDown, Loader2, Image as ImageIcon, FileCode2,
  ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import plaintext from "highlight.js/lib/languages/plaintext";
import MarkdownRenderer from "./markdown-renderer";

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
    if (type === "text/html" || type === "image/svg+xml") artifacts.push({ id, type, title, code });
  }

  cleanContent = cleanContent.replace(re, (fullMatch) => {
    const typeMatch = fullMatch.match(/type="([^"]*)"/);
    const type = typeMatch?.[1] || "";
    return (type === "text/html" || type === "image/svg+xml") ? "" : fullMatch;
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
      if (code.length > 0 || type) artifacts.push({ id, type, title, code });
      cleanContent = cleanContent.slice(0, cleanContent.indexOf(tagStart[0])).trim();
    }
  }

  const codeBlockRe = /```html\n([\s\S]*?)```/g;
  const codeBlockRe2 = new RegExp(codeBlockRe.source, "g");
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRe2.exec(cleanContent)) !== null) {
    const code = codeMatch[1].trim();
    if (isArtifact("html", code)) artifacts.push({ id: `codeblock-${artifacts.length}`, type: "text/html", title: extractHtmlTitle(code) || "Website", code });
  }
  cleanContent = cleanContent.replace(codeBlockRe, (fullMatch, innerCode: string) => isArtifact("html", innerCode.trim()) ? "" : fullMatch);

  const partialCodeBlockRe = /```html\n([\s\S]+)$/;
  const partialCodeMatch = cleanContent.match(partialCodeBlockRe);
  if (partialCodeMatch) {
    const code = partialCodeMatch[1].trim();
    if (code.length > 50 && isArtifact("html", code)) {
      artifacts.push({ id: `partial-codeblock-${artifacts.length}`, type: "text/html", title: extractHtmlTitle(code) || "Generating...", code });
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
    case "code": return ({ python: ".py", typescript: ".ts", javascript: ".js", java: ".java", go: ".go", rust: ".rs", cpp: ".cpp", c: ".c", ruby: ".rb", php: ".php", swift: ".swift", kotlin: ".kt", css: ".css" } as Record<string, string>)[language || ""] || ".txt";
    default: return ".txt";
  }
}

function getHighlightLang(type: string, language?: string | null): string {
  if (type === "html" || type === "svg") return "xml";
  if (type === "mermaid") return "plaintext";
  return language || "plaintext";
}

function doHighlight(code: string, lang: string): string {
  try {
    const safeLang = hljs.getLanguage(lang) ? lang : "plaintext";
    return DOMPurify.sanitize(hljs.highlight(code, { language: safeLang, ignoreIllegals: true }).value, { USE_PROFILES: { html: true } });
  } catch {
    return DOMPurify.sanitize(code, { USE_PROFILES: { html: true } });
  }
}

function escapeHtml(text: string): string {
  return DOMPurify.sanitize(text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
}

// --- Mermaid ---

const MERMAID_DANGEROUS_TAGS = /<\/?(script|iframe|object|embed|link|style|form|input|button)[^>]*>/gi;

const MERMAID_DISPLAY_CONFIG = {
  startOnLoad: false,
  theme: "default" as const,
  securityLevel: "loose" as const,
  flowchart: { htmlLabels: true },
};

function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const renderIdRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!code.trim()) return;
    const id = ++renderIdRef.current;
    setError("");
    const timer = setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize(MERMAID_DISPLAY_CONFIG);
        const sanitized = code.replace(MERMAID_DANGEROUS_TAGS, "");
        const { svg: rendered } = await mermaid.render(`mermaid-${Date.now()}`, sanitized);
        if (id === renderIdRef.current) setSvg(rendered);
      } catch (err) {
        if (id === renderIdRef.current) setError(err instanceof Error ? err.message : "Render failed");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [code]);

  const applyTransform = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const { x, y, scale } = transform.current;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const { x, y, scale } = transform.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(5, Math.max(0.25, scale * delta));
    const ratio = newScale / scale;
    transform.current = {
      x: cursorX - (cursorX - x) * ratio,
      y: cursorY - (cursorY - y) * ratio,
      scale: newScale,
    };
    applyTransform();
  }, [applyTransform]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    transform.current.x += dx;
    transform.current.y += dy;
    applyTransform();
  }, [applyTransform]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const resetView = useCallback(() => {
    transform.current = { x: 0, y: 0, scale: 1 };
    applyTransform();
  }, [applyTransform]);

  const zoomIn = useCallback(() => {
    const { x, y, scale } = transform.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.min(5, scale * 1.3);
    const ratio = newScale / scale;
    transform.current = { x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio, scale: newScale };
    applyTransform();
  }, [applyTransform]);

  const zoomOut = useCallback(() => {
    const { x, y, scale } = transform.current;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(0.25, scale / 1.3);
    const ratio = newScale / scale;
    transform.current = { x: cx - (cx - x) * ratio, y: cy - (cy - y) * ratio, scale: newScale };
    applyTransform();
  }, [applyTransform]);

  if (error) return <div className="flex items-center justify-center h-full p-8 text-sm text-destructive/60"><pre className="whitespace-pre-wrap">{error}</pre></div>;
  if (!svg) return <div className="flex items-center justify-center h-full p-8"><div className="h-5 w-5 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/50 animate-spin" /></div>;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={resetView}
      className="relative h-full w-full overflow-hidden cursor-grab active:cursor-grabbing select-none"
    >
      <div
        ref={contentRef}
        data-mermaid-container=""
        className="origin-top-left p-8"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm p-0.5 shadow-sm">
        <button onClick={zoomOut} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button onClick={resetView} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={zoomIn} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// --- Icon button helper ---

function IconBtn({ onClick, title, children, className, disabled }: { onClick: () => void; title: string; children: React.ReactNode; className?: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} className={`flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed ${className || ""}`}>
      {children}
    </button>
  );
}

// --- Download menu (fixed position to escape overflow-hidden) ---

function DownloadMenu({ btnRef, onClose, onPdf, onMd }: {
  btnRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPdf: () => void;
  onMd: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [btnRef]);

  if (!pos) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div className="fixed z-[61] min-w-[140px] rounded-md border border-border bg-popover shadow-md py-0.5" style={{ top: pos.top, right: pos.right }}>
        <button onClick={onPdf} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted transition-colors text-foreground">
          <FileDown className="h-3.5 w-3.5 text-muted-foreground" />PDF
        </button>
        <button onClick={onMd} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted transition-colors text-foreground">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />Markdown
        </button>
      </div>
    </>
  );
}

function DiagramDownloadMenu({ btnRef, onClose, onPng, onSvg }: {
  btnRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onPng: () => void;
  onSvg: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }, [btnRef]);

  if (!pos) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div className="fixed z-[61] min-w-[140px] rounded-md border border-border bg-popover shadow-md py-0.5" style={{ top: pos.top, right: pos.right }}>
        <button onClick={onPng} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted transition-colors text-foreground">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />PNG
        </button>
        <button onClick={onSvg} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted transition-colors text-foreground">
          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />SVG
        </button>
      </div>
    </>
  );
}

// --- Main ---

export interface ArtifactData {
  id?: string;
  type: string;
  title: string;
  content: string;
  language?: string | null;
  version?: number;
}

interface ArtifactPreviewProps {
  artifact: ArtifactData;
  streaming?: boolean;
  onClose: () => void;
  onLoadVersion?: (version: number) => void;
  totalVersions?: number;
}

export default function ArtifactPreview({
  artifact, streaming, onClose, onLoadVersion, totalVersions,
}: ArtifactPreviewProps) {
  const { type, title, content, language, version } = artifact;

  const [tab, setTab] = useState<"preview" | "code">(streaming && type !== "document" ? "code" : "preview");
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [versionOpen, setVersionOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(() => doHighlight(content, getHighlightLang(type, language)));

  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const downloadBtnRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const hlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContentRef = useRef(content);
  const prevStreamingRef = useRef(streaming);

  const hLang = useMemo(() => getHighlightLang(type, language), [type, language]);
  const canOpenNew = type === "html" || type === "svg";
  const numVersions = totalVersions || version || 1;

  // Tab switching
  useEffect(() => {
    if (streaming && !prevStreamingRef.current && type !== "document") setTab("code");
    else if (!streaming && prevStreamingRef.current) setTab("preview");
    prevStreamingRef.current = streaming;
  }, [streaming, type]);

  // Syntax highlighting
  useEffect(() => {
    if (hlTimer.current) clearTimeout(hlTimer.current);
    if (!streaming) { setHighlighted(doHighlight(content, hLang)); return; }
    hlTimer.current = setTimeout(() => setHighlighted(doHighlight(content, hLang)), 500);
    return () => { if (hlTimer.current) clearTimeout(hlTimer.current); };
  }, [content, streaming, hLang]);

  // Auto-scroll
  useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [content, streaming]);

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";

  const handleDownload = useCallback(() => {
    if (type === "document" || type === "mermaid") {
      setDownloadOpen(!downloadOpen);
      return;
    }
    const ext = getDownloadExtension(type, language);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${slug}${ext}` }).click();
    URL.revokeObjectURL(url);
  }, [content, type, language, slug, downloadOpen]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloadOpen(false);
    setPdfLoading(true);
    try {
      const { exportToPdf } = await import("@/lib/pdf-export");
      await exportToPdf(content, title);
    } finally {
      setPdfLoading(false);
    }
  }, [content, title]);

  const handleDownloadMd = useCallback(() => {
    setDownloadOpen(false);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${slug}.md` }).click();
    URL.revokeObjectURL(url);
  }, [content, slug]);

  const handleDownloadPng = useCallback(async () => {
    setDownloadOpen(false);
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "loose",
        flowchart: { htmlLabels: false },
        themeVariables: { primaryTextColor: "#333", secondaryTextColor: "#333", tertiaryTextColor: "#333" },
      });
      const sanitized = content.replace(MERMAID_DANGEROUS_TAGS, "");
      const { svg: exportSvg } = await mermaid.render(`mermaid-png-${Date.now()}`, sanitized);
      mermaid.initialize(MERMAID_DISPLAY_CONFIG);

      const parser = new DOMParser();
      const doc = parser.parseFromString(exportSvg, "image/svg+xml");
      const svgNode = doc.querySelector("svg")!;
      const viewBox = svgNode.getAttribute("viewBox")?.split(" ").map(Number);
      const w = viewBox?.[2] || 800;
      const h = viewBox?.[3] || 600;
      svgNode.setAttribute("width", String(w));
      svgNode.setAttribute("height", String(h));
      svgNode.removeAttribute("style");

      const serialized = new XMLSerializer().serializeToString(svgNode);
      const withVisibleText = serialized
        .replace(/<text /g, '<text fill="#333" ')
        .replace(/<tspan /g, '<tspan fill="#333" ');

      const scale = 2;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, w * scale, h * scale);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          Object.assign(document.createElement("a"), { href: url, download: `${slug}.png` }).click();
          URL.revokeObjectURL(url);
        }, "image/png");
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(withVisibleText);
    } catch (e) {
      console.error("PNG export failed:", e);
    }
  }, [slug, content]);

  const handleDownloadSvg = useCallback(() => {
    setDownloadOpen(false);
    const svgEl = document.querySelector("[data-mermaid-container] svg") as SVGSVGElement | null;
    if (!svgEl) return;
    const blob = new Blob(
      [new XMLSerializer().serializeToString(svgEl)],
      { type: "image/svg+xml;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${slug}.svg` }).click();
    URL.revokeObjectURL(url);
  }, [slug]);

  const handleOpenNew = useCallback(() => {
    if (!canOpenNew) return;
    const w = window.open("", "_blank");
    if (w) { const h = wrapForPreview(content, type); w.document.open(); w.document.write(h); w.document.close(); }
  }, [content, type, canOpenNew]);

  // Code display: highlighted when ready, escaped raw as fallback during streaming
  const codeHtml = useMemo(() => (streaming && !highlighted) ? escapeHtml(content) : highlighted, [streaming, highlighted, content]);

  // --- Render ---

  const renderContent = () => {
    // Code tab (not available for documents)
    if (tab === "code" && type !== "document") return (
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4 overflow-x-auto">
          <pre><code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: codeHtml }} /></pre>
        </div>
      </div>
    );

    // Preview tab — waiting for content
    if (streaming && !content) return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground/50">
          <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/40 animate-spin" />
          Generating...
        </div>
      </div>
    );

    // Preview: document — live markdown
    if (type === "document") return (
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 h-0 overflow-y-auto px-6 py-6 sm:px-10">
        <MarkdownRenderer content={content} />
      </div>
    );

    // Preview: streaming non-document — show code
    if (streaming) return (
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-4 overflow-x-auto">
          <pre><code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: codeHtml }} /></pre>
        </div>
      </div>
    );

    // Preview: finished
    switch (type) {
      case "html": return <iframe key={iframeKey} ref={iframeRef} srcDoc={wrapForPreview(content, "html")} sandbox="allow-scripts allow-forms allow-popups allow-modals" className="flex-1 w-full bg-white" title="Preview" />;
      case "svg": return <iframe key={iframeKey} srcDoc={wrapForPreview(content, "svg")} sandbox="allow-scripts" className="flex-1 w-full bg-white" title="Preview" />;
      case "mermaid": return <div className="flex-1 h-0 bg-white dark:bg-card"><MermaidPreview code={content} /></div>;
      default: return (
        <div className="flex-1 h-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 overflow-x-auto">
            <pre><code className="text-[13px] leading-relaxed font-mono hljs" dangerouslySetInnerHTML={{ __html: highlighted }} /></pre>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40">
        {/* Row 1: title + actions */}
        <div className="flex items-center gap-1 px-2 h-11 min-w-0">
          <span className="text-sm font-medium truncate min-w-0 shrink px-1">{title}</span>
          {numVersions > 1 && onLoadVersion ? (
            <div className="relative shrink-0">
              <button onClick={() => setVersionOpen(!versionOpen)} className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] tabular-nums text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors">
                v{version}<ChevronDown className="h-2.5 w-2.5" />
              </button>
              {versionOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setVersionOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 min-w-[72px] rounded-md border border-border bg-popover shadow-md py-0.5">
                    {Array.from({ length: numVersions }, (_, i) => i + 1).reverse().map((v) => (
                      <button key={v} onClick={() => { onLoadVersion(v); setVersionOpen(false); }} className={`w-full px-2.5 py-1 text-left text-[11px] hover:bg-muted transition-colors ${v === version ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        v{v}{v === version ? " (latest)" : ""}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground/30 tabular-nums shrink-0">v{version || 1}</span>
          )}
          <div className="flex-1 min-w-0" />
          {/* Tabs: desktop inline */}
          <div className="hidden sm:flex items-center rounded-md bg-muted/50 p-0.5 shrink-0">
            <button onClick={() => setTab("preview")} className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${tab === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60 hover:text-foreground"}`}>Preview</button>
            {type !== "document" && (
              <button onClick={() => setTab("code")} className={`rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${tab === "code" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60 hover:text-foreground"}`}>Code</button>
            )}
          </div>
          {/* Actions */}
          <div className="flex items-center shrink-0">
            <IconBtn onClick={handleCopy} title="Copy">{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}</IconBtn>
            {type === "document" ? (
              <div className="relative" ref={downloadBtnRef}>
                <IconBtn onClick={handleDownload} title="Download" disabled={pdfLoading}>
                  {pdfLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                </IconBtn>
                {downloadOpen && <DownloadMenu btnRef={downloadBtnRef} onClose={() => setDownloadOpen(false)} onPdf={handleDownloadPdf} onMd={handleDownloadMd} />}
              </div>
            ) : type === "mermaid" ? (
              <div className="relative" ref={downloadBtnRef}>
                <IconBtn onClick={handleDownload} title="Download"><Download className="h-3.5 w-3.5" /></IconBtn>
                {downloadOpen && <DiagramDownloadMenu btnRef={downloadBtnRef} onClose={() => setDownloadOpen(false)} onPng={handleDownloadPng} onSvg={handleDownloadSvg} />}
              </div>
            ) : (
              <IconBtn onClick={handleDownload} title="Download"><Download className="h-3.5 w-3.5" /></IconBtn>
            )}
            {!streaming && canOpenNew && <IconBtn onClick={handleOpenNew} title="Open in new tab"><ExternalLink className="h-3.5 w-3.5" /></IconBtn>}
            {!streaming && tab === "preview" && canOpenNew && <IconBtn onClick={() => setIframeKey(k => k + 1)} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></IconBtn>}
            <IconBtn onClick={onClose} title="Close"><X className="h-3.5 w-3.5" /></IconBtn>
          </div>
        </div>
        {/* Tabs: mobile row 2 */}
        <div className="flex items-center px-3 pb-2 sm:hidden">
          <div className="flex items-center rounded-md bg-muted/50 p-0.5 w-full">
            <button onClick={() => setTab("preview")} className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${tab === "preview" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"}`}>Preview</button>
            {type !== "document" && (
              <button onClick={() => setTab("code")} className={`flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors ${tab === "code" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground/60"}`}>Code</button>
            )}
          </div>
        </div>
      </div>

      {/* Streaming progress */}
      {streaming && (
        <div className="h-0.5 bg-muted overflow-hidden shrink-0">
          <div className="h-full w-1/3 bg-primary/40 animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      )}

      {/* Content */}
      {renderContent()}
    </div>
  );
}
