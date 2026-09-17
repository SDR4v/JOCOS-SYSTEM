// Parses the biometrics machine's exported PDF into raw punches. The export
// is a fixed-column table (Name | No. | Date/Time, sometimes with a leading
// Department column depending on the report variant — e.g. "Casual, COS and
// Others - Attendance Log" vs "All Employees") rendered as one text item per
// column — so columns are read by x-position rather than guessed from
// whitespace, which would break on multi-word departments and "Last, First
// M." names. Column x-positions differ between report variants (and
// presumably PDF generator versions), so they're detected per page from that
// page's own header row rather than hardcoded — a page with no header of its
// own (headers don't necessarily repeat on every page) carries forward the
// last page's detected positions, and pages before any header is seen fall
// back to positions from a real "Casual, COS and Others" sample export.
import { getDocumentProxy, extractTextItems } from "unpdf";

export type RawPunch = {
  rawDept: string;
  rawName: string;
  rawNo: string;
  timestamp: Date;
};

type ColumnKey = "rawDept" | "rawName" | "rawNo" | "rawDateTime";

const HEADER_LABELS: { key: ColumnKey; label: string }[] = [
  { key: "rawDept", label: "department" },
  { key: "rawName", label: "name" },
  { key: "rawNo", label: "no." },
  { key: "rawDateTime", label: "date/time" },
];

// Fallback column x-positions from a real "Casual, COS and Others" sample
// export, used only until a header row is seen (or when a PDF has none).
const DEFAULT_COLUMNS: Record<ColumnKey, number> = {
  rawDept: 56.4,
  rawName: 212.48,
  rawNo: 340.5,
  rawDateTime: 368.53,
};
const COLUMN_TOLERANCE = 15;

const DATE_TIME_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/;

function detectHeaderColumns(pageItems: { str: string; x: number }[]): Partial<Record<ColumnKey, number>> {
  const found: Partial<Record<ColumnKey, number>> = {};
  for (const item of pageItems) {
    const normalized = item.str.trim().toLowerCase();
    const match = HEADER_LABELS.find((h) => h.label === normalized);
    if (match) found[match.key] = item.x;
  }
  return found;
}

function columnForX(x: number, columns: Record<ColumnKey, number>): ColumnKey | null {
  let best: ColumnKey | null = null;
  let bestDist = Infinity;
  for (const key of Object.keys(columns) as ColumnKey[]) {
    const dist = Math.abs(x - columns[key]);
    if (dist <= COLUMN_TOLERANCE && dist < bestDist) {
      best = key;
      bestDist = dist;
    }
  }
  return best;
}

// The export has no timezone info — treated as plain wall-clock time, same
// convention as the rest of the DTR (see combineDateAndTime in dtr-time.ts).
function parseDateTime(raw: string): Date | null {
  const match = DATE_TIME_RE.exec(raw.trim());
  if (!match) return null;
  const [, monthStr, dayStr, yearStr, hourStr, minuteStr, secondStr, meridiem] = match;
  let hour = Number(hourStr) % 12;
  if (meridiem === "PM") hour += 12;
  return new Date(
    Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), hour, Number(minuteStr), Number(secondStr)),
  );
}

export async function parseBiometricPdf(
  buffer: Buffer,
): Promise<{ punches: RawPunch[]; unparsedLines: number; droppedRows: number }> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { items } = await extractTextItems(pdf);

  const punches: RawPunch[] = [];
  let unparsedLines = 0;
  let droppedRows = 0;
  let activeColumns: Record<ColumnKey, number> = { ...DEFAULT_COLUMNS };

  for (const pageItems of items) {
    // Headers don't necessarily repeat on every page — when this page has
    // one, adopt its positions (only the columns it actually shows; a
    // variant with no Department column simply never overrides that key, so
    // it never matches any real item either); otherwise keep whatever the
    // last page with a header established.
    const headerColumns = detectHeaderColumns(pageItems);
    if (Object.keys(headerColumns).length > 0) {
      activeColumns = { ...activeColumns, ...headerColumns };
    }

    // Group items into rows by y-position — every real data row places all
    // columns at the exact same y, one row per punch.
    const rows = new Map<number, Map<string, string>>();
    for (const item of pageItems) {
      const str = item.str.trim();
      if (!str) continue;
      const col = columnForX(item.x, activeColumns);
      if (!col) continue; // title/footer text sits outside the table columns
      const y = Math.round(item.y * 10) / 10;
      const row = rows.get(y) ?? new Map<string, string>();
      row.set(col, str);
      rows.set(y, row);
    }

    for (const row of rows.values()) {
      let rawDateTime = row.get("rawDateTime");
      let rawNo = row.get("rawNo");
      const rawDept = row.get("rawDept");
      const rawName = row.get("rawName");

      // A device "No." with 4+ digits sometimes renders as one continuous
      // PDF text run together with the Date/Time that follows it — no
      // separate text-positioning command between them — instead of the
      // usual two separate columns. Confirmed against a real export: this
      // alone silently dropped over a third of a 15-day file's punches,
      // every one belonging to someone with a 4-digit device number, before
      // this split existed.
      if (!rawDateTime && rawNo) {
        const merged = /^(\d+)\s+(.+)$/.exec(rawNo);
        if (merged) {
          rawNo = merged[1];
          rawDateTime = merged[2];
        }
      }

      if (rawDateTime?.trim().toLowerCase() === "date/time") continue; // header row
      if (!rawDateTime || !rawNo || !rawName) {
        if (rawDateTime || rawNo || rawName) droppedRows++; // a genuine partial row, not just page chrome
        continue;
      }
      const timestamp = parseDateTime(rawDateTime);
      if (!timestamp) {
        unparsedLines++;
        continue;
      }
      punches.push({ rawDept: rawDept ?? "", rawName, rawNo, timestamp });
    }
  }

  punches.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return { punches, unparsedLines, droppedRows };
}
