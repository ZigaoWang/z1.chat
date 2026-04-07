"use client";

import { useState, memo } from "react";
import { Globe, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface ToolResultProps {
  toolName: string;
  args: Record<string, unknown>;
  result: {
    answer?: string;
    results?: SearchResult[];
    error?: string;
  };
}

function ToolResult({ toolName, args, result }: ToolResultProps) {
  const [expanded, setExpanded] = useState(false);

  if (toolName === "web_search") {
    return (
      <div className="my-3 rounded-xl border border-border/60 bg-muted/20 overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
        >
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[13px] font-medium text-muted-foreground">
            Searched: {String(args.query)}
          </span>
          <span className="ml-auto text-muted-foreground/40">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        </button>

        {expanded && (
          <div className="border-t border-border/40 px-3.5 py-2.5 space-y-2">
            {result.error && (
              <p className="text-[12px] text-destructive">{result.error}</p>
            )}
            {result.results?.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium text-foreground truncate">
                      {r.title}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/60 line-clamp-2">
                    {r.snippet}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Generic tool result
  return (
    <div className="my-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">
          Tool: {toolName}
        </span>
      </div>
    </div>
  );
}

export default memo(ToolResult);
