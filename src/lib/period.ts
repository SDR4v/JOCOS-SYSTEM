// Half-month period helpers. JOCOS reports run 1st half (1–15) and 2nd half
// (16–end of month), per employee, matching the source DTR sheet.

export type Half = 1 | 2;

export type PeriodRange = {
  start: Date;
  end: Date;
  dates: Date[];
};

export function getHalfMonthRange(year: number, month: number, half: Half): PeriodRange {
  const start =
    half === 1 ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, month - 1, 16));
  const end =
    half === 1 ? new Date(Date.UTC(year, month - 1, 15)) : new Date(Date.UTC(year, month, 0));

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { start, end, dates };
}

export function getMonthRange(year: number, month: number): PeriodRange {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { start, end, dates };
}

export function datesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });
}

export function halfLabel(half: Half): string {
  return half === 1 ? "1st half (1–15)" : "2nd half (16–end)";
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
