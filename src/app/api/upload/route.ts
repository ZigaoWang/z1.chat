import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { processFile } from "@/lib/file-processor";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";

const TEMP_DIR = join(tmpdir(), "one-uploads");
const CLEANUP_DELAY = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  try {
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

    const buffer = Buffer.from(await file.arrayBuffer());

    // Process through the file processor pipeline
    const processed = await processFile(buffer, file.name, file.type);

    // Save to temp directory
    await mkdir(TEMP_DIR, { recursive: true });
    const ext = file.name.split(".").pop() || "bin";
    const filename = `${randomUUID()}.${ext}`;
    const filepath = join(TEMP_DIR, filename);
    await writeFile(filepath, buffer);

    // Schedule cleanup after 1 hour
    setTimeout(() => {
      unlink(filepath).catch(() => {});
    }, CLEANUP_DELAY);

    // Build backward-compatible response
    const isImage = processed.fileType === "image";
    const dataUrl = processed.imageData?.dataUrl || null;
    const textContent = processed.textContent || null;

    return Response.json({
      // Backward-compatible fields
      url: `/api/upload/temp/${filename}`,
      name: file.name,
      type: file.type,
      size: file.size,
      isImage,
      dataUrl,
      textContent,
      // New field
      processed,
    });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
