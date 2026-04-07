import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

export async function processDocument(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let textContent: string;
  let note: string | undefined;
  let truncated = false;

  if (ext === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value.trim();
      if (!textContent) {
        textContent = `Document: ${filename}`;
        note = "No text content found in this document.";
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      textContent = `Document: ${filename}`;
      note = `Failed to extract document content: ${msg}`;
    }
  } else if (ext === "doc") {
    // .doc (legacy Word) — try mammoth, but it often fails
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      textContent = result.value.trim() || `Document: ${filename}`;
    } catch {
      textContent = `Document: ${filename}`;
      note = "Legacy .doc format — content extraction not supported. Please convert to .docx.";
    }
  } else if (ext === "rtf") {
    // RTF: read as UTF-8, strip RTF control codes for rough text
    const raw = buffer.toString("utf-8");
    // Simple RTF stripping — removes {\rtf..} control words, keeps text
    textContent = raw
      .replace(/\{\\[^{}]*\}/g, "")
      .replace(/\\[a-z]+\d*\s?/gi, "")
      .replace(/[{}]/g, "")
      .trim();
    if (!textContent) {
      textContent = `Document: ${filename}`;
      note = "Could not extract readable text from this RTF file.";
    }
  } else {
    // .txt, .md, .log — plain UTF-8
    textContent = buffer.toString("utf-8");
  }

  if (textContent.length > MAX_TEXT_PER_FILE) {
    textContent = textContent.slice(0, MAX_TEXT_PER_FILE);
    truncated = true;
    textContent += "\n\n[Content truncated due to length]";
  }

  return {
    fileType: ext === "txt" || ext === "md" || ext === "log" ? "text" : "document",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    note,
    display: { icon: ext === "txt" || ext === "md" || ext === "log" ? "text" : "document", label: ext.toUpperCase() },
  };
}
