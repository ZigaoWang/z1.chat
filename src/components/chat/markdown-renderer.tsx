"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import { memo, useState, useCallback, useRef } from "react";
import { Check, Copy, Eye } from "lucide-react";
import { isArtifact } from "./artifact-preview";
import { useI18n } from "@/hooks/use-i18n";

function CodeBlock({
  className,
  children,
  onOpenArtifact,
}: {
  className?: string;
  children: React.ReactNode;
  onOpenArtifact?: (code: string, language: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);
  const { t } = useI18n();
  const language = className?.replace("language-", "").replace("hljs ", "") || "";

  const handleCopy = useCallback(async () => {
    const text = codeRef.current?.textContent || "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const codeText = codeRef.current?.textContent || "";
  const showPreview = onOpenArtifact && isArtifact(language, typeof children === "string" ? children : codeText);

  return (
    <div className="group/code relative my-3 overflow-hidden rounded-lg border border-border/40 bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 bg-muted/30">
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          {showPreview && (
            <button
              onClick={() => onOpenArtifact!(codeRef.current?.textContent || "", language)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/40 transition-colors hover:text-foreground hover:bg-muted"
            >
              <Eye className="h-3 w-3" />{t("common.preview")}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground/40 transition-colors sm:opacity-0 sm:group-hover/code:opacity-100 hover:text-foreground hover:bg-muted"
          >
            {copied ? (
              <><Check className="h-3 w-3 text-emerald-500" /><span className="text-emerald-500">{t("common.copied")}</span></>
            ) : (
              <><Copy className="h-3 w-3" />{t("common.copy")}</>
            )}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto px-4 py-3">
        <pre>
          <code ref={codeRef} className={`text-[13px] leading-relaxed font-mono ${className || ""}`}>
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Hoisted to module level — stable references, won't defeat memo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const remarkPlugins: any[] = [remarkGfm, remarkMath];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [rehypeHighlight, rehypeKatex];

function makeComponents(onOpenArtifact?: (code: string, language: string) => void): Components {
  return {
    code({ className, children, ...props }) {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[13px] font-mono" {...props}>
            {children}
          </code>
        );
      }
      return <CodeBlock className={className} onOpenArtifact={onOpenArtifact}>{children}</CodeBlock>;
    },
    pre({ children }) {
      return <>{children}</>;
    },
    a({ href, children }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="text-foreground underline decoration-foreground/20 underline-offset-3 transition-colors hover:decoration-foreground/50">
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="my-1 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      );
    },
    tr({ children }) {
      return <tr className="even:bg-muted/20">{children}</tr>;
    },
    th({ children }) {
      return <th className="border-b border-border bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">{children}</th>;
    },
    td({ children }) {
      return <td className="border-b border-border/30 px-3 py-2 text-sm">{children}</td>;
    },
    blockquote({ children }) {
      return <blockquote className="border-l-2 border-border pl-3 text-muted-foreground not-italic">{children}</blockquote>;
    },
    hr() {
      return <hr className="my-4 border-border/50" />;
    },
  };
}

// Cache components object per onOpenArtifact identity
const componentsCache = new WeakMap<Function, Components>();
const defaultComponents = makeComponents();

function getComponents(onOpenArtifact?: (code: string, language: string) => void): Components {
  if (!onOpenArtifact) return defaultComponents;
  let cached = componentsCache.get(onOpenArtifact);
  if (!cached) {
    cached = makeComponents(onOpenArtifact);
    componentsCache.set(onOpenArtifact, cached);
  }
  return cached;
}

// Fullwidth dollar sign — visually identical to $ but won't trigger remark-math delimiters.
// KaTeX renders it as a regular character inside math blocks.
const DOLLAR_PLACEHOLDER = "＄";

function preprocessMath(text: string): string {
  // Convert LaTeX-style delimiters to $/$$ that remark-math understands
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `$$${m}$$`);
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m}$`);

  let result = "";
  let i = 0;
  while (i < text.length) {
    // Skip code spans and fenced code blocks — never process $ inside code
    if (text[i] === "`") {
      if (text[i + 1] === "`" && text[i + 2] === "`") {
        const end = text.indexOf("```", i + 3);
        const stop = end !== -1 ? end + 3 : text.length;
        result += text.slice(i, stop);
        i = stop;
        continue;
      }
      const end = text.indexOf("`", i + 1);
      const stop = end !== -1 ? end + 1 : text.length;
      result += text.slice(i, stop);
      i = stop;
      continue;
    }

    // Display math $$...$$ — pass through, replacing \$ with placeholder inside
    if (text[i] === "$" && text[i + 1] === "$") {
      const start = i + 2;
      let j = start;
      while (j < text.length - 1) {
        if (text[j] === "$" && text[j + 1] === "$") break;
        j++;
      }
      const inner = text.slice(start, j).replace(/\\\$/g, DOLLAR_PLACEHOLDER);
      result += "$$" + inner + "$$";
      i = j + 2;
      continue;
    }

    // Potential inline math or money $
    if (text[i] === "$") {
      const next = text[i + 1];

      // Lone $, $ at end, or $ followed by whitespace — not math
      if (!next || next === " " || next === "\n") {
        result += text[i];
        i++;
        continue;
      }

      // Scan for a matching closing $
      let j = i + 1;
      let content = "";
      let closed = false;
      while (j < text.length) {
        // \$ inside potential math — use placeholder
        if (text[j] === "\\" && text[j + 1] === "$") {
          content += DOLLAR_PLACEHOLDER;
          j += 2;
          continue;
        }
        // Found closing $ (not preceded by space)
        if (text[j] === "$" && text[j - 1] !== " ") {
          closed = true;
          break;
        }
        // Double newline — not inline math
        if (text[j] === "\n" && text[j + 1] === "\n") break;
        content += text[j];
        j++;
      }

      if (closed) {
        const stripped = content.replace(new RegExp(DOLLAR_PLACEHOLDER, "g"), "");
        const hasLatex = /[\\^_{}]/.test(stripped);
        const isSingleVar = /^[a-zA-Z]$/.test(stripped.trim());

        if (hasLatex || isSingleVar) {
          result += "$" + content + "$";
          i = j + 1;
          continue;
        }

        // Purely numeric content like $298$ or $0.85$ — treat as math (model intended it)
        if (/^[\d.,\s]+$/.test(stripped.trim())) {
          result += "$" + content + "$";
          i = j + 1;
          continue;
        }

        // Other closed pair — treat as math
        result += "$" + content + "$";
        i = j + 1;
        continue;
      }

      // No closing $ found — standalone dollar sign
      // If followed by digit, it's money ($100, $5.00) — escape for markdown
      if (/\d/.test(next)) {
        result += "\\$";
        i++;
        continue;
      }

      // Other standalone $ — pass through
      result += text[i];
      i++;
      continue;
    }

    result += text[i];
    i++;
  }
  return result;
}

function MarkdownRenderer({ content, onOpenArtifact }: { content: string; onOpenArtifact?: (code: string, language: string) => void }) {
  if (!content) return null;

  const processed = preprocessMath(content);

  return (
    <div className="prose prose-neutral dark:prose-invert prose-sm max-w-none prose-p:text-[14.5px] prose-p:leading-relaxed prose-p:my-1.5 prose-li:text-[14.5px] prose-headings:font-semibold prose-headings:tracking-tight prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0 prose-code:before:content-none prose-code:after:content-none prose-li:my-1 prose-table:my-0 prose-thead:border-0 prose-tr:border-0">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={getComponents(onOpenArtifact)}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
