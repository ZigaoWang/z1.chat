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

const PRINT_STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1a1a1a; background: #fff; line-height: 1.7; font-size: 14px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .pdf-title { font-size: 24px; font-weight: 700; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; line-height: 1.3; }
  h1 { font-size: 21px; font-weight: 700; margin: 24px 0 8px; }
  h2 { font-size: 18px; font-weight: 600; margin: 20px 0 6px; }
  h3 { font-size: 15px; font-weight: 600; margin: 16px 0 4px; }
  h4 { font-size: 14px; font-weight: 600; margin: 12px 0 4px; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 10px; padding-left: 24px; }
  li { margin: 3px 0; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 14px; margin: 12px 0; color: #4b5563; }
  code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; background: #f3f4f6; padding: 1.5px 4px; border-radius: 3px; }
  pre { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin: 12px 0; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 11px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; page-break-inside: avoid; }
  th { background: #f9fafb; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb; }
  td { padding: 8px 12px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafafa; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
  a { color: #2563eb; text-decoration: none; }
  img { max-width: 100%; height: auto; }
  strong { font-weight: 600; }
  h1, h2, h3 { page-break-after: avoid; }
`;

export async function printMarkdown(content: string, title: string): Promise<void> {
  const htmlContent = await marked.parse(content, { gfm: true, breaks: true });
  const escaped = escapeHtml(title);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument!;
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escaped}</title><style>${PRINT_STYLES}</style></head><body><h1 class="pdf-title">${escaped}</h1>${htmlContent}</body></html>`);
  iframeDoc.close();

  await new Promise<void>((resolve) => {
    if (iframeDoc.readyState === "complete") resolve();
    else iframe.onload = () => resolve();
  });

  iframe.contentWindow!.focus();
  iframe.contentWindow!.print();
  setTimeout(() => document.body.removeChild(iframe), 1000);
}
