"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/hooks/use-i18n";

import type { ProcessedFile } from "@/lib/file-processor/types";
import { MAX_FILES_PER_MESSAGE } from "@/lib/constants";

export interface UploadedFile {
  url: string;
  dataUrl?: string | null;
  textContent?: string | null;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  processed?: ProcessedFile;
}

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  disabled?: boolean;
}

export interface UploadProgress {
  fileName: string;
  percent: number; // 0-100
}

function uploadFileWithProgress(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        // Upload is 0-90%, processing is 90-100%
        onProgress(Math.round((e.loaded / e.total) * 90));
      }
    });

    xhr.addEventListener("load", () => {
      onProgress?.(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

export async function uploadFiles(
  fileList: File[],
  onProgress?: (progress: UploadProgress[]) => void,
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  const progressMap = new Map<string, number>();

  // Initialize progress for all files
  for (const file of fileList) {
    progressMap.set(file.name, 0);
  }

  for (const file of fileList) {
    try {
      const result = await uploadFileWithProgress(file, (percent) => {
        progressMap.set(file.name, percent);
        onProgress?.(
          Array.from(progressMap.entries()).map(([fileName, pct]) => ({
            fileName,
            percent: pct,
          }))
        );
      });
      uploaded.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to upload ${file.name}`;
      toast.error(msg);
      progressMap.set(file.name, -1); // mark failed
    }
  }
  return uploaded;
}

export default function FileUpload({ onFilesUploaded, disabled }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { t } = useI18n();
  const [progress, setProgress] = useState(0); // overall progress 0-100

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > MAX_FILES_PER_MESSAGE) {
        toast.error(t("upload.tooManyFiles", { max: MAX_FILES_PER_MESSAGE }));
        return;
      }
      setUploading(true);
      setProgress(0);

      const uploaded = await uploadFiles(files, (progressList) => {
        // Average progress across all files
        const total = progressList.reduce((sum, p) => sum + Math.max(0, p.percent), 0);
        setProgress(Math.round(total / progressList.length));
      });

      if (uploaded.length > 0) onFilesUploaded(uploaded);
      setUploading(false);
      setProgress(0);
    },
    [onFilesUploaded]
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFiles(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:text-muted-foreground hover:bg-muted disabled:opacity-30"
        title={t("upload.attachFile")}
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {/* Circular progress ring */}
            <svg className="absolute inset-0 h-8 w-8 -rotate-90" viewBox="0 0 32 32">
              <circle
                cx="16" cy="16" r="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(progress / 100) * 81.7} 81.7`}
                className="text-primary/40 transition-[stroke-dasharray] duration-200"
              />
            </svg>
          </>
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
