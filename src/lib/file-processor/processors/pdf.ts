import sharp from "sharp";
import type { ProcessedFile, ImageData } from "../types";
import {
  MAX_TEXT_PER_FILE,
  PDF_IMAGE_PAGE_LIMIT,
  PDF_PAGE_MAX_DIMENSION,
  PDF_PAGE_JPEG_QUALITY,
} from "@/lib/constants";

async function renderPagesAsImages(buffer: Buffer): Promise<ImageData[]> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  const pageCount = doc.countPages();
  const pages: ImageData[] = [];

  for (let i = 0; i < pageCount; i++) {
    const page = doc.loadPage(i);
    const bounds = page.getBounds();
    const width = bounds[2] - bounds[0];
    const height = bounds[3] - bounds[1];
    const scale = Math.min(PDF_PAGE_MAX_DIMENSION / width, PDF_PAGE_MAX_DIMENSION / height);
    const pixmap = page.toPixmap(
      [scale, 0, 0, scale, 0, 0],
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    const png = pixmap.asPNG();

    const jpeg = await sharp(Buffer.from(png))
      .jpeg({ quality: PDF_PAGE_JPEG_QUALITY })
      .toBuffer();

    pages.push({
      dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
    });
  }

  return pages;
}

export async function processPdf(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  let textContent: string = `PDF Document: ${filename}`;
  let note: string | undefined;
  let truncated = false;
  let pageCount = 0;
  let isScanned = false;

  try {
    const mupdf = await import("mupdf");
    const doc = mupdf.Document.openDocument(buffer, "application/pdf");
    pageCount = doc.countPages();

    // Extract text from all pages
    const textParts: string[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = doc.loadPage(i);
      const text = page.toStructuredText().asText();
      if (text.trim()) {
        textParts.push(text.trim());
      }
    }

    const rawText = textParts.join("\n\n").trim();

    if (!rawText) {
      textContent = `PDF Document: ${pageCount} page${pageCount !== 1 ? "s" : ""}`;
      isScanned = true;
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
      return {
        fileType: "pdf",
        originalName: filename,
        mimeType,
        size: buffer.length,
        textContent: `PDF Document: ${filename}`,
        note: "This PDF is password-protected and cannot be read.",
        display: { icon: "pdf", label: "PDF" },
      };
    }
    note = `Failed to extract PDF content: ${msg}`;
  }

  let pageImages: ImageData[] | undefined;

  if (pageCount > 0 && pageCount <= PDF_IMAGE_PAGE_LIMIT) {
    try {
      pageImages = await renderPagesAsImages(buffer);
    } catch (err) {
      console.error("[pdf] Failed to render pages as images:", err);
      if (isScanned) {
        note = "This appears to be a scanned PDF with no extractable text. Page rendering also failed.";
      }
    }
  } else if (isScanned && pageCount > PDF_IMAGE_PAGE_LIMIT) {
    note = "This appears to be a scanned PDF with no extractable text. Too many pages to render as images.";
  }

  return {
    fileType: "pdf",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    pageImages,
    truncated,
    note,
    display: { icon: "pdf", label: "PDF" },
  };
}
