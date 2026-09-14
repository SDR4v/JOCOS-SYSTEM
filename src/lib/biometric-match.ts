// Turns a day's raw biometric punches into arrival/departure times WITHOUT
// ever guessing on an ambiguous case — a day either resolves confidently or
// gets flagged for the admin to look at, never silently written wrong (this
// feeds payroll). See computeAttendanceFromTimes in dtr-time.ts for how the
// resulting times get graded once applied.
import { loneSession, type ResolvedSchedule } from "@/lib/dtr-time";

// The export's "No." column is the biometric device's own internal user ID —
// confirmed (against a real export) to NOT correspond to Employee.employeeNo
// at all, so matching has to go by name instead. This only normalizes
// whitespace/case — no dropped tokens — so it's exact enough to use with
// confidence on its own.
export function normalizePunchName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Last name, and given-name tokens with only Jr/Sr/II/III/IV suffixes
// removed (trailing periods stripped too) — middle initials and middle
// names are deliberately kept here; givenNamesCompatible below is what
// tolerates those being spelled differently or missing entirely.
export function splitName(name: string): { lastName: string; givenTokens: string[] } | null {
  const trimmed = name.trim().toLowerCase();
  const commaIndex = trimmed.indexOf(",");

  let lastName: string;
  let rest: string;
  if (commaIndex >= 0) {
    lastName = trimmed.slice(0, commaIndex).trim();
    rest = trimmed.slice(commaIndex + 1).replace(/,/g, " ");
  } else {
    // A comma-less name is a real (if rare) gap in the device's own export —
    // confirmed against a real case ("Lao-ang John Fred T.", missing its
    // comma in every one of that person's punches, most likely because the
    // hyphenated last name confused whatever generated the report). Falls
    // back to "the first word is the last name," matching this convention's
    // normal Last-name-first order — wrong for a genuinely multi-word last
    // name with no comma, but this only ever feeds a same-last-name lookup
    // or a suggestion for a human to confirm, never an unsupervised match on
    // its own, so an occasional bad guess here costs nothing.
    const tokens = trimmed.split(/\s+/);
    lastName = tokens[0] ?? "";
    rest = tokens.slice(1).join(" ");
  }

  const givenTokens = rest
    .split(/\s+/)
    .map((t) => t.replace(/\.$/, ""))
    .filter((t) => t && !NAME_SUFFIXES.has(t));
  if (!lastName || givenTokens.length === 0) return null;
  return { lastName, givenTokens };
}

// True when `a` and `b` differ by at most one character — one substitution
// ("nendell"/"wendell"), one inserted letter ("cristian"/"christian"), or one
// dropped letter — the "just one letter off" typo shape a device's OCR/typed
// roster and the real roster tend to drift by. Anything further apart (a
// genuinely different name, a missing word) returns false; this is NOT a
// general edit-distance-1 check for arbitrary edits like transpositions.
function within1Letter(a: string, b: string): boolean {
  if (a === b) return true;
  const lenDiff = a.length - b.length;
  if (Math.abs(lenDiff) > 1) return false;

  if (lenDiff === 0) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diffs > 1) return false;
    }
    return diffs === 1;
  }

  const [shorter, longer] = lenDiff < 0 ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else if (!skipped) {
      skipped = true;
      j++; // skip one extra character in `longer`
    } else {
      return false;
    }
  }
  return true;
}

// Tries to match the tokens at short[si]/long[li] as the same word, in every
// tolerated shape, and reports how many tokens each side consumed:
//  - identical, or one typo'd letter apart (within1Letter)
//  - `allowInitial`-gated: one side is a bare initial standing in for the
//    other's full word ("a" abbreviating "ayra") — only ever appropriate for
//    a middle name, never the first name (see givenNamesCompatible)
//  - a name split across two words on one side, joined into one on the
//    other — checked both directions ("Relf Jay" on the device vs. the
//    roster's single "Relfjay") — confirmed against a real case
// Returns null when none of these line up.
function matchTokensAt(
  short: string[],
  si: number,
  long: string[],
  li: number,
  allowInitial: boolean,
): { si: number; li: number } | null {
  const a = short[si];
  const b = long[li];
  if (a === b || within1Letter(a, b)) return { si: 1, li: 1 };
  if (allowInitial) {
    if (a.length === 1 && b[0] === a) return { si: 1, li: 1 };
    if (b.length === 1 && a[0] === b) return { si: 1, li: 1 };
  }
  if (si + 1 < short.length) {
    const merged = a + short[si + 1];
    if (merged === b || within1Letter(merged, b)) return { si: 2, li: 1 };
  }
  if (li + 1 < long.length) {
    const merged = b + long[li + 1];
    if (merged === a || within1Letter(merged, a)) return { si: 1, li: 2 };
  }
  return null;
}

// At most this many given-name tokens on the longer side can be skipped
// (treated as a whole middle name present on one side and missing on the
// other) while still matching. Kept small and deliberately: a higher budget
// lets an unrelated shared token (e.g. both names merely starting with the
// same letter somewhere) chain into a false match once enough tokens are
// skipped to reach it — confirmed by testing against the real roster, 1 is
// enough for every real dropped-name case and already rejects that.
const MAX_SKIPPED_GIVEN_TOKENS = 1;

// True when every token of the SHORTER list appears, in order, in the
// longer list (see matchTokensAt for what counts as the "same" token),
// allowing up to MAX_SKIPPED_GIVEN_TOKENS extra tokens in the longer list to
// be skipped.
//
// The FIRST token (the actual first name) is matched WITHOUT the
// bare-initial rule and is never itself skippable — a word split/typo is
// still tolerated there (confirmed against a real case: "Relf Jay" on the
// device vs. the roster's "Relfjay"), but not an initial standing in for it.
// Without that guard, a first name that happens to share its first letter
// with an unrelated middle initial several tokens later (confirmed against
// the real roster: "Angelbert" spuriously "matching" a completely different
// "Jeanalyne A.") could pass once enough tokens are skipped to reach it;
// middle names are genuinely droppable/abbreviated in this data, first
// names never are.
function givenNamesCompatible(a: string[], b: string[]): boolean {
  const [shortTokens, longTokens] = a.length <= b.length ? [a, b] : [b, a];
  const first = matchTokensAt(shortTokens, 0, longTokens, 0, false);
  if (!first) return false;

  let si = first.si;
  let li = first.li;
  let skips = 0;
  while (si < shortTokens.length && li < longTokens.length) {
    const m = matchTokensAt(shortTokens, si, longTokens, li, true);
    if (m) {
      si += m.si;
      li += m.li;
    } else {
      skips++;
      if (skips > MAX_SKIPPED_GIVEN_TOKENS) return false;
      li++;
    }
  }
  return si === shortTokens.length;
}

export type NameMatchIndex<T> = { exact: Map<string, T>; byLastName: Map<string, T[]> };

export function buildNameMatchIndex<T extends { name: string }>(employees: T[]): NameMatchIndex<T> {
  const exact = new Map<string, T>();
  const byLastName = new Map<string, T[]>();
  for (const e of employees) {
    exact.set(normalizePunchName(e.name), e);
    const split = splitName(e.name);
    if (!split) continue;
    const sameLastName = byLastName.get(split.lastName);
    if (sameLastName) sameLastName.push(e);
    else byLastName.set(split.lastName, [e]);
  }
  return { exact, byLastName };
}

// Matches a scanned name to exactly one employee — exact normalized name
// first, falling back to same-last-name + compatible given names (see
// givenNamesCompatible) only when that resolves to a SINGLE employee.
// Multiple employees tying (two "Dela Cruz, Juan"s whose middle names both
// happen to fit) is left unresolved rather than guessed at, same as zero
// matches — both go to the review screen's manual link picker.
export function matchEmployeeByName<T extends { name: string }>(rawName: string, index: NameMatchIndex<T>): T | null {
  const exactMatch = index.exact.get(normalizePunchName(rawName));
  if (exactMatch) return exactMatch;

  const split = splitName(rawName);
  if (!split) return null;
  const sameLastName = index.byLastName.get(split.lastName) ?? [];
  const matches = sameLastName.filter((e) => {
    const empSplit = splitName(e.name);
    return !!empSplit && givenNamesCompatible(split.givenTokens, empSplit.givenTokens);
  });
  return matches.length === 1 ? matches[0] : null;
}

// For the review screen: which roster employees are even worth showing next
// to an unmatched scanned name, so the admin isn't hunting through the whole
// roster (or, just as usefully, can tell at a glance that a name genuinely
// isn't anyone's — nobody with even a similar last name). Looser than
// matchEmployeeByName on purpose (last name within one typo'd letter, no
// given-name check at all) since this only ever populates a suggestion for a
// human to confirm or reject, never auto-links anyone.
export function suggestCandidates<T extends { name: string }>(rawName: string, index: NameMatchIndex<T>): T[] {
  const split = splitName(rawName);
  if (!split) return [];
  const candidates: T[] = [];
  for (const [lastName, employees] of index.byLastName) {
    if (lastName === split.lastName || within1Letter(lastName, split.lastName)) candidates.push(...employees);
  }
  return candidates;
}

// A biometric device can register two scans a few seconds apart as separate
// punches (bad finger read, impatient double-tap). Punches by the same
// employee within this many minutes of the previous KEPT punch collapse into
// one, keeping the earliest.
const DUPLICATE_THRESHOLD_MINUTES = 3;

// `timestamps` must already be sorted ascending. Returns a same-length
// parallel array of isDuplicate flags.
export function markDuplicates(timestamps: Date[]): boolean[] {
  const flags: boolean[] = [];
  let lastKept: Date | null = null;
  for (const ts of timestamps) {
    const isDup = lastKept !== null && (ts.getTime() - lastKept.getTime()) / 60000 < DUPLICATE_THRESHOLD_MINUTES;
    flags.push(isDup);
    if (!isDup) lastKept = ts;
  }
  return flags;
}

export type DtrPunchTimes = {
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
};

export type DayClassification =
  | { kind: "blank" }
  | ({ kind: "confident" } & DtrPunchTimes)
  | { kind: "flagged"; reason: "too_few" | "too_many"; am: Date[]; pm: Date[] };

// A day resolves confidently ONLY when its punch count exactly matches what
// the employee's own schedule expects that day (2 for a single continuous
// session, 4 for a normal AM/PM split) — punches are then assigned by ORDER
// (1st/2nd/3rd/4th = arrival/departure/arrival/departure), not by comparing
// each one's clock time to a computed cutoff.
//
// An earlier version bucketed punches into AM/PM by a clock-time split
// point (the midpoint of the lunch break) and judged each half separately —
// that broke on a real, correct 4-punch day where the PM return-from-lunch
// punch landed a few minutes before the cutoff and got miscounted as a 3rd
// AM punch, flagging a perfectly fine day as "unusual." Ordering has no such
// edge case: punches on a single calendar day are always chronological, so
// position alone is unambiguous when the count is right.
//
// Any other count (missing a punch, an extra scan, a forgotten time-out) is
// flagged for a human — whether it's a Trip Authorization, a forgotten
// punch, an unregistered scan, or a genuine absence for that half isn't
// something a punch count alone can tell, so this never guesses at it.
export function classifyDayPunches(punches: Date[], schedule: ResolvedSchedule): DayClassification {
  if (punches.length === 0) return { kind: "blank" };

  const lone = loneSession(schedule);
  const expected = lone ? 2 : 4;

  if (punches.length === expected) {
    if (lone) {
      return lone.slot === "AM"
        ? { kind: "confident", amArrival: punches[0], amDeparture: punches[1], pmArrival: null, pmDeparture: null }
        : { kind: "confident", amArrival: null, amDeparture: null, pmArrival: punches[0], pmDeparture: punches[1] };
    }
    return { kind: "confident", amArrival: punches[0], amDeparture: punches[1], pmArrival: punches[2], pmDeparture: punches[3] };
  }

  // Grouped by clock time purely so the review screen can show "these looked
  // like AM, these looked like PM" for a human to read — display only, plays
  // no part in the decision that this day needs one.
  const { am, pm } = bucketPunchesForDay(punches, schedule);
  return { kind: "flagged", reason: punches.length < expected ? "too_few" : "too_many", am, pm };
}

function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function bucketPunchesForDay(punches: Date[], schedule: ResolvedSchedule): { am: Date[]; pm: Date[] } {
  const lone = loneSession(schedule);
  if (lone) return lone.slot === "AM" ? { am: punches, pm: [] } : { am: [], pm: punches };
  if (!schedule.session1 || !schedule.session2) return { am: punches, pm: [] };

  const splitMinute = Math.round((schedule.session1.end + schedule.session2.start) / 2);
  const am: Date[] = [];
  const pm: Date[] = [];
  for (const punch of punches) {
    (minutesOfDay(punch) < splitMinute ? am : pm).push(punch);
  }
  return { am, pm };
}

export function isConfidentDay(day: DayClassification): boolean {
  return day.kind === "confident";
}
