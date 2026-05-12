export type FileType =
  | "image"
  | "pdf"
  | "document"
  | "presentation"
  | "text"
  | "spreadsheet"
  | "data"
  | "code"
  | "archive"
  | "unknown";

export interface ImageData {
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface DisplayInfo {
  icon: FileType;
  label: string;
}

export interface ProcessedFile {
  fileType: FileType;
  originalName: string;
  mimeType: string;
  size: number;
  /** Extracted text content (for non-image files) */
  textContent?: string;
  /** Image data URL (for image files) */
  imageData?: ImageData;
  /** Page images for short PDFs rendered as images */
  pageImages?: ImageData[];
  /** Display metadata */
  display: DisplayInfo;
  /** Whether content was truncated */
  truncated?: boolean;
  /** Processing notes (e.g. "scanned PDF", "password-protected") */
  note?: string;
}
