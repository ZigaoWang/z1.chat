import { readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const TEMP_DIR = join(tmpdir(), "one-uploads");

// Only allow uuid.ext pattern to prevent path traversal
const SAFE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\w+$/;

// Safe to serve inline — browsers won't execute these
const INLINE_MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  avif: "image/avif",
  pdf: "application/pdf",
};

// Force download — these could execute scripts if served inline on same origin
const DOWNLOAD_MIME_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  tiff: "image/tiff",
  heic: "image/heic",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  css: "text/css",
  js: "text/javascript",
  ts: "text/typescript",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  doc: "application/msword",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (!SAFE_FILENAME.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const filepath = join(TEMP_DIR, filename);
    const buffer = await readFile(filepath);
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const isInline = ext in INLINE_MIME_TYPES;
    const contentType = INLINE_MIME_TYPES[ext] || DOWNLOAD_MIME_TYPES[ext] || "application/octet-stream";

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };

    // Force download for anything that could execute scripts (SVG, HTML, JS, etc.)
    if (!isInline) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    return new Response(buffer, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
