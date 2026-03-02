/**
 * read_xlsx — Read Excel/spreadsheet files.
 * Supports: .xlsx, .xls, .xlsm, .xlsb, .ods
 * Uses exceljs for reading.
 */

import { z } from "zod";
import ExcelJS from "exceljs";
import { statSync } from "fs";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const readXlsxSchema = {
  file_path: z.string().describe("Path to the spreadsheet file"),
  sheet_name: z
    .string()
    .optional()
    .describe('Sheet name to read (use "__all__" for all sheets)'),
  range: z
    .string()
    .optional()
    .describe("Cell range to read (e.g. A1:D10)"),
  headers: z
    .boolean()
    .default(false)
    .describe("Treat first row as headers and return objects"),
  max_rows: z
    .number()
    .int()
    .default(10000)
    .describe("Maximum rows to return"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCellRef(ref: string): { col: number; row: number } {
  const match = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!match) throw new Error(`Invalid cell reference: ${ref}`);
  const letters = match[1]!.toUpperCase();
  const row = parseInt(match[2]!, 10);
  let col = 0;
  for (const ch of letters) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return { col, row };
}

function parseCellRange(range: string): {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
} {
  const [startRef, endRef] = range.split(":");
  const start = parseCellRef(startRef!);
  const end = endRef ? parseCellRef(endRef) : start;
  return {
    startRow: start.row,
    startCol: start.col,
    endRow: end.row,
    endCol: end.col,
  };
}

function cellToJson(cell: ExcelJS.Cell): any {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && "result" in v) return (v as any).result; // formula
  if (typeof v === "object" && "richText" in v) {
    return (v as any).richText.map((r: any) => r.text).join("");
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function readXlsx(args: {
  file_path: string;
  sheet_name?: string;
  range?: string;
  headers?: boolean;
  max_rows?: number;
}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(args.file_path);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const maxRows = args.max_rows ?? 10000;
  const fileSize = statSync(args.file_path).size;

  const readAll = args.sheet_name === "__all__";
  const targetSheets = readAll
    ? workbook.worksheets
    : [
        workbook.worksheets.find((ws) => ws.name === (args.sheet_name ?? sheetNames[0])) ??
          (() => {
            throw new Error(
              `Sheet "${args.sheet_name}" not found. Available: ${sheetNames.join(", ")}`,
            );
          })(),
      ];

  const result: Record<string, any> = {
    success: true,
    file_path: args.file_path,
    file_size_bytes: fileSize,
    sheet_names: sheetNames,
  };

  if (readAll) {
    result.sheets = {};
    for (const ws of targetSheets) {
      result.sheets[ws.name] = extractSheetData(ws, args.range, args.headers, maxRows);
    }
  } else {
    const ws = targetSheets[0]!;
    result.sheet_name = ws.name;
    const extracted = extractSheetData(ws, args.range, args.headers, maxRows);
    result.data = extracted.data;
    if (extracted.headers) result.headers = extracted.headers;
  }

  return result;
}

function extractSheetData(
  ws: ExcelJS.Worksheet,
  range?: string,
  useHeaders?: boolean,
  maxRows?: number,
) {
  let startRow = 1;
  let endRow = ws.rowCount;
  let startCol = 1;
  let endCol = ws.columnCount;

  if (range) {
    const r = parseCellRange(range);
    startRow = r.startRow;
    endRow = r.endRow;
    startCol = r.startCol;
    endCol = r.endCol;
  }

  const rows: any[][] = [];
  const limit = maxRows ?? 10000;

  for (let ri = startRow; ri <= Math.min(endRow, startRow + limit - 1); ri++) {
    const row = ws.getRow(ri);
    const cells: any[] = [];
    for (let ci = startCol; ci <= endCol; ci++) {
      cells.push(cellToJson(row.getCell(ci)));
    }
    rows.push(cells);
  }

  if (useHeaders && rows.length > 0) {
    const headerRow = rows[0]!.map(String);
    const dataRows = rows.slice(1).map((r) => {
      const obj: Record<string, any> = {};
      headerRow.forEach((h, i) => {
        obj[h] = r[i] ?? null;
      });
      return obj;
    });
    return { headers: headerRow, data: dataRows };
  }

  return { data: rows };
}
