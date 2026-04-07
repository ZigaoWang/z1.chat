"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

async function uploadFiles(fileList: File[]): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  for (const file of fileList) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || `Failed to upload ${file.name}`);
        continue;
      }
      uploaded.push(await res.json());
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
  }
  return uploaded;
}

export { uploadFiles };

export default function FileUpload({ onFilesUploaded, disabled }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > MAX_FILES_PER_MESSAGE) {
        toast.error(`Too many files. Maximum is ${MAX_FILES_PER_MESSAGE} per message.`);
        return;
      }
      setUploading(true);
      const uploaded = await uploadFiles(files);
      if (uploaded.length > 0) onFilesUploaded(uploaded);
      setUploading(false);
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
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:text-muted-foreground hover:bg-muted disabled:opacity-30"
        title="Attach file"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
