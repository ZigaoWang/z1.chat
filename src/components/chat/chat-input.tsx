"use client";

import { useRef, useEffect, KeyboardEvent, useCallback } from "react";
import { ArrowUp, Square, X, FileText, Image as ImageIcon, Pencil, Loader2 } from "lucide-react";
import FileUpload, { type UploadedFile, uploadFiles } from "./file-upload";
import { useI18n } from "@/hooks/use-i18n";

interface EditingState {
  messageIndex: number;
  originalContent: string;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onEditLastMessage?: () => void;
  editing?: EditingState | null;
  onCancelEdit?: () => void;
  onSubmitEdit?: () => void;
}

export type { EditingState };

export default function ChatInput({
  value, onChange, onSubmit, onStop, isLoading, disabled,
  placeholder = "What's on your mind?", files, onFilesChange, onEditLastMessage,
  editing, onCancelEdit, onSubmitEdit,
}: ChatInputProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxH = 240;
    const h = Math.min(ta.scrollHeight, maxH);
    ta.style.height = `${h}px`;
    ta.style.overflowY = ta.scrollHeight > maxH ? "auto" : "hidden";
  }, [value]);

  useEffect(() => { if (!isLoading) textareaRef.current?.focus(); }, [isLoading]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const hasContent = value.trim().length > 0 || files.length > 0;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't submit during IME composition (中文、日本語 etc.)
    if (composingRef.current) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editing) {
        if (value.trim() && value.trim() !== editing.originalContent && onSubmitEdit) {
          onSubmitEdit();
        }
      } else if (!isLoading && hasContent) {
        onSubmit();
      }
    }
    if (e.key === "Escape" && editing && onCancelEdit) {
      e.preventDefault();
      onCancelEdit();
    }
    if (e.key === "ArrowUp" && !value && !editing && onEditLastMessage) {
      e.preventDefault();
      onEditLastMessage();
    }
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file") { const f = item.getAsFile(); if (f) pastedFiles.push(f); }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      const placeholders: UploadedFile[] = pastedFiles.map(f => ({
        url: "",
        name: f.name,
        type: f.type,
        size: f.size,
        isImage: f.type.startsWith("image/"),
        uploading: true,
      }));
      onFilesChange([...files, ...placeholders]);
      const uploaded = await uploadFiles(pastedFiles);
      onFilesChange([...files.filter(x => !x.uploading), ...uploaded]);
      return;
    }

    // Long text paste → convert to file chip
    const pastedText = e.clipboardData?.getData("text/plain");
    if (pastedText && pastedText.length > 500) {
      e.preventDefault();
      const pastedFile: UploadedFile = {
        url: "",
        name: "Pasted text",
        type: "text/plain",
        size: pastedText.length,
        isImage: false,
        textContent: pastedText,
      };
      onFilesChange([...files, pastedFile]);
    }
  }, [files, onFilesChange]);

  const canSubmit = !disabled && (isLoading || hasContent);
  const isEditChanged = editing ? value.trim() !== editing.originalContent && value.trim().length > 0 : false;

  return (
    <div className="shrink-0 bg-background px-3 md:px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto w-full max-w-3xl">
        {/* Editing banner */}
        {editing && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-2xl border border-b-0 border-border/60 bg-muted/30 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" />
            <span>{t("chat.editingMessage")}</span>
            <button onClick={onCancelEdit} className="ml-auto p-0.5 rounded hover:bg-muted hover:text-foreground transition-colors">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className={`border border-border/60 bg-background shadow-sm transition-all duration-200 focus-within:border-border focus-within:ring-2 focus-within:ring-ring/10 focus-within:shadow-md ${editing ? "rounded-b-2xl" : "rounded-2xl"}`}>
          {/* File previews */}
          {files.length > 0 && !editing && (
            <div className="flex flex-wrap gap-2 px-3.5 pt-3">
              {files.map((file, i) => (
                file.textContent ? (
                  <div key={i} className="relative flex flex-col gap-1.5 rounded-lg border border-border/40 bg-muted/20 p-2.5 w-[180px]">
                    <p className="text-[11px] leading-tight text-muted-foreground/70 line-clamp-6 whitespace-pre-wrap break-words">{file.textContent.slice(0, 200)}</p>
                    <span className="inline-flex w-fit rounded border border-border/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">Pasted</span>
                    <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div key={i} className={`relative flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-sm text-muted-foreground ${file.uploading ? "animate-pulse" : ""}`}>
                    {file.uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : file.isImage ? ((file.dataUrl || file.url) ? <img src={file.dataUrl || file.url} alt={file.name} className="h-9 w-9 rounded-md object-cover" /> : <ImageIcon className="h-4 w-4" />) : <FileText className="h-4 w-4 text-muted-foreground/50" />}
                    <span className="max-w-[140px] truncate text-[13px]">{file.name}</span>
                    {!file.uploading && (
                      <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80"><X className="h-3 w-3" /></button>
                    )}
                  </div>
                )
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            onPaste={handlePaste}
            placeholder={editing ? t("chat.editMessage") : placeholder}
            disabled={disabled}
            rows={1}
            className="block w-full resize-none bg-transparent px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
          />

          {/* Action bar below textarea */}
          <div className="flex items-center justify-between px-2.5 pb-2.5">
            {editing ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                {t("chat.cancel")}
              </button>
            ) : (
              <div className="flex items-center justify-center">
                <FileUpload
                  onFilesUploaded={(f) => {
                    // Replace placeholders with real files
                    onFilesChange([...files.filter(x => !x.uploading), ...f]);
                  }}
                  onUploadStart={(placeholders) => {
                    onFilesChange([...files, ...placeholders]);
                  }}
                  disabled={disabled || isLoading}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (editing) {
                  if (isEditChanged && onSubmitEdit) onSubmitEdit();
                } else if (isLoading && onStop) {
                  onStop();
                } else if (hasContent) {
                  onSubmit();
                }
              }}
              disabled={editing ? !isEditChanged : !canSubmit}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 active:scale-95 ${
                isLoading && !editing ? "bg-foreground text-background hover:bg-foreground/80" :
                (editing ? isEditChanged : hasContent) ? "bg-foreground text-background hover:bg-foreground/80" :
                "bg-muted text-muted-foreground/30"
              } disabled:opacity-10`}
            >
              {isLoading && !editing ? <Square className="h-3.5 w-3.5 fill-current" /> : <ArrowUp className="h-4.5 w-4.5 stroke-[2.5]" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
