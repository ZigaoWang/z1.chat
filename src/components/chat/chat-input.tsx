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
    // Grow naturally, cap at 240px
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
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
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {files.map((file, i) => (
                <div key={i} className={`flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/30 px-2 py-1 text-xs text-muted-foreground ${file.uploading ? "animate-pulse" : ""}`}>
                  {file.uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : file.isImage ? ((file.dataUrl || file.url) ? <img src={file.dataUrl || file.url} alt={file.name} className="h-7 w-7 rounded object-cover" /> : <ImageIcon className="h-3.5 w-3.5" />) : <FileText className="h-3.5 w-3.5" />}
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  {!file.uploading && (
                    <button type="button" onClick={() => onFilesChange(files.filter((_, j) => j !== i))} className="ml-0.5 rounded-full p-0.5 text-muted-foreground/30 hover:text-foreground"><X className="h-3 w-3" /></button>
                  )}
                </div>
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
            className="block w-full resize-none overflow-hidden bg-transparent px-3.5 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/40 disabled:opacity-50"
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
