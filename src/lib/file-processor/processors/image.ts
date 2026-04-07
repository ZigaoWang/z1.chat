import sharp from "sharp";
import type { ProcessedFile } from "../types";

const MAX_DIMENSION = 1024;

export async function processImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let dataUrl: string;

  // GIF and SVG: use raw base64 (sharp can't handle animated GIFs well, SVG is already small)
  if (ext === "gif" || ext === "svg") {
    dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
  } else {
    try {
      const compressed = await sharp(buffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      dataUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
    } catch {
      // Fallback to raw base64
      dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    }
  }

  return {
    fileType: "image",
    originalName: filename,
    mimeType,
    size: buffer.length,
    imageData: { dataUrl },
    display: { icon: "image", label: ext.toUpperCase() || "Image" },
  };
}
