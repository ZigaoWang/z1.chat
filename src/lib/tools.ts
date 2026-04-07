import { tool } from "ai";
import { z } from "zod";

const MAX_PAGE_TEXT = 30_000; // chars to return from fetched page

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTools(): Record<string, any> {
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
  // Jina renders JS, bypasses bot protection, and returns clean markdown — no API key needed.
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

  return tools;
}

export function hasTools(): boolean {
  return true; // fetch_page is always available
}
