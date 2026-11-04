// Reads what one schedule cell MEANS, independent of whichever template it
// came from: "8-5", "8:00 AM - 12:00 NN / 1:00 - 5:00 PM", "0800-1700",
// "AM Shift (6AM-2PM)", "OFF", ... This is the one place a guess could quietly
// cost someone pay, so a bare range with two honest readings (is "10-6" a day
// or a night shift?) never gets picked for them: it comes back with both
// `alternatives` and no `shift`, and the review screen makes a person choose.

export type TimeRange = { start: number; end: number }; // minutes since midnight; end < start crosses midnight

export type Shift =
  | { kind: "off" }
  // Leaves this day on the employee's normal schedule — no date row is written.
  | { kind: "usual" }
  | { kind: "hours"; session1: TimeRange | null; session2: TimeRange | null };

export type ShiftReading = { shift: Shift | null; alternatives: Shift[] };

const OFF_WORDS = new Set([
  "off", "day off", "dayoff", "off duty", "no duty", "rd", "r/d", "r.d", "rest", "rest day", "restday",
  "d/o", "do", "d.o", "x", "-", "--", "---", "none", "n/a", "na",
]);
const REGULAR_WORDS = new Set([
  "reg", "regular", "regular hours", "regular time", "regular schedule", "office hours", "standard",
  "standard hours", "rt", "straight",
]);

export function normalizeTokenKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

// Rewrites the spellings people actually type into one shape the time regexes
// below can read: unicode dashes, "to", 12NN/12MN, "a.m.", 0800.
function normalizeTimeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‐-―−~]/g, "-")
    .replace(/\s+(?:to|until|til)\s+/g, " - ")
    .replace(/\b([ap])\.\s?m\.?/g, "$1m")
    .replace(/\b12(?::00)?\s*(?:nn|noon|n)\b/g, "12:00pm")
    .replace(/\b12(?::00)?\s*(?:mn|midnight|m)\b/g, "12:00am")
    .replace(/\b(?:noon|nn)\b/g, "12:00pm")
    .replace(/\b(?:midnight|mn)\b/g, "12:00am")
    .replace(/(?<![\d:.])([01]\d|2[0-3])([0-5]\d)\s*(?:h|hrs?|hours?)?(?![\d:.])/g, "$1:$2");
}

const TIME = String.raw`(?<![\d:.])(\d{1,2})(?:[:.]([0-5]\d))?\s*(am|pm|a|p)?(?![a-z\d])`;
const RANGE_RE = new RegExp(`${TIME}\\s*-\\s*${TIME}`, "g");
const SINGLE_RE = new RegExp(TIME, "g");
const DATE_LIKE_RE = /\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{1,2}-\d{1,2}/;

type RawTime = { hour: number; minute: number; meridiem: "am" | "pm" | null };

function rawTime(hourStr: string, minuteStr: string | undefined, meridiemStr: string | undefined): RawTime | null {
  const hour = Number(hourStr);
  const minute = minuteStr ? Number(minuteStr) : 0;
  if (hour > 24 || minute > 59) return null;
  const meridiem = meridiemStr ? (meridiemStr.startsWith("a") ? "am" : "pm") : null;
  if (meridiem && (hour === 0 || hour > 12)) return null;
  return { hour, minute, meridiem };
}

function to24(t: RawTime, meridiem: "am" | "pm"): number {
  return ((t.hour % 12) + (meridiem === "pm" ? 12 : 0)) * 60 + t.minute;
}

const shortestForward = (start: number, end: number) => ((end - start) % 1440 + 1440) % 1440;

// Every honest reading of one start-end pair, most likely first. One reading
// means certain; more than one has to go to a person.
function rangeReadings(a: RawTime, b: RawTime): TimeRange[] {
  // Any 24-hour-only value makes both sides literal 24-hour times.
  if (!a.meridiem && !b.meridiem && (a.hour === 0 || a.hour > 12 || b.hour === 0 || b.hour > 12)) {
    return [{ start: (a.hour % 24) * 60 + a.minute, end: (b.hour % 24) * 60 + b.minute }];
  }
  if (a.meridiem && b.meridiem) return [{ start: to24(a, a.meridiem), end: to24(b, b.meridiem) }];

  // One side marked ("8-5pm", "10-6am") — the other is whichever makes the
  // shorter shift, which is never in real doubt.
  if (a.meridiem || b.meridiem) {
    const options: TimeRange[] = a.meridiem
      ? [{ start: to24(a, a.meridiem), end: to24(b, "am") }, { start: to24(a, a.meridiem), end: to24(b, "pm") }]
      : [{ start: to24(a, "am"), end: to24(b, b.meridiem!) }, { start: to24(a, "pm"), end: to24(b, b.meridiem!) }];
    options.sort((x, y) => shortestForward(x.start, x.end) - shortestForward(y.start, y.end));
    return [options[0]];
  }

  // Bare on both sides. 12 sorts as the top of the clock face.
  const startFace = a.hour * 60 + a.minute;
  const endFace = b.hour * 60 + b.minute;
  const dayShift: TimeRange = { start: to24(a, "am"), end: to24(b, "pm") };
  const nightShift: TimeRange = { start: to24(a, "pm"), end: to24(b, "am") };
  if (startFace === endFace) return [dayShift, nightShift]; // a straight 12 hours — "7-7" runs either way
  if (a.hour === 12) return [{ start: to24(a, "pm"), end: to24(b, "pm") }, { start: to24(a, "am"), end: to24(b, "am") }];

  if (endFace > startFace) {
    const morning: TimeRange = { start: to24(a, "am"), end: b.hour === 12 ? 720 : to24(b, "am") };
    const afternoon: TimeRange = { start: to24(a, "pm"), end: b.hour === 12 ? 0 : to24(b, "pm") };
    if (a.hour >= 7) return [morning]; // 8-12, 7-11
    if (a.hour <= 4) return [afternoon]; // 1-5, 2-10, 4-12
    return [morning, afternoon]; // 6-10 could honestly be either
  }
  if (a.hour >= 5 && a.hour <= 9) return [dayShift]; // 8-5, 7-4, 7-3, 6-2
  if (a.hour >= 10) return [dayShift, nightShift].reverse(); // 10-6, 11-7 are usually (not always) nights
  return [nightShift, dayShift];
}

// Puts a single continuous range onto the DTR's two halves. A span of 9-11
// hours crossing noon includes the standard lunch hour (8-5 really means 8-12
// and 1-5); shorter or longer shifts run straight through with no break, and
// land under whichever half of the DTR they start in.
function shiftFromSingleRange({ start, end }: TimeRange): Shift {
  const span = end - start;
  if (span >= 540 && span <= 660 && start < 720 && end > 780) {
    return { kind: "hours", session1: { start, end: 720 }, session2: { start: 780, end } };
  }
  return start < 720
    ? { kind: "hours", session1: { start, end }, session2: null }
    : { kind: "hours", session1: null, session2: { start, end } };
}

function shiftFromTwoRanges(first: TimeRange[], second: TimeRange[]): Shift {
  const a = first.find((r) => r.start < 720) ?? first[0];
  const b = second.find((r) => r.start >= a.end) ?? second[0];
  return { kind: "hours", session1: a, session2: b };
}

function sameShift(a: Shift, b: Shift): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function parseShiftText(raw: string): ShiftReading {
  const none: ShiftReading = { shift: null, alternatives: [] };
  const key = normalizeTokenKey(raw);
  if (!key) return none;
  if (OFF_WORDS.has(key)) return { shift: { kind: "off" }, alternatives: [] };
  if (REGULAR_WORDS.has(key)) {
    return {
      shift: { kind: "hours", session1: { start: 480, end: 720 }, session2: { start: 780, end: 1020 } },
      alternatives: [],
    };
  }
  if (DATE_LIKE_RE.test(key) || !/\d|noon|\bnn\b|midnight|\bmn\b/.test(key)) return none;

  const text = normalizeTimeText(raw);
  const ranges: TimeRange[][] = [];
  for (const m of text.matchAll(RANGE_RE)) {
    const a = rawTime(m[1], m[2], m[3]);
    const b = rawTime(m[4], m[5], m[6]);
    if (!a || !b) return none;
    ranges.push(rangeReadings(a, b));
  }

  // No "a-b" in it: stacked IN and OUT cells ("8:00 / 5:00"), or the four
  // separate columns of a long-form list. Bare numbers only count when they're
  // the entire cell, so a stray "2" in "Nurse 2" never reads as a time.
  if (ranges.length === 0) {
    const onlyTimes = /^[\d\s:./apm,]+$/.test(text);
    const times = [...text.matchAll(SINGLE_RE)]
      .filter((m) => onlyTimes || m[2] || m[3])
      .map((m) => rawTime(m[1], m[2], m[3]));
    if (times.some((t) => !t) || (times.length !== 2 && times.length !== 4)) return none;
    const t = times as RawTime[];
    ranges.push(rangeReadings(t[0], t[1]));
    if (t.length === 4) ranges.push(rangeReadings(t[2], t[3]));
  }

  if (ranges.length > 2) return none;
  if (ranges.some((options) => options.some((r) => r.start === r.end))) return none;

  if (ranges.length === 2) {
    return { shift: shiftFromTwoRanges(ranges[0], ranges[1]), alternatives: [] };
  }
  const options = ranges[0].map(shiftFromSingleRange).filter((s, i, all) => all.findIndex((o) => sameShift(o, s)) === i);
  return options.length === 1 ? { shift: options[0], alternatives: [] } : { shift: null, alternatives: options };
}

// The time-bearing part of a longer sentence ("Mon-Fri 8:00-5:00" → "8:00-5:00"),
// so a per-employee summary row can split days from hours.
export function extractTimeText(raw: string): { time: string; rest: string } | null {
  // "2025-05-01" would otherwise read as 20:25 to 05:01.
  if (DATE_LIKE_RE.test(raw) || /\b(?:19|20)\d{2}\b/.test(raw)) return null;
  const text = normalizeTimeText(raw);
  const matches = [...text.matchAll(RANGE_RE)];
  if (matches.length === 0) return null;
  const first = matches[0];
  const last = matches[matches.length - 1];
  const from = first.index;
  const to = last.index + last[0].length;
  return { time: text.slice(from, to).trim(), rest: `${text.slice(0, from)} ${text.slice(to)}`.trim() };
}

export function formatTime12(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = String(normalized % 60).padStart(2, "0");
  const suffix = hour24 < 12 ? "AM" : "PM";
  return `${hour24 % 12 === 0 ? 12 : hour24 % 12}:${minute} ${suffix}`;
}

export function formatShift(shift: Shift | null): string {
  if (!shift) return "Needs your input";
  if (shift.kind === "off") return "Day off";
  if (shift.kind === "usual") return "Their usual schedule";
  const parts = [shift.session1, shift.session2]
    .filter((r): r is TimeRange => !!r)
    .map((r) => `${formatTime12(r.start)} – ${formatTime12(r.end)}`);
  const overnight = [shift.session1, shift.session2].some((r) => r && r.end < r.start);
  return `${parts.join(", then ")}${overnight ? " (ends next day)" : ""}`;
}
