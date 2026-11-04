// Works out what's in a schedule without being told its template. Column
// positions and headers differ between offices, but the VALUES don't: every
// schedule pairs people from the roster with dates and shifts. So each layout
// reader below looks for those values wherever they sit, and every reader gets
// a try — on the table as given and flipped on its side — with the one that
// recognises the most real employees winning. Nothing here writes anything;
// the result is a draft a person reviews before it counts.
import { NameResolver, looksLikeName, type RosterEmployee } from "@/lib/schedule-import/names";
import {
  extractTimeText,
  normalizeTokenKey,
  parseShiftText,
  type Shift,
} from "@/lib/schedule-import/shift-text";
import {
  BLANK_TOKEN,
  type Grid,
  type LayoutKind,
  type ReviewRow,
  type ScheduleDocument,
  type TokenReading,
} from "@/lib/schedule-import/types";

export type DetectInput = {
  grids: Grid[];
  year: number;
  month: number;
  officeEmployees: RosterEmployee[];
  allEmployees: RosterEmployee[];
  // What this office's codes meant last time — see ScheduleShiftCode.
  remembered: Map<string, Shift>;
};

export type DetectResult = { ok: true; document: ScheduleDocument } | { ok: false; reason: string };

type Entry = { rawName: string; cells: Map<string, string> };
type Candidate = { layout: LayoutKind; entries: Entry[]; covered: Set<string>; warnings: string[] };

type Ctx = {
  year: number;
  month: number;
  daysInMonth: number;
  resolver: NameResolver;
  isos: string[];
  isoFor: (day: number) => string;
};

// ── Dates and weekdays ───────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(word: string): number | null {
  const i = MONTHS.indexOf(word.toLowerCase().slice(0, 3));
  return i >= 0 ? i + 1 : null;
}

const WEEKDAY_WORDS: Record<string, number> = {
  su: 0, sun: 0, sunday: 0, m: 1, mo: 1, mon: 1, monday: 1, t: 2, tu: 2, tue: 2, tues: 2, tuesday: 2,
  w: 3, we: 3, wed: 3, weds: 3, wednesday: 3, th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4,
  f: 5, fr: 5, fri: 5, friday: 5, sa: 6, sat: 6, saturday: 6,
};

type DayCell = { day: number; otherMonth: boolean };

// A date cell written any common way. A bare "3" is only a day number in the
// context of a run of them — see dayHeaderColumns.
function parseFullDate(raw: string, ctx: Ctx): DayCell | null {
  const text = raw.trim().toLowerCase().replace(/\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\b[.,]?/g, "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (m) return { day: Number(m[3]), otherMonth: Number(m[2]) !== ctx.month || Number(m[1]) !== ctx.year };
  // Hyphens only with a year: on its own, "11-7" is hours far more often than
  // it's November 7th.
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(text) ?? /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(text);
  if (m) {
    const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ctx.year;
    return { day: Number(m[2]), otherMonth: Number(m[1]) !== ctx.month || year !== ctx.year };
  }
  m = /^([a-z]{3,9})\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/.exec(text);
  if (m && monthIndex(m[1])) {
    return { day: Number(m[2]), otherMonth: monthIndex(m[1]) !== ctx.month || (!!m[3] && Number(m[3]) !== ctx.year) };
  }
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]*([a-z]{3,9})\.?(?:[\s,-]*(\d{2,4}))?$/.exec(text);
  if (m && monthIndex(m[2])) {
    return { day: Number(m[1]), otherMonth: monthIndex(m[2]) !== ctx.month };
  }
  return null;
}

// "3", "03", "3rd", "Mon 3", "3 Mon", "3-Mon".
function parseBareDay(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  const m =
    /^(\d{1,2})(?:st|nd|rd|th)?$/.exec(text) ??
    /^[a-z]{1,9}\.?[\s-]+(\d{1,2})$/.exec(text) ??
    /^(\d{1,2})[\s-]+[a-z]{1,9}\.?$/.exec(text);
  if (!m) return null;
  const words = text.replace(/[\d\s.-]/g, "");
  if (words && !(words in WEEKDAY_WORDS) && !/^(?:st|nd|rd|th)$/.test(words)) return null;
  const day = Number(m[1]);
  return day >= 1 && day <= 31 ? day : null;
}

// Column → the dates that column stands for, if this row is a date header.
function dayHeaderColumns(row: string[], ctx: Ctx): Map<number, string[]> | null {
  const columns = new Map<number, string[]>();
  let fullDates = 0;
  for (let c = 0; c < row.length; c++) {
    const full = parseFullDate(row[c], ctx);
    if (full && !full.otherMonth && full.day <= ctx.daysInMonth) {
      columns.set(c, [ctx.isoFor(full.day)]);
      fullDates++;
    }
  }
  // Mostly dates, or a birthdate column read sideways would pass as a header.
  if (fullDates >= 2 && fullDates >= row.filter(Boolean).length / 5) return columns;

  // Bare numbers only count as a run of consecutive days, or any row of
  // numbers (staff IDs, totals) would read as a header.
  let bestRun: [number, number][] = [];
  let run: [number, number][] = [];
  for (let c = 0; c < row.length; c++) {
    const day = parseBareDay(row[c]);
    if (day !== null && day <= ctx.daysInMonth && (run.length === 0 || run[run.length - 1][1] + 1 === day)) {
      run.push([c, day]);
    } else if (!row[c] && run.length > 0) {
      continue; // an empty spacer column inside the run
    } else {
      run = day !== null && day <= ctx.daysInMonth ? [[c, day]] : [];
    }
    if (run.length > bestRun.length) bestRun = [...run];
  }
  if (bestRun.length < 5) return null;
  return new Map(bestRun.map(([c, day]) => [c, [ctx.isoFor(day)]]));
}

function weekdayOf(cell: string, previous: number | null, next: string | undefined): number | null {
  const word = cell.trim().toLowerCase().replace(/\.$/, "");
  if (word in WEEKDAY_WORDS) return WEEKDAY_WORDS[word];
  if (word === "s") {
    if (previous === 5) return 6;
    if (previous === 6 || next?.trim().toLowerCase().startsWith("m")) return 0;
    return null;
  }
  return null;
}

function weekdayHeaderColumns(row: string[], ctx: Ctx): Map<number, string[]> | null {
  const columns = new Map<number, number>();
  let previous: number | null = null;
  for (let c = 0; c < row.length; c++) {
    if (!row[c]) continue;
    const dow = weekdayOf(row[c], previous, row[c + 1]);
    if (dow === null) continue;
    columns.set(c, dow);
    previous = dow;
  }
  if (new Set(columns.values()).size < 3) return null;
  const result = new Map<number, string[]>();
  for (const [c, dow] of columns) {
    result.set(c, ctx.isos.filter((iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === dow));
  }
  return result;
}

// ── Which column(s) hold the name ────────────────────────────────

type NameColumns = number[];

function nameFromColumns(row: string[], columns: NameColumns): string {
  const parts = columns.map((c) => row[c] ?? "").filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts[0]}, ${parts.slice(1).join(" ")}`; // separate Last / First / M.I. columns
}

function findNameColumns(rows: string[][], excluded: Set<number>, ctx: Ctx): NameColumns | null {
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  let best: { columns: NameColumns; hits: number } | null = null;
  for (let c = 0; c < width; c++) {
    if (excluded.has(c)) continue;
    for (let span = 1; span <= 3 && c + span <= width; span++) {
      const columns = Array.from({ length: span }, (_, i) => c + i);
      if (columns.some((col) => excluded.has(col))) break;
      let hits = 0;
      for (const row of rows) {
        const name = nameFromColumns(row, columns);
        if (name && looksLikeName(name) && ctx.resolver.resolve(name).employee) hits++;
      }
      if (hits > 0 && (!best || hits > best.hits)) best = { columns, hits };
    }
  }
  if (best) return best.columns;

  // Nobody recognised — maybe the wrong office was chosen. Still find the
  // likeliest column, so the review screen can say which names didn't match.
  let fallback: { column: number; count: number } | null = null;
  for (let c = 0; c < width; c++) {
    if (excluded.has(c)) continue;
    const count = rows.filter((r) => r[c] && looksLikeName(r[c])).length;
    if (count >= 2 && (!fallback || count > fallback.count)) fallback = { column: c, count };
  }
  return fallback ? [fallback.column] : null;
}

// Joins the two rows of an employee written on two lines (AM over PM, or IN
// over OUT). An identical value is one merged cell seen twice, not two sessions.
function combineCell(a: string | undefined, b: string): string {
  if (!b) return a ?? "";
  if (!a || a === b) return b;
  return `${a} / ${b}`;
}

// Excel silently turns a typed "8-5" into the date August 5, shown as "5-Aug".
// Inside the body of a schedule a date can't be anything but that mangled shift,
// so it's turned back into what was typed. The review screen still lists it.
function undoExcelDateMangling(cell: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(cell);
  return m ? `${Number(m[1])}-${Number(m[2])}` : cell;
}

// ── Layout: employee rows × date/weekday columns ─────────────────

function readColumnsLayout(grid: Grid, ctx: Ctx): Candidate | null {
  const headers: { row: number; columns: Map<number, string[]>; layout: LayoutKind }[] = [];
  grid.cells.forEach((row, r) => {
    const days = dayHeaderColumns(row, ctx);
    if (days) headers.push({ row: r, columns: days, layout: "matrix" });
  });
  if (headers.length === 0) {
    grid.cells.forEach((row, r) => {
      const weekdays = weekdayHeaderColumns(row, ctx);
      if (weekdays) headers.push({ row: r, columns: weekdays, layout: "weekly" });
    });
  }
  if (headers.length === 0) return null;

  const warnings: string[] = [];
  const entries: Entry[] = [];
  const covered = new Set<string>();

  // The file's own weekday labels against the chosen month's real calendar —
  // the fastest way to catch a schedule uploaded under the wrong month.
  if (headers[0].layout === "matrix") {
    let compared = 0;
    let disagreed = 0;
    for (const header of headers) {
      for (const offset of [-1, 1]) {
        const labels = grid.cells[header.row + offset];
        if (!labels) continue;
        for (const [c, isos] of header.columns) {
          const dow = labels[c] ? weekdayOf(labels[c], null, undefined) : null;
          if (dow === null) continue;
          compared++;
          if (new Date(`${isos[0]}T00:00:00Z`).getUTCDay() !== dow) disagreed++;
        }
      }
    }
    if (compared >= 5 && disagreed > compared / 2) {
      warnings.push(
        "The weekday labels in this file don't match the calendar for the month you chose. Check that you picked the right month and year.",
      );
    }
  }

  headers.forEach((header, h) => {
    const end = headers[h + 1]?.row ?? grid.cells.length;
    const dataRows = grid.cells.slice(header.row + 1, end);
    const excluded = new Set(header.columns.keys());
    const nameColumns = findNameColumns(dataRows, excluded, ctx);
    if (!nameColumns) return;
    for (const isos of header.columns.values()) for (const iso of isos) covered.add(iso);

    let previous: Entry | null = null;
    for (const rawRow of dataRows) {
      const row = rawRow.map((cell, c) => (excluded.has(c) ? undoExcelDateMangling(cell) : cell));
      const name = nameFromColumns(row, nameColumns);
      const hasCells = [...header.columns.keys()].some((c) => row[c]);

      // A continuation line: no name of its own, or the same name on the next
      // line because the name cell was merged down across both.
      const continuesPrevious = previous && hasCells && (!name || name === previous.rawName);
      if (continuesPrevious && previous) {
        for (const [c, isos] of header.columns) {
          if (!row[c]) continue;
          for (const iso of isos) previous.cells.set(iso, combineCell(previous.cells.get(iso), row[c]));
        }
        continue;
      }

      if (!name || !looksLikeName(name)) {
        previous = null;
        continue;
      }
      if (!hasCells) {
        previous = null;
        continue;
      }
      const entry: Entry = { rawName: name, cells: new Map() };
      for (const [c, isos] of header.columns) {
        if (!row[c]) continue;
        for (const iso of isos) entry.cells.set(iso, row[c]);
      }
      entries.push(entry);
      previous = entry;
    }
  });

  return { layout: headers[0].layout, entries, covered, warnings };
}

// ── Layout: one line per employee + date ─────────────────────────

const SHIFT_HEADER_RE = /shift|sched|duty|time|hours?|\bin\b|\bout\b|arrival|departure|code/i;
const NOT_SHIFT_HEADER_RE = /position|designation|remark|office|department|name|employee|no\.?$|^#/i;

// "Nov 3", "11/3/2026", or a span like "Nov 3-7" / "3-7".
function parseDateCell(raw: string, ctx: Ctx, allowBare: boolean): string[] | null {
  const full = parseFullDate(raw, ctx);
  if (full) return !full.otherMonth && full.day <= ctx.daysInMonth ? [ctx.isoFor(full.day)] : null;
  const span = /^(?:([a-z]{3,9})\.?\s+)?(\d{1,2})\s*-\s*(\d{1,2})(?:,?\s*\d{4})?$/i.exec(raw.trim());
  if (span && (span[1] ? monthIndex(span[1]) === ctx.month : allowBare)) {
    const [from, to] = [Number(span[2]), Number(span[3])];
    if (from < to && to <= ctx.daysInMonth) {
      return Array.from({ length: to - from + 1 }, (_, i) => ctx.isoFor(from + i));
    }
  }
  if (allowBare) {
    const day = parseBareDay(raw);
    if (day !== null && day <= ctx.daysInMonth) return [ctx.isoFor(day)];
  }
  return null;
}

function findDateColumn(cells: string[][], ctx: Ctx): { column: number; headerRow: number } | null {
  const width = cells.reduce((max, r) => Math.max(max, r.length), 0);
  let best: { column: number; hits: number; headerRow: number } | null = null;
  for (let c = 0; c < width; c++) {
    const hits = cells.filter((r) => r[c] && parseDateCell(r[c], ctx, false)).length;
    // A date column is mostly dates in this period. A birthdate column only
    // happens to land in the chosen month for a few people out of hundreds.
    const filled = cells.filter((r) => r[c]).length;
    if (hits >= 2 && hits >= filled / 5 && (!best || hits > best.hits)) {
      const firstHit = cells.findIndex((r) => r[c] && parseDateCell(r[c], ctx, false));
      best = { column: c, hits, headerRow: firstHit - 1 };
    }
  }
  if (best) return { column: best.column, headerRow: best.headerRow };

  // Bare day numbers count only under a header that says so.
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      if (!/^(?:date|day|days|petsa)\.?$/i.test(cells[r][c])) continue;
      const below = cells.slice(r + 1).filter((row) => row[c] && parseDateCell(row[c], ctx, true)).length;
      if (below >= 2) return { column: c, headerRow: r };
    }
  }
  return null;
}

function readListLayout(grid: Grid, ctx: Ctx): Candidate | null {
  const found = findDateColumn(grid.cells, ctx);
  if (!found) return null;
  const { column: dateColumn, headerRow } = found;
  const header = grid.cells[headerRow] ?? [];
  const rows = grid.cells.slice(headerRow + 1);

  const nameColumns = findNameColumns(rows, new Set([dateColumn]), ctx);
  if (!nameColumns) return null;

  const width = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const shiftColumns: number[] = [];
  for (let c = 0; c < width; c++) {
    if (c === dateColumn || nameColumns.includes(c)) continue;
    const label = header[c] ?? "";
    if (label && NOT_SHIFT_HEADER_RE.test(label) && !SHIFT_HEADER_RE.test(label)) continue;
    const values = rows.map((r) => r[c]).filter(Boolean);
    if (values.length === 0) continue;
    // Actual times, not just digits: ages, ID numbers, and birthdates all have
    // digits, and joining those together isn't a shift.
    const timeLike = values.filter((v) => {
      if (/\b(?:19|20)\d{2}\b/.test(v)) return false;
      const reading = parseShiftText(v);
      return !!reading.shift || reading.alternatives.length > 0 || /\d[:.]\d{2}|\d\s*[ap]\.?m\b/i.test(v);
    }).length;
    if (SHIFT_HEADER_RE.test(label) || timeLike >= values.length / 2) shiftColumns.push(c);
  }
  if (shiftColumns.length === 0) return null;

  const byName = new Map<string, Entry>();
  const covered = new Set<string>();
  let currentName = "";
  for (const row of rows) {
    const name = nameFromColumns(row, nameColumns);
    if (name && looksLikeName(name)) currentName = name;
    else if (name) currentName = "";
    const isos = row[dateColumn] ? parseDateCell(row[dateColumn], ctx, true) : null;
    if (!isos || !currentName) continue;
    const token = shiftColumns.map((c) => row[c]).filter(Boolean).join(" / ");
    if (!token) continue;
    const entry = byName.get(currentName) ?? { rawName: currentName, cells: new Map<string, string>() };
    byName.set(currentName, entry);
    for (const iso of isos) {
      entry.cells.set(iso, combineCell(entry.cells.get(iso), token));
      covered.add(iso);
    }
  }
  return { layout: "list", entries: [...byName.values()], covered, warnings: [] };
}

// ── Layout: dates down the side, names under each shift ──────────

function splitNamesInCell(cell: string, ctx: Ctx): string[] {
  if (looksLikeName(cell) && ctx.resolver.resolve(cell).employee) return [cell];
  const pieces = cell.split(/\n|;|\/|&|\band\b/i).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const piece of pieces) {
    if (looksLikeName(piece) && ctx.resolver.resolve(piece).employee) out.push(piece);
    else out.push(...piece.split(",").map((p) => p.trim()).filter(Boolean));
  }
  return out.filter(looksLikeName);
}

function readDutyRosterLayout(grid: Grid, ctx: Ctx): Candidate | null {
  const found = findDateColumn(grid.cells, ctx);
  if (!found || found.headerRow < 0) return null;
  const header = grid.cells[found.headerRow];
  const rows = grid.cells.slice(found.headerRow + 1);

  const byName = new Map<string, Entry>();
  const covered = new Set<string>();
  for (const row of rows) {
    const isos = row[found.column] ? parseDateCell(row[found.column], ctx, true) : null;
    if (!isos) continue;
    for (const iso of isos) covered.add(iso);
    for (let c = 0; c < row.length; c++) {
      if (c === found.column || !row[c] || !header[c]) continue;
      if (/^(?:names?|employees?|personnel|staff|remarks?|day|weekday|no\.?)$/i.test(header[c])) continue;
      for (const name of splitNamesInCell(row[c], ctx)) {
        if (!ctx.resolver.resolve(name).employee) continue;
        const entry = byName.get(name.toLowerCase()) ?? { rawName: name, cells: new Map<string, string>() };
        byName.set(name.toLowerCase(), entry);
        for (const iso of isos) entry.cells.set(iso, combineCell(entry.cells.get(iso), header[c]));
      }
    }
  }
  return { layout: "duty-roster", entries: [...byName.values()], covered, warnings: [] };
}

// ── Layout: one line per employee with their days and hours ──────

const DAY_SPEC_WORDS: [RegExp, number[]][] = [
  [/\b(?:daily|everyday|every day|all days)\b/, [0, 1, 2, 3, 4, 5, 6]],
  [/\bweekdays?\b/, [1, 2, 3, 4, 5]],
  [/\bweekends?\b/, [0, 6]],
];

// "Mon-Fri", "M-F", "Monday to Friday", "MWF", "TTh", "Mon, Wed, Sat", "Daily".
function parseDaySpec(raw: string): Set<number> | null {
  const text = raw.toLowerCase().replace(/[‐-―]/g, "-").replace(/\s+to\s+/g, "-").trim();
  if (!text) return null;
  for (const [re, days] of DAY_SPEC_WORDS) if (re.test(text)) return new Set(days);

  const span = /\b(su|sun|sunday|m|mo|mon|monday|t|tu|tue|tues|tuesday|w|we|wed|wednesday|th|thu|thur|thurs|thursday|f|fr|fri|friday|sa|sat|saturday)\b\.?\s*-\s*\b(su|sun|sunday|m|mo|mon|monday|t|tu|tue|tues|tuesday|w|we|wed|wednesday|th|thu|thur|thurs|thursday|f|fr|fri|friday|sa|sat|saturday)\b/.exec(text);
  if (span) {
    const days = new Set<number>();
    const from = WEEKDAY_WORDS[span[1]];
    const to = WEEKDAY_WORDS[span[2]];
    for (let d = from; ; d = (d + 1) % 7) {
      days.add(d);
      if (d === to) break;
    }
    return days;
  }

  const listed = text.split(/[,/&\s]+|\band\b/).filter(Boolean);
  if (listed.length > 0 && listed.every((w) => w.replace(/\.$/, "") in WEEKDAY_WORDS)) {
    return new Set(listed.map((w) => WEEKDAY_WORDS[w.replace(/\.$/, "")]));
  }
  // Run together: "MWF", "TTH", "MTWTHF".
  const compact = /^(?:th|su|sa|m|t|w|f)+$/.exec(text);
  if (compact) {
    return new Set((text.match(/th|su|sa|m|t|w|f/g) ?? []).map((w) => WEEKDAY_WORDS[w]));
  }
  return null;
}

const MONTH_NAME_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d/i;

function readSummaryLayout(grid: Grid, ctx: Ctx): Candidate | null {
  const nameColumns = findNameColumns(grid.cells, new Set(), ctx);
  if (!nameColumns) return null;

  const entries: Entry[] = [];
  let assumedWeekdays = 0;
  let headerAbove: string[] = [];
  for (const row of grid.cells) {
    const name = nameFromColumns(row, nameColumns);
    if (!name || !looksLikeName(name) || !ctx.resolver.resolve(name).employee) {
      if (row.some((c) => /\b(?:days?|sched|hours?|time|rest)\b/i.test(c))) headerAbove = row;
      continue;
    }

    const hoursByDay = new Map<number, string>();
    const untimed: string[] = [];
    let columnDays: Set<number> | null = null;
    let restDays: Set<number> | null = null;

    row.forEach((cell, c) => {
      if (!cell || nameColumns.includes(c)) return;
      const label = headerAbove[c] ?? "";
      for (const segment of cell.split(/\n|;/).map((s) => s.trim()).filter(Boolean)) {
        if (MONTH_NAME_RE.test(segment)) continue; // "Nov 2-6" is a date span, not 2-6 hours
        const restMatch = /^(?:rest\s*days?|day\s*off|off|rd)\s*[:-]?\s*(.+)$/i.exec(segment);
        if (restMatch || /\b(?:rest|off)\b/i.test(label)) {
          const days = parseDaySpec(restMatch ? restMatch[1] : segment);
          if (days) restDays = new Set([...(restDays ?? []), ...days]);
          continue;
        }
        const time = extractTimeText(segment);
        if (time) {
          const days = parseDaySpec(time.rest);
          if (days) for (const d of days) hoursByDay.set(d, time.time);
          else untimed.push(time.time);
          continue;
        }
        const days = parseDaySpec(segment);
        if (days && /\b(?:days?|sched)\b/i.test(label || "days")) columnDays = days;
      }
    });

    if (hoursByDay.size === 0 && untimed.length === 0) continue;
    if (untimed.length > 0) {
      const token = untimed.join(" / ");
      const rest = restDays as Set<number> | null;
      let days = columnDays as Set<number> | null;
      if (!days && rest) days = new Set([0, 1, 2, 3, 4, 5, 6].filter((d) => !rest.has(d)));
      if (!days) {
        days = new Set([1, 2, 3, 4, 5]);
        assumedWeekdays++;
      }
      for (const d of days) if (!hoursByDay.has(d)) hoursByDay.set(d, token);
    }

    const entry: Entry = { rawName: name, cells: new Map() };
    for (const iso of ctx.isos) {
      const token = hoursByDay.get(new Date(`${iso}T00:00:00Z`).getUTCDay());
      if (token) entry.cells.set(iso, token);
    }
    entries.push(entry);
  }

  const warnings =
    assumedWeekdays > 0
      ? [`${assumedWeekdays} employee(s) had hours listed but no days. They were read as Monday to Friday — check them below.`]
      : [];
  return { layout: "summary", entries, covered: new Set(ctx.isos), warnings };
}

// ── Legend: what the file's own codes mean ───────────────────────

const LEGEND_LINE_RE = /^\s*([\p{L}\d/.]{1,8})\s*(?:=|:|–|—|-|→|->)\s*(.+)$/u;
const LEGEND_PAREN_RE = /^\s*([\p{L}\d/.]{1,8})\s*\((.+)\)\s*$/u;

function readLegend(grids: Grid[], ctx: Ctx): Map<string, Shift> {
  const legend = new Map<string, Shift>();
  const consider = (code: string, meaning: string) => {
    const key = normalizeTokenKey(code);
    if (!key || legend.has(key) || parseShiftText(code).shift || parseShiftText(code).alternatives.length) return;
    const text = /rest|off|no duty/i.test(meaning) && !/\d/.test(meaning) ? "off" : meaning;
    const reading = parseShiftText(text);
    if (reading.shift) legend.set(key, reading.shift);
  };

  for (const grid of grids) {
    for (const row of grid.cells) {
      const filled = row.filter(Boolean);
      if (filled.length === 0 || filled.length > 6) continue;
      for (const cell of filled) {
        for (const line of cell.split(/\n|;/)) {
          const m = LEGEND_LINE_RE.exec(line) ?? LEGEND_PAREN_RE.exec(line);
          if (m) consider(m[1], m[2]);
        }
      }
      // A two-column legend: a short code beside its meaning.
      if (filled.length <= 4 && !filled.some((c) => ctx.resolver.resolve(c).employee)) {
        for (let i = 0; i + 1 < filled.length; i++) {
          if (filled[i].length <= 8) consider(filled[i], filled[i + 1]);
        }
      }
    }
  }
  return legend;
}

// ── Putting it together ──────────────────────────────────────────

function transpose(grid: Grid): Grid {
  const width = grid.cells.reduce((max, r) => Math.max(max, r.length), 0);
  const cells = Array.from({ length: width }, (_, c) => grid.cells.map((row) => row[c] ?? ""));
  return { name: grid.name, cells };
}

function scoreCandidate(candidate: Candidate, ctx: Ctx): number {
  const matched = new Set<string>();
  const names = new Set<string>();
  let cells = 0;
  for (const entry of candidate.entries) {
    const employee = ctx.resolver.resolve(entry.rawName).employee;
    if (employee) matched.add(employee.id);
    names.add(employee?.id ?? entry.rawName.toLowerCase());
    cells += entry.cells.size;
  }
  // Summary lines fit almost anything with a time in it, so that reader only
  // wins when it recognises more people than a date-based reading does.
  const detail = candidate.layout === "summary" ? 0 : 1 + Math.min(cells, 98);
  return matched.size * 10_000 + names.size * 100 + detail;
}

function bestCandidate(grid: Grid, ctx: Ctx): Candidate | null {
  const flipped = transpose(grid);
  const attempts = [
    readColumnsLayout(grid, ctx),
    readColumnsLayout(flipped, ctx),
    readListLayout(grid, ctx),
    readDutyRosterLayout(grid, ctx),
    readDutyRosterLayout(flipped, ctx),
    readSummaryLayout(grid, ctx),
  ];
  let best: Candidate | null = null;
  let bestScore = 0;
  for (const attempt of attempts) {
    if (!attempt || attempt.entries.length === 0) continue;
    const score = scoreCandidate(attempt, ctx);
    if (score > bestScore) {
      best = attempt;
      bestScore = score;
    }
  }
  return best;
}

// "November 2026" in a sheet's name or its first rows. A workbook with one tab
// per month is common, so another month's tab must not overwrite this one.
function statedMonth(grid: Grid): { month: number; year: number | null } | null {
  const search = [grid.name, ...grid.cells.slice(0, 6).flat()];
  for (const text of search) {
    const m = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\b(?:[\s,\d-]*?\b(20\d{2})\b)?/i.exec(text);
    if (m) return { month: monthIndex(m[1])!, year: m[2] ? Number(m[2]) : null };
  }
  return null;
}

function readToken(raw: string, legend: Map<string, Shift>, remembered: Map<string, Shift>): TokenReading {
  const key = normalizeTokenKey(raw);
  const fromLegend = legend.get(key);
  if (fromLegend) return { raw, shift: fromLegend, source: "legend", alternatives: [] };
  const fromMemory = remembered.get(key);
  if (fromMemory) return { raw, shift: fromMemory, source: "remembered", alternatives: [] };
  const reading = parseShiftText(raw);
  return { raw, shift: reading.shift, source: "read", alternatives: reading.alternatives };
}

export function tokenFromText(text: string, remembered: Map<string, Shift>): TokenReading {
  return readToken(text, new Map(), remembered);
}

export function blankTokenReading(): TokenReading {
  return { raw: "(blank cell)", shift: { kind: "off" }, source: "default", alternatives: [] };
}

export function detectSchedule(input: DetectInput): DetectResult {
  const { year, month } = input;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isoFor = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ctx: Ctx = {
    year,
    month,
    daysInMonth,
    isoFor,
    isos: Array.from({ length: daysInMonth }, (_, i) => isoFor(i + 1)),
    resolver: new NameResolver(input.officeEmployees, input.allEmployees),
  };

  const warnings: string[] = [];
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });

  const stated = input.grids.map((grid) => statedMonth(grid));
  const matchesChosen = (s: { month: number; year: number | null } | null) =>
    !!s && s.month === month && (s.year === null || s.year === year);
  let grids = input.grids;
  if (stated.some(matchesChosen)) {
    grids = input.grids.filter((_, i) => !stated[i] || matchesChosen(stated[i]));
  } else {
    const other = stated.find((s) => s && !matchesChosen(s));
    if (other) {
      const otherName = new Date(Date.UTC(2000, other.month - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
      warnings.push(
        `This file says ${otherName}${other.year ? ` ${other.year}` : ""}, but you chose ${monthName} ${year}. Check that the month is right before publishing.`,
      );
    }
  }

  const merged = new Map<string, Entry>();
  const covered = new Set<string>();
  const usedSheets: string[] = [];
  const layoutVotes = new Map<LayoutKind, number>();
  let conflicts = 0;

  for (const grid of grids) {
    const candidate = bestCandidate(grid, ctx);
    if (!candidate) continue;
    const anyMatched = candidate.entries.some((e) => ctx.resolver.resolve(e.rawName).employee);
    if (!anyMatched && candidate.entries.length < 2) continue;

    usedSheets.push(grid.name);
    layoutVotes.set(candidate.layout, (layoutVotes.get(candidate.layout) ?? 0) + candidate.entries.length);
    warnings.push(...candidate.warnings);
    for (const iso of candidate.covered) covered.add(iso);

    for (const entry of candidate.entries) {
      const key = ctx.resolver.resolve(entry.rawName).employee?.id ?? `raw:${entry.rawName.toLowerCase()}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { rawName: entry.rawName, cells: new Map(entry.cells) });
        continue;
      }
      for (const [iso, token] of entry.cells) {
        const previous = existing.cells.get(iso);
        if (previous && normalizeTokenKey(previous) !== normalizeTokenKey(token)) conflicts++;
        existing.cells.set(iso, token);
      }
    }
  }

  if (merged.size === 0) {
    return {
      ok: false,
      reason:
        "We couldn't find a schedule in this file — no employee names lined up with dates or hours. If it's a scanned copy or a calendar-style layout, please fill in the template below instead.",
    };
  }
  if (conflicts > 0) {
    warnings.push(`${conflicts} day(s) appear more than once in this file with different hours. The last one found was used.`);
  }

  const legend = readLegend(input.grids, ctx);
  const tokens: Record<string, TokenReading> = {};
  const rows: ReviewRow[] = [];
  let index = 0;
  let matchedCount = 0;

  for (const entry of merged.values()) {
    const match = ctx.resolver.resolve(entry.rawName);
    if (match.employee) matchedCount++;
    const cells: Record<string, string> = {};
    for (const iso of ctx.isos) {
      if (!covered.has(iso)) continue;
      const raw = entry.cells.get(iso)?.trim();
      if (!raw) {
        cells[iso] = BLANK_TOKEN;
        tokens[BLANK_TOKEN] ??= blankTokenReading();
        continue;
      }
      const key = normalizeTokenKey(raw);
      cells[iso] = key;
      tokens[key] ??= readToken(raw, legend, input.remembered);
    }
    rows.push({
      key: `r${index++}`,
      rawName: entry.rawName,
      employeeId: match.employee?.id ?? null,
      employeeName: match.employee?.name ?? null,
      match: match.employee ? match.quality : "none",
      candidates: match.candidates.map((c) => ({ id: c.id, name: c.name, officeAssignment: c.officeAssignment })),
      cells,
    });
  }

  // Whatever a layout reader managed to line up, the entries have to look like
  // a schedule. Names against dates filled with bare numbers or amounts is an
  // attendance or payroll sheet (minutes late, daily rates); a numeric code is
  // fine once the file's legend or an earlier answer explains it. And a real
  // schedule only ever uses a handful of different entries, so dozens that
  // nobody can explain means the columns were never shifts at all.
  const written = Object.entries(tokens).filter(([key]) => key !== BLANK_TOKEN);
  const unexplained = written.filter(([, token]) => !token.shift && token.alternatives.length === 0);
  const unexplainedFigures = unexplained.filter(([key]) => /^[₱$]?\s*[\d,]+(?:\.\d+)?$/.test(key));
  const looksLikeFigures = unexplainedFigures.length >= 3 && unexplainedFigures.length >= written.length / 2;
  const tooManyUnknowns = unexplained.length >= 12 && unexplained.length >= written.length / 2;
  if (looksLikeFigures || tooManyUnknowns) {
    return {
      ok: false,
      reason:
        "This doesn't look like a schedule: where the hours should be, it has numbers or other values that aren't hours or shift codes. It may be an attendance, payroll, or staff list. Please upload the office's schedule, or fill in the template below.",
    };
  }

  if (matchedCount < rows.length / 2) {
    warnings.push(
      `Only ${matchedCount} of ${rows.length} names in this file matched the roster. Check that this is the right office.`,
    );
  }

  const layout = [...layoutVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  rows.sort((a, b) => Number(!!a.employeeId) - Number(!!b.employeeId) || a.rawName.localeCompare(b.rawName));
  return { ok: true, document: { layout, sheets: usedSheets, rows, tokens, warnings } };
}
