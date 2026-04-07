import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

/**
 * Extract text from .pptx files.
 * PPTX is a ZIP containing XML slides at ppt/slides/slide{N}.xml.
 * Each slide has <a:t> text elements we can extract.
 */
export async function processPresentation(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let textContent: string;
  let note: string | undefined;
  let truncated = false;

  if (ext === "pptx") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);

      // Find all slide XML files and sort by slide number
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0");
          const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0");
          return numA - numB;
        });

      if (slideFiles.length === 0) {
        textContent = `Presentation: ${filename}`;
        note = "No slides found in this presentation.";
      } else {
        const slides: string[] = [];

        for (const slideFile of slideFiles) {
          const xml = await zip.files[slideFile].async("string");
          // Extract text from <a:t> tags (PowerPoint text runs)
          const textParts: string[] = [];
          const regex = /<a:t>([^<]*)<\/a:t>/g;
          let match;
          while ((match = regex.exec(xml)) !== null) {
            if (match[1].trim()) {
              textParts.push(match[1]);
            }
          }

          const slideNum = slideFile.match(/slide(\d+)/)?.[1] || "?";
          if (textParts.length > 0) {
            slides.push(`--- Slide ${slideNum} ---\n${textParts.join("\n")}`);
          } else {
            slides.push(`--- Slide ${slideNum} ---\n[No text content]`);
          }
        }

        textContent = `Presentation: ${filename} (${slideFiles.length} slides)\n\n${slides.join("\n\n")}`;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      textContent = `Presentation: ${filename}`;
      note = `Failed to extract presentation content: ${msg}`;
    }
  } else if (ext === "ppt") {
    textContent = `Presentation: ${filename}`;
    note = "Legacy .ppt format — content extraction not supported. Please convert to .pptx.";
  } else {
    // .odp or other
    textContent = `Presentation: ${filename}`;
    note = `${ext.toUpperCase()} presentation format — content extraction not supported.`;
  }

  if (textContent.length > MAX_TEXT_PER_FILE) {
    textContent = textContent.slice(0, MAX_TEXT_PER_FILE);
    truncated = true;
    textContent += "\n\n[Content truncated due to length]";
  }

  return {
    fileType: "document",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    note,
    display: { icon: "document", label: ext.toUpperCase() },
  };
}
