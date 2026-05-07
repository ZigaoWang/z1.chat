import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function extractTextFromXml(xml: string): string[] {
  const textParts: string[] = [];

  // Match <a:t> tags including those with content spanning lines or containing entities.
  // Use [\s\S]*? to match any content (including newlines) non-greedily.
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const decoded = decodeXmlEntities(match[1]).trim();
    if (decoded) {
      textParts.push(decoded);
    }
  }

  return textParts;
}

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
    if (buffer.length === 0) {
      return {
        fileType: "document",
        originalName: filename,
        mimeType,
        size: 0,
        textContent: `Presentation: ${filename}`,
        note: "File is empty.",
        display: { icon: "document", label: "PPTX" },
      };
    }

    // Validate ZIP magic bytes (PK\x03\x04)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return {
        fileType: "document",
        originalName: filename,
        mimeType,
        size: buffer.length,
        textContent: `Presentation: ${filename}`,
        note: "File does not appear to be a valid .pptx file (invalid ZIP format).",
        display: { icon: "document", label: "PPTX" },
      };
    }

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(Uint8Array.from(buffer));

      // Verify it's actually a PPTX (should have [Content_Types].xml and ppt/ folder)
      const hasContentTypes = !!zip.files["[Content_Types].xml"];
      const hasPptFolder = Object.keys(zip.files).some((name) => name.startsWith("ppt/"));
      if (!hasContentTypes || !hasPptFolder) {
        return {
          fileType: "document",
          originalName: filename,
          mimeType,
          size: buffer.length,
          textContent: `Presentation: ${filename}`,
          note: "File is a ZIP archive but does not contain valid PowerPoint content.",
          display: { icon: "document", label: "PPTX" },
        };
      }

      // Find all slide XML files and sort by slide number
      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)/i)?.[1] || "0");
          const numB = parseInt(b.match(/slide(\d+)/i)?.[1] || "0");
          return numA - numB;
        });

      if (slideFiles.length === 0) {
        textContent = `Presentation: ${filename}`;
        note = "No slides found in this presentation.";
      } else {
        const slides: string[] = [];

        for (const slideFile of slideFiles) {
          const xml = await zip.files[slideFile].async("string");
          const textParts = extractTextFromXml(xml);

          const slideNum = slideFile.match(/slide(\d+)/i)?.[1] || "?";
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
      if (msg.includes("not a valid zip") || msg.includes("Corrupted") || msg.includes("End of data")) {
        note = "File appears to be corrupted or is not a valid .pptx file.";
      } else {
        note = `Failed to extract presentation content: ${msg}`;
      }
    }
  } else if (ext === "ppt") {
    textContent = `Presentation: ${filename}`;
    note = "Legacy .ppt format — content extraction not supported. Please convert to .pptx.";
  } else {
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
