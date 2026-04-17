import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { processFile } from "@/lib/file-processor";
import { getCurrentUserId } from "@/lib/auth";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";

const TEMP_DIR = join(tmpdir(), "one-uploads");
const CLEANUP_DELAY = 60 * 60 * 1000; // 1 hour

// Extensions that need HEIC→JPEG conversion via heic-convert
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
// Extensions that sharp can convert directly
const SHARP_CONVERT = new Set(["avif", "tiff", "tif"]);

async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  // Dynamic import — heic-convert is CJS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const convert = require("heic-convert");
  const result = await convert({
    buffer,
    format: "JPEG",
    quality: 0.9,
  });
  return Buffer.from(result);
}

export async function POST(req: Request) {
  try {
    await getCurrentUserId();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return Response.json(
        { error: `File too large. Maximum size is ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    let buffer: Buffer = Buffer.from(await file.arrayBuffer());
    let fileName = file.name;
    let fileType = file.type;

    // Convert HEIC/HEIF to JPEG immediately — before anything else
    const originalExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (HEIC_EXTENSIONS.has(originalExt)) {
      try {
        buffer = await convertHeicToJpeg(buffer);
        fileName = file.name.replace(/\.[^.]+$/, ".jpg");
        fileType = "image/jpeg";
        console.log(`[upload] Converted HEIC → JPEG (${(buffer.length / 1024).toFixed(0)}KB)`);
      } catch (err) {
        console.error(`[upload] Failed to convert HEIC:`, err);
      }
    } else if (SHARP_CONVERT.has(originalExt)) {
      try {
        buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
        fileName = file.name.replace(/\.[^.]+$/, ".jpg");
        fileType = "image/jpeg";
        console.log(`[upload] Converted ${originalExt.toUpperCase()} → JPEG (${(buffer.length / 1024).toFixed(0)}KB)`);
      } catch (err) {
        console.error(`[upload] Failed to convert ${originalExt}:`, err);
      }
    }

    // Process through the file processor pipeline (uses the converted buffer if applicable)
    const processed = await processFile(buffer, fileName, fileType);

    // Save to temp directory
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = fileName.split(".").pop() || "bin";
    const tempFilename = `${randomUUID()}.${ext}`;
    const filepath = join(TEMP_DIR, tempFilename);
    await writeFile(filepath, buffer);

    // Schedule cleanup after 1 hour
    setTimeout(() => {
      unlink(filepath).catch(() => {});
    }, CLEANUP_DELAY);

    // Build response
    const isImage = processed.fileType === "image" && !!processed.imageData;
    const dataUrl = processed.imageData?.dataUrl || null;
    const textContent = processed.textContent || null;

    return Response.json({
      url: `/api/upload/temp/${tempFilename}`,
      name: fileName,
      type: fileType,
      size: file.size,
      isImage,
      dataUrl,
      textContent,
      processed,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
