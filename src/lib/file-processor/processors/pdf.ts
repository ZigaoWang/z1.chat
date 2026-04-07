import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

export async function processPdf(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  let textContent: string;
  let note: string | undefined;
  let truncated = false;

  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const info = await parser.getInfo();
    const pageCount = info.total || 0;

    const textResult = await parser.getText();
    const rawText = (textResult.text || "").trim();

    await parser.destroy();

    if (!rawText) {
      textContent = `PDF Document: ${pageCount} page${pageCount !== 1 ? "s" : ""}`;
      note = "This appears to be a scanned PDF with no extractable text.";
    } else {
      let text = rawText;
      if (text.length > MAX_TEXT_PER_FILE) {
        text = text.slice(0, MAX_TEXT_PER_FILE);
        truncated = true;
      }
      textContent = `PDF Document: ${pageCount} page${pageCount !== 1 ? "s" : ""}\n\n${text}`;
      if (truncated) {
        textContent += "\n\n[Content truncated due to length]";
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("password")) {
      textContent = `PDF Document: ${filename}`;
      note = "This PDF is password-protected and cannot be read.";
    } else {
      textContent = `PDF Document: ${filename}`;
      note = `Failed to extract PDF content: ${msg}`;
    }
  }

  return {
    fileType: "pdf",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    note,
    display: { icon: "pdf", label: "PDF" },
  };
}
