import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

export async function processDataFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let textContent: string;
  let note: string | undefined;
  let truncated = false;

  const raw = buffer.toString("utf-8");

  if (ext === "json") {
    try {
      const parsed = JSON.parse(raw);
      textContent = JSON.stringify(parsed, null, 2);
    } catch {
      textContent = raw;
      note = "Invalid JSON — showing raw content.";
    }
  } else {
    // .jsonl, .xml, .yaml, .yml, .toml — pass through as text
    textContent = raw;
  }

  if (textContent.length > MAX_TEXT_PER_FILE) {
    textContent = textContent.slice(0, MAX_TEXT_PER_FILE);
    truncated = true;
    textContent += "\n\n[Content truncated due to length]";
  }

  return {
    fileType: "data",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    note,
    display: { icon: "data", label: ext.toUpperCase() },
  };
}
