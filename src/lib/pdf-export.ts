import { marked } from "marked";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function exportToPdf(content: string, title: string): Promise<void> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, title }),
  });

  if (!res.ok) throw new Error("PDF export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `${slugify(title)}.pdf` }).click();
  URL.revokeObjectURL(url);
}

