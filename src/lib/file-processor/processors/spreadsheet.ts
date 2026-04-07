import type { ProcessedFile } from "../types";
import { MAX_TEXT_PER_FILE } from "@/lib/constants";

const MAX_ROWS_PER_SHEET = 1000;

export async function processSpreadsheet(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<ProcessedFile> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  let textContent: string;
  let truncated = false;
  let note: string | undefined;

  if (ext === "csv" || ext === "tsv") {
    textContent = buffer.toString("utf-8");
  } else {
    // .xlsx, .xls
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheets: string[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        // Strip trailing commas from each row (empty columns beyond data range)
        const rows = csv
          .split("\n")
          .map((row) => row.replace(/,+$/, ""))
          .filter((row) => row.length > 0);

        if (rows.length > MAX_ROWS_PER_SHEET) {
          const truncatedCsv = rows.slice(0, MAX_ROWS_PER_SHEET).join("\n");
          sheets.push(
            `--- Sheet: ${sheetName} (${rows.length} rows, showing first ${MAX_ROWS_PER_SHEET}) ---\n${truncatedCsv}`
          );
          truncated = true;
        } else {
          sheets.push(`--- Sheet: ${sheetName} (${rows.length} rows) ---\n${rows.join("\n")}`);
        }
      }

      textContent = sheets.join("\n\n");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      textContent = `Spreadsheet: ${filename}`;
      note = `Failed to read spreadsheet: ${msg}`;
    }
  }

  if (textContent.length > MAX_TEXT_PER_FILE) {
    textContent = textContent.slice(0, MAX_TEXT_PER_FILE);
    truncated = true;
    textContent += "\n\n[Content truncated due to length]";
  }

  return {
    fileType: "spreadsheet",
    originalName: filename,
    mimeType,
    size: buffer.length,
    textContent,
    truncated,
    note,
    display: { icon: "spreadsheet", label: ext.toUpperCase() },
  };
}
