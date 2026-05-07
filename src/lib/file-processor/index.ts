import type { FileType, ProcessedFile } from "./types";
import { processImage } from "./processors/image";
import { processPdf } from "./processors/pdf";
import { processDocument } from "./processors/document";
import { processSpreadsheet } from "./processors/spreadsheet";
import { processDataFile } from "./processors/text";
import { processCode } from "./processors/code";
import { processPresentation } from "./processors/presentation";
import {
  MAX_UPLOAD_SIZE,
  MAX_TEXT_PER_FILE,
  MAX_TOTAL_ATTACHMENT_TEXT,
  MAX_FILES_PER_MESSAGE,
} from "@/lib/constants";

export type { FileType, ProcessedFile } from "./types";

// Extension → FileType routing table
const EXTENSION_MAP: Record<string, FileType> = {};

// Images
for (const ext of ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif", "heic"]) {
  EXTENSION_MAP[ext] = "image";
}

// PDF
EXTENSION_MAP["pdf"] = "pdf";

// Documents
for (const ext of ["docx", "doc", "rtf"]) {
  EXTENSION_MAP[ext] = "document";
}

// Presentations
for (const ext of ["pptx", "ppt", "odp"]) {
  EXTENSION_MAP[ext] = "presentation" as FileType;
}

// Plain text
for (const ext of ["txt", "md", "log"]) {
  EXTENSION_MAP[ext] = "text";
}

// Spreadsheets
for (const ext of ["xlsx", "xls", "csv", "tsv"]) {
  EXTENSION_MAP[ext] = "spreadsheet";
}

// Data formats
for (const ext of ["json", "jsonl", "xml", "yaml", "yml", "toml"]) {
  EXTENSION_MAP[ext] = "data";
}

// Code
for (const ext of [
  "js", "ts", "jsx", "tsx", "py", "rb", "go", "rs", "java",
  "c", "cpp", "h", "hpp", "cs", "swift", "kt", "php", "lua",
  "r", "dart", "vue", "svelte", "astro", "html", "css", "scss",
  "sass", "less", "sql", "sh", "bash", "zsh", "graphql", "proto",
  "dockerfile", "makefile", "env", "ini", "cfg", "conf",
]) {
  EXTENSION_MAP[ext] = "code";
}

// Archives
for (const ext of ["zip", "tar", "gz", "rar", "7z"]) {
  EXTENSION_MAP[ext] = "archive";
}

function getFileType(filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  // Handle extensionless files by their name
  const baseName = filename.split("/").pop()?.toLowerCase() || "";
  return EXTENSION_MAP[ext] || EXTENSION_MAP[baseName] || "unknown";
}

export async function processFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  // Size check
  if (buffer.length > MAX_UPLOAD_SIZE) {
    throw new Error(`File too large. Maximum size is ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))}MB.`);
  }

  const fileType = getFileType(filename);

  try {
    switch (fileType) {
      case "image":
        return await processImage(buffer, filename, mimeType);
      case "pdf":
        return await processPdf(buffer, filename, mimeType);
      case "document":
      case "text":
        return await processDocument(buffer, filename, mimeType);
      case "presentation":
        return await processPresentation(buffer, filename, mimeType);
      case "spreadsheet":
        return await processSpreadsheet(buffer, filename, mimeType);
      case "data":
        return await processDataFile(buffer, filename, mimeType);
      case "code":
        return await processCode(buffer, filename, mimeType);
      case "archive":
        return {
          fileType: "archive" as const,
          originalName: filename,
          mimeType,
          size: buffer.length,
          textContent: "[Archives cannot be read directly. Please extract the files and upload them individually.]",
          display: { icon: "archive" as const, label: filename.split(".").pop()?.toUpperCase() || "Archive" },
        };
      case "unknown":
      default: {
        // Try UTF-8 read, fall back to binary note
        const text = buffer.toString("utf-8");
        const nullCount = (text.match(/\0/g) || []).length;
        if (nullCount > text.length * 0.01) {
          return {
            fileType: "unknown",
            originalName: filename,
            mimeType,
            size: buffer.length,
            textContent: "[Binary file — content cannot be displayed as text.]",
            display: { icon: "unknown", label: "File" },
          };
        }
        let content = text;
        let truncated = false;
        if (content.length > MAX_TEXT_PER_FILE) {
          content = content.slice(0, MAX_TEXT_PER_FILE) + "\n\n[Content truncated due to length]";
          truncated = true;
        }
        return {
          fileType: "unknown",
          originalName: filename,
          mimeType,
          size: buffer.length,
          textContent: content,
          truncated,
          display: { icon: "unknown", label: "File" },
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const ext = filename.split(".").pop()?.toUpperCase() || "File";
    return {
      fileType: fileType === "unknown" ? "unknown" : fileType,
      originalName: filename,
      mimeType,
      size: buffer.length,
      textContent: `[Failed to process file: ${filename}]`,
      note: `Processing error: ${msg}`,
      display: { icon: fileType === "unknown" ? "unknown" : fileType, label: ext },
    };
  }
}

/** Validate a set of files before processing */
export function validateFileSet(files: File[]): string | null {
  if (files.length > MAX_FILES_PER_MESSAGE) {
    return `Too many files. Maximum is ${MAX_FILES_PER_MESSAGE} files per message.`;
  }
  for (const file of files) {
    if (file.size > MAX_UPLOAD_SIZE) {
      return `"${file.name}" is too large. Maximum size is ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))}MB.`;
    }
  }
  return null;
}

/** Check total text length of processed files */
export function checkTotalTextLength(processedFiles: ProcessedFile[]): boolean {
  let total = 0;
  for (const f of processedFiles) {
    total += (f.textContent || "").length;
  }
  return total <= MAX_TOTAL_ATTACHMENT_TEXT;
}
