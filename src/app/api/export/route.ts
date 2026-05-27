import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import { preprocessMath } from "@/lib/preprocess-math";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

marked.use(markedKatex({ throwOnError: false }));

function fontB64(file: string) {
  return fs.readFileSync(path.join(process.cwd(), "node_modules/@fontsource/inter/files", file)).toString("base64");
}

function katexCss() {
  const css = fs.readFileSync(path.join(process.cwd(), "node_modules/katex/dist/katex.min.css"), "utf-8");
  // inline katex fonts from node_modules
  return css.replace(/url\(fonts\/(KaTeX[^)]+)\)/g, (_, f) => {
    const p = path.join(process.cwd(), "node_modules/katex/dist/fonts", f);
    if (!fs.existsSync(p)) return `url(fonts/${f})`;
    const ext = f.split(".").pop();
    const mime = ext === "woff2" ? "font/woff2" : ext === "woff" ? "font/woff" : "font/truetype";
    return `url(data:${mime};base64,${fs.readFileSync(p).toString("base64")})`;
  });
}

const FONT_FACE = `
  @font-face { font-family: 'Inter'; font-weight: 400; font-style: normal;
    src: url(data:font/woff2;base64,${fontB64("inter-latin-400-normal.woff2")}) format('woff2'); }
  @font-face { font-family: 'Inter'; font-weight: 600; font-style: normal;
    src: url(data:font/woff2;base64,${fontB64("inter-latin-600-normal.woff2")}) format('woff2'); }
  @font-face { font-family: 'Inter'; font-weight: 700; font-style: normal;
    src: url(data:font/woff2;base64,${fontB64("inter-latin-700-normal.woff2")}) format('woff2'); }
`;

const KATEX_CSS = katexCss();

const STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', sans-serif;
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
  li > ul, li > ol { margin: 2px 0 2px; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 14px; margin: 12px 0; color: #4b5563; }
  code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; background: #f3f4f6; padding: 1.5px 4px; border-radius: 3px; }
  pre { background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px 14px; margin: 12px 0; overflow-x: auto; }
  pre code { background: none; padding: 0; font-size: 11px; line-height: 1.55; border-radius: 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #f9fafb; font-weight: 600; text-align: left; padding: 8px 12px; border: 1px solid #e5e7eb; }
  td { padding: 8px 12px; border: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #fafafa; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 20px 0; }
  a { color: #2563eb; text-decoration: none; }
  img { max-width: 100%; height: auto; }
  strong { font-weight: 600; }
`;

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, title } = await req.json();
  if (!content || !title) return NextResponse.json({ error: "Missing content or title" }, { status: 400 });

  const htmlContent = await marked.parse(preprocessMath(content), { gfm: true, breaks: true });
  const escaped = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${FONT_FACE}${KATEX_CSS}${STYLES}</style></head><body><h1 class="pdf-title">${escaped}</h1>${htmlContent}</body></html>`;

  const isLinux = process.platform === "linux";
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: isLinux ? (process.env.CHROMIUM_PATH ?? "/snap/bin/chromium") : undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      printBackground: true,
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
