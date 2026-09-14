// Parses the biometrics machine's exported PDF ("Casual, COS and Others -
// Attendance Log ...") into raw punches. The export is a fixed-column table
// (Department | Name | No. | Date/Time) rendered as one text item per column
// at consistent x-positions — confirmed against a real sample export — so
// columns are read by x-position rather than guessed from whitespace, which
// would break on multi-word departments and "Last, First M." names.
import { getDocumentProxy, extractTextItems } from "unpdf";

export type RawPunch = {
  rawDept: string;
  rawName: string;
  rawNo: string;
  timestamp: Date;
};

// Column x-positions from the real export, with slack for minor drift
// between PDF generator versions.
const COLUMNS = [
  { key: "rawDept", x: 56.4 },
  { key: "rawName", x: 212.48 },
  { key: "rawNo", x: 340.5 },
  { key: "rawDateTime", x: 368.53 },
] as const;
const COLUMN_TOLERANCE = 15;

const DATE_TIME_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/;

function columnForX(x: number): (typeof COLUMNS)[number]["key"] | null {
  for (const col of COLUMNS) {
    if (Math.abs(x - col.x) <= COLUMN_TOLERANCE) return col.key;
  }
  return null;
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

  for (const pageItems of items) {
    // Group items into rows by y-position — every real data row places all
    // four columns at the exact same y, one row per punch.
    const rows = new Map<number, Map<string, string>>();
    for (const item of pageItems) {
      const str = item.str.trim();
      if (!str) continue;
      const col = columnForX(item.x);
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

      if (rawDateTime === "Date/Time") continue; // header row
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
