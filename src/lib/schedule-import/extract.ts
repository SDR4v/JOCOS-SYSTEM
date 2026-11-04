// Turns an uploaded file into plain grids of text. Everything format-specific
// lives here: spreadsheets, Word tables, and PDFs all come out the same shape,
// with merged cells already expanded (a "8-5" merged across Mon-Fri reads as
// five separate cells), so the layout detection never special-cases a format.
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { getDocumentProxy, extractTextItems } from "unpdf";
import type { Grid } from "@/lib/schedule-import/types";

export class UnreadableFileError extends Error {}

const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xlsm", "xls", "xlsb", "ods", "csv", "tsv"]);
export const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".ods", ".csv", ".docx", ".pdf"];

const MAX_SHEETS = 40;
const MAX_ROWS_PER_SHEET = 1000;
const MAX_XML_BYTES = 50 * 1024 * 1024;

function trimGrid(cells: string[][]): string[][] {
  const width = cells.reduce((max, row) => Math.max(max, row.length), 0);
  return cells.map((row) => {
    const padded = row.map((c) => c.trim());
    while (padded.length < width) padded.push("");
    return padded;
  });
}

// ── Spreadsheets ─────────────────────────────────────────────────

function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v === undefined || cell.v === null) return "";
  // A real date cell whatever its display format; time-only cells carry a date
  // around 1899 and keep their displayed "8:00 AM" text instead.
  if (cell.v instanceof Date && cell.v.getUTCFullYear() >= 2000) {
    return cell.v.toISOString().slice(0, 10);
  }
  if (cell.w !== undefined) return String(cell.w);
  return cell.v instanceof Date ? "" : String(cell.v);
}

function readSpreadsheet(buffer: Buffer, isDelimitedText: boolean): Grid[] {
  // `raw` only affects text formats: without it the CSV reader itself turns
  // "8-5" into August 5, before anything here gets to see what was typed.
  const workbook = XLSX.read(buffer, { cellDates: true, sheetRows: MAX_ROWS_PER_SHEET, raw: isDelimitedText });
  const grids: Grid[] = [];
  for (const name of workbook.SheetNames.slice(0, MAX_SHEETS)) {
    const sheet = workbook.Sheets[name];
    if (!sheet?.["!ref"]) continue;
    // Hidden tabs are usually an office's own lookup lists, not the schedule.
    const meta = workbook.Workbook?.Sheets?.find((s) => s.name === name);
    if (meta?.Hidden) continue;

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    const cells: string[][] = [];
    for (let r = range.s.r; r <= range.e.r; r++) {
      const row: string[] = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })]));
      }
      cells.push(row);
    }
    for (const merge of sheet["!merges"] ?? []) {
      const value = cellText(sheet[XLSX.utils.encode_cell(merge.s)]);
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          const row = cells[r - range.s.r];
          if (row && c - range.s.c < row.length) row[c - range.s.c] = value;
        }
      }
    }
    grids.push({ name, cells: trimGrid(cells) });
  }
  return grids;
}

// ── Word (.docx) ─────────────────────────────────────────────────

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function paragraphText(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g)) {
    if (m[1] !== undefined) out += decodeXml(m[1]);
    else out += m[0].startsWith("<w:tab") ? "\t" : "\n";
  }
  return out;
}

function readDocx(buffer: Buffer): Grid[] {
  let xml: string;
  try {
    const files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => f.name === "word/document.xml" && f.originalSize <= MAX_XML_BYTES,
    });
    const entry = files["word/document.xml"];
    if (!entry) throw new Error("missing");
    xml = strFromU8(entry);
  } catch {
    throw new UnreadableFileError("This Word file couldn't be opened. Try saving it again as .docx.");
  }

  const grids: Grid[] = [];
  const tableRe = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
  let tableNumber = 0;
  for (const table of xml.match(tableRe) ?? []) {
    tableNumber++;
    const cells: string[][] = [];
    for (const rowXml of table.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) ?? []) {
      const row: string[] = [];
      for (const cellXml of rowXml.match(/<w:tc>[\s\S]*?<\/w:tc>|<w:tc\s[\s\S]*?<\/w:tc>/g) ?? []) {
        const span = Number(/<w:gridSpan\s+w:val="(\d+)"/.exec(cellXml)?.[1] ?? 1);
        const paragraphs = (cellXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? []).map(paragraphText).filter((t) => t.trim());
        let text = paragraphs.join("\n");
        // A vertical merge's continuation cell has no text of its own.
        if (/<w:vMerge(?:\s*\/>|\s+w:val="continue")/.test(cellXml) && !text) {
          text = cells[cells.length - 1]?.[row.length] ?? "";
        }
        for (let i = 0; i < span; i++) row.push(text);
      }
      cells.push(row);
    }
    grids.push({ name: `Table ${tableNumber}`, cells: trimGrid(cells) });
  }

  // Text outside any table can still hold the schedule ("Juan Dela Cruz<tab>Mon-Fri<tab>8-5")
  // or the legend and the month's title.
  const body = xml.replace(tableRe, "");
  const lines = (body.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [])
    .map(paragraphText)
    .filter((t) => t.trim())
    .map((t) => t.split(/\t+/));
  if (lines.length > 0) grids.push({ name: "Text", cells: trimGrid(lines) });
  return grids;
}

// ── PDF ──────────────────────────────────────────────────────────

type PositionedItem = { str: string; x: number; y: number; width: number };

// A PDF has no table, only text at positions. Items that share a baseline form
// a row; the columns come from the row with the most separate items (nearly
// always the date header), and every other item goes to whichever column its
// center sits nearest, which handles centered and left-aligned text alike.
function gridFromPage(items: PositionedItem[]): string[][] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedItem[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - item.y) <= 3) row.push(item);
    else rows.push([item]);
  }
  if (rows.length === 0) return [];

  const center = (i: PositionedItem) => i.x + i.width / 2;
  const widest = rows.reduce((best, row) => (row.length > best.length ? row : best), rows[0]);
  const columns = widest.map(center).sort((a, b) => a - b);

  return rows.map((row) => {
    const out: string[] = new Array(columns.length).fill("");
    for (const item of row.sort((a, b) => a.x - b.x)) {
      let best = 0;
      for (let c = 1; c < columns.length; c++) {
        if (Math.abs(columns[c] - center(item)) < Math.abs(columns[best] - center(item))) best = c;
      }
      out[best] = out[best] ? `${out[best]} ${item.str.trim()}` : item.str.trim();
    }
    return out;
  });
}

async function readPdf(buffer: Buffer): Promise<Grid[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { items } = await extractTextItems(pdf);
  const grids: Grid[] = [];
  items.forEach((pageItems, i) => {
    const cells = gridFromPage(pageItems as PositionedItem[]);
    if (cells.length > 0) grids.push({ name: `Page ${i + 1}`, cells: trimGrid(cells) });
  });
  if (grids.length === 0) {
    throw new UnreadableFileError(
      "This PDF is a scanned picture with no text in it, so it can't be read. Please upload the original Excel or Word file, or fill in the template below.",
    );
  }
  return grids;
}

// ── Entry point ──────────────────────────────────────────────────

export async function extractGrids(filename: string, buffer: Buffer): Promise<Grid[]> {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    try {
      return readSpreadsheet(buffer, extension === "csv" || extension === "tsv");
    } catch {
      throw new UnreadableFileError("This spreadsheet couldn't be opened. It may be damaged or password-protected.");
    }
  }
  if (extension === "docx") return readDocx(buffer);
  if (extension === "pdf") {
    try {
      return await readPdf(buffer);
    } catch (error) {
      if (error instanceof UnreadableFileError) throw error;
      throw new UnreadableFileError("This PDF couldn't be opened. It may be damaged or password-protected.");
    }
  }
  if (extension === "doc") {
    throw new UnreadableFileError("Old .doc files can't be read. In Word, use Save As and choose .docx, then upload that.");
  }
  if (["jpg", "jpeg", "png", "heic", "webp"].includes(extension)) {
    throw new UnreadableFileError(
      "Photos can't be read. Please upload the original Excel or Word file, or fill in the template below.",
    );
  }
  throw new UnreadableFileError(`Unsupported file type. Upload one of: ${ACCEPTED_EXTENSIONS.join(", ")}.`);
}

// A ready-to-fill schedule for one office and month — the guaranteed path when
// an office has nothing of its own, or its file can't be read.
export function buildTemplateWorkbook(office: string, year: number, month: number, names: string[]): Buffer {
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const weekdayLabel = (day: number) =>
    new Date(Date.UTC(year, month - 1, day)).toLocaleString("en-US", { weekday: "short", timeZone: "UTC" });

  const rows: (string | number)[][] = [
    [`${office} — Schedule for ${monthName} ${year}`],
    [],
    ["", ...days.map(weekdayLabel)],
    ["Name", ...days],
    ...names.map((name) => [name]),
    [],
    ["How to fill this in: type the hours in each day's cell, such as 8-5 or 10PM-6AM. Type OFF for a day off."],
    ["You can also use your own codes if you list them here, for example:"],
    ["A = 8:00 AM - 5:00 PM"],
    ["N = 10:00 PM - 6:00 AM"],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 34 }, ...days.map(() => ({ wch: 7 }))];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, `${monthName} ${year}`.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
