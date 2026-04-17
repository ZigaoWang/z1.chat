import sharp from "sharp";
import type { ProcessedFile } from "../types";

const MAX_PREVIEW_DIMENSION = 1024;

export async function processImage(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  // GIF and SVG: use raw base64
  if (ext === "gif" || ext === "svg") {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return {
      fileType: "image",
      originalName: filename,
      mimeType,
      size: buffer.length,
      imageData: { dataUrl },
      display: { icon: "image", label: ext.toUpperCase() || "Image" },
    };
  }

  // All other images: resize for preview via sharp
  // HEIC/HEIF are already converted to JPEG by the upload route before reaching here
  try {
    const preview = await sharp(buffer)
      .resize(MAX_PREVIEW_DIMENSION, MAX_PREVIEW_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    const dataUrl = `data:image/jpeg;base64,${preview.toString("base64")}`;
    return {
      fileType: "image",
      originalName: filename,
      mimeType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
      size: buffer.length,
      imageData: { dataUrl },
      display: { icon: "image", label: ext.toUpperCase() || "Image" },
    };
  } catch {
    // Fallback: raw base64
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return {
      fileType: "image",
      originalName: filename,
      mimeType,
      size: buffer.length,
      imageData: { dataUrl },
      display: { icon: "image", label: ext.toUpperCase() || "Image" },
    };
  }
}
