// Derives the JOCOS attendance code/day-credit/late-minutes from a day's
// punch times (CS Form No. 48: AM arrival/departure, PM arrival/departure),
// graded against the EMPLOYEE'S OWN schedule rather than a fixed 8-5 — some
// staff run night shifts or split hours that don't follow the default office
// hours. Manually entered today; RFID/biometric capture fills the same four
// fields later without changing this function.
import type { AttendanceCode, ScheduleMode } from "@/generated/prisma/enums";
import { ATTENDANCE_CODE_MAP, displayCodeForDay } from "@/lib/attendance-codes";

// Default JOCOS office hours, used when an employee hasn't set a custom schedule.
export const STANDARD_HOURS = {
  amStart: 8 * 60, // 8:00 AM
  amEnd: 12 * 60, // 12:00 NN
  pmStart: 13 * 60, // 1:00 PM
  pmEnd: 17 * 60, // 5:00 PM
} as const;

export type DtrTimes = {
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
};

export type ComputedAttendance = {
  code: AttendanceCode;
  dayCredit: number;
  lateMinutes: number;
};

// Manual overrides that can't be derived from punch times.
export const MANUAL_OVERRIDE_CODES = ["REST_DAY", "WORK_SUSPENDED", "UNSET", "HOLIDAY", "ABSENT"] as const;
export type ManualOverrideCode = (typeof MANUAL_OVERRIDE_CODES)[number];
export const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// A day's final grade, however it was reached — a straight punch-time
// computation, a manual override, or one half of a night-shift pairing.
// Shared between saveDtrPeriod and approveDtrEntryRequests, which both grade
// a batch of days and then may need to retroactively re-save a boundary day
// just outside that batch if a night-shift pairing changed its grade.
export type Grade = { code: AttendanceCode; dayCredit: number; lateMinutes: number; amArrivalFromDuty: boolean };

// True when a freshly computed grade differs from what's already saved on
// an AttendanceDay — the check behind that retroactive re-save.
export function gradeChanged(
  grade: Grade,
  existing: { code: AttendanceCode; dayCredit: number; lateMinutes: number; amArrivalFromDuty: boolean },
): boolean {
  return (
    grade.code !== existing.code ||
    grade.dayCredit !== existing.dayCredit ||
    grade.lateMinutes !== existing.lateMinutes ||
    grade.amArrivalFromDuty !== existing.amArrivalFromDuty
  );
}

// The AttendanceDay fields a grade-only re-save touches — code/credit/lateness
// and the audit trail, deliberately never the punch times themselves (a
// boundary day's own times aren't part of what triggered the re-grade).
export function gradeUpdateData(grade: Grade, editedById: string, editedAt: Date) {
  return {
    code: grade.code,
    dayCredit: grade.dayCredit,
    lateMinutes: grade.lateMinutes,
    amArrivalFromDuty: grade.amArrivalFromDuty,
    editedById,
    editedAt,
  };
}

export function minutesOfDay(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function formatTimeHHMM(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export function minutesToHHMM(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number | null {
  if (!hhmm) return null;
  const [hourStr, minuteStr] = hhmm.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

// Converts a schedule form's raw fields into the stored session1/session2
// minute values — a lone session (hasSession1 false) is entered through the
// form's session1 fields regardless of time of day (see SessionInputs in
// schedule-fields.tsx), but is designated PM, so it's stored under session2
// with session1 left null. That null is what lets the DTR grid open the
// correct half (AM vs PM) for that day purely from the stored schedule.
export function buildStoredSession(input: {
  hasSession1: boolean;
  session1Start?: string;
  session1End?: string;
  hasSession2: boolean;
  session2Start?: string;
  session2End?: string;
}): { session1Start: number | null; session1End: number | null; session2Start: number | null; session2End: number | null } {
  if (input.hasSession1) {
    return {
      session1Start: hhmmToMinutes(input.session1Start ?? ""),
      session1End: hhmmToMinutes(input.session1End ?? ""),
      session2Start: input.hasSession2 ? hhmmToMinutes(input.session2Start ?? "") : null,
      session2End: input.hasSession2 ? hhmmToMinutes(input.session2End ?? "") : null,
    };
  }
  return {
    session1Start: null,
    session1End: null,
    session2Start: hhmmToMinutes(input.session1Start ?? ""),
    session2End: hhmmToMinutes(input.session1End ?? ""),
  };
}

export function combineDateAndTime(dateIso: string, timeHHMM: string): Date | null {
  if (!timeHHMM) return null;
  const [hourStr, minuteStr] = timeHHMM.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

// ── Per-employee schedule ────────────────────────────────────────
// dayOfWeek: 0 = Sunday ... 6 = Saturday (matches Date#getUTCDay()).

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type EmployeeDayScheduleFields = {
  dayOfWeek: number;
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
};

export type EmployeeScheduleFields = {
  scheduleMode: ScheduleMode;
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
  daySchedules?: EmployeeDayScheduleFields[];
};

export type ResolvedSchedule = {
  // session1 = the day's AM block, session2 = its PM block — either can be
  // null. A day with only one of the two is a single continuous session
  // (e.g. a night shift with no lunch break) that counts as a full day, not
  // half, and lands under whichever half of the DTR it actually falls in.
  session1: { start: number; end: number } | null;
  session2: { start: number; end: number } | null;
};

// The one populated session of a single-session day, tagged with which
// physical DTR half (AM or PM) it lives under. Null for a day with both
// sessions (a normal split shift) or neither (shouldn't happen —
// resolveSessions falls back to STANDARD in that case).
export function loneSession(schedule: ResolvedSchedule): { start: number; end: number; slot: "AM" | "PM" } | null {
  if (schedule.session1 && !schedule.session2) return { ...schedule.session1, slot: "AM" };
  if (schedule.session2 && !schedule.session1) return { ...schedule.session2, slot: "PM" };
  return null;
}

const STANDARD_RESOLVED: ResolvedSchedule = {
  session1: { start: STANDARD_HOURS.amStart, end: STANDARD_HOURS.amEnd },
  session2: { start: STANDARD_HOURS.pmStart, end: STANDARD_HOURS.pmEnd },
};

function resolveSessions(fields: {
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
}): ResolvedSchedule | null {
  const session1 =
    fields.session1Start !== null && fields.session1End !== null
      ? { start: fields.session1Start, end: fields.session1End }
      : null;
  const session2 =
    fields.session2Start !== null && fields.session2End !== null
      ? { start: fields.session2Start, end: fields.session2End }
      : null;
  if (!session1 && !session2) return null;
  return { session1, session2 };
}

export type DateScheduleOverrideFields = {
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
};

// Resolves an employee's schedule for a specific day of week. Required for
// PER_DAY mode (Monday can differ from Tuesday); ignored for STANDARD/CUSTOM.
// A dateOverride (a one-off EmployeeDateSchedule for this exact calendar
// date, e.g. covering someone else's shift just once) takes priority over
// all of that — the whole point is that it doesn't follow the usual pattern.
export function resolveSchedule(
  employee: EmployeeScheduleFields,
  dayOfWeek: number,
  dateOverride?: DateScheduleOverrideFields | null,
): ResolvedSchedule {
  if (dateOverride) {
    const resolved = resolveSessions(dateOverride);
    if (resolved) return resolved;
  }
  if (employee.scheduleMode === "PER_DAY") {
    const day = employee.daySchedules?.find((d) => d.dayOfWeek === dayOfWeek);
    return (day && resolveSessions(day)) ?? STANDARD_RESOLVED;
  }
  if (employee.scheduleMode === "CUSTOM") {
    return resolveSessions(employee) ?? STANDARD_RESOLVED;
  }
  return STANDARD_RESOLVED;
}

// Minutes elapsed from `base` to `t`, wrapping through midnight (always 0-1439).
function relativeMinutes(t: number, base: number): number {
  return ((t - base) % 1440 + 1440) % 1440;
}

function sessionDuration(start: number, end: number): number {
  const duration = relativeMinutes(end, start);
  return duration === 0 ? 1440 : duration;
}

// Total scheduled minutes across both sessions — used to describe a fully
// blank day (no punches at all) as "Undertime: the whole shift" rather than
// the bare Absent code, without changing the day's actual credit/deduction.
export function scheduledDurationMinutes(schedule: ResolvedSchedule): number {
  return (
    (schedule.session1 ? sessionDuration(schedule.session1.start, schedule.session1.end) : 0) +
    (schedule.session2 ? sessionDuration(schedule.session2.start, schedule.session2.end) : 0)
  );
}

// Human-readable summary of a resolved schedule, e.g. "8:00–12:00 &
// 13:00–17:00" or "18:00–00:00 (single continuous session, no AM)".
export function formatScheduleSummary(schedule: ResolvedSchedule): string {
  if (schedule.session1 && schedule.session2) {
    return `${minutesToHHMM(schedule.session1.start)}–${minutesToHHMM(schedule.session1.end)} & ${minutesToHHMM(schedule.session2.start)}–${minutesToHHMM(schedule.session2.end)}`;
  }
  const lone = loneSession(schedule)!;
  const missing = lone.slot === "AM" ? "PM" : "AM";
  return `${minutesToHHMM(lone.start)}–${minutesToHHMM(lone.end)} (single continuous session, no ${missing})`;
}

export function formatDurationHM(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// A late arrival of up to this many minutes is forgiven entirely (counts as
// 0) — but past the threshold, the FULL lateness counts, not lateness minus
// the grace (e.g. 8:16 against an 8:00 start is 16 minutes, not 1). Only
// applies to the AM arrival (and a lone/night-shift session's one arrival)
// — the PM return-from-lunch check below is stricter, see there.
const GRACE_PERIOD_MINUTES = 15;

// Raw minutes late for one arrival, schedule-relative, no grace applied —
// 0 if on time or early. If arrivalRel comes out beyond the session length
// they most likely arrived early (wrapped past midnight relative to the
// start), not hours late.
function lateArrivalMinutes(arrivalMin: number, schedStart: number, duration: number): number {
  const arrivalRel = relativeMinutes(arrivalMin, schedStart);
  return arrivalRel <= duration ? arrivalRel : 0;
}

function earlyDepartureMinutes(departureMin: number, schedStart: number, duration: number): number {
  const departureRel = relativeMinutes(departureMin, schedStart);
  return departureRel < duration ? duration - departureRel : 0;
}

// Same idea as earlyDepartureMinutes, but for a session that's guaranteed to
// sit within a single calendar day (the normal AM+PM case below — never the
// wrap-tolerant lone/night-shift session, which legitimately needs the
// modular math above). Comparing clock minutes directly instead of via
// relativeMinutes matters here: a departure earlier than the session's own
// start (e.g. arriving and leaving again before the shift even begins, both
// well before schedStart) would otherwise wrap around almost a full day and
// read as "not early" — identical to someone who stayed past schedEnd —
// instead of the entire session being missed.
function earlyDepartureMinutesSameDay(departureMin: number, schedStart: number, schedEnd: number): number {
  const effectiveDeparture = Math.max(departureMin, schedStart);
  return Math.max(0, schedEnd - Math.min(effectiveDeparture, schedEnd));
}

// The arrival-side mirror of earlyDepartureMinutesSameDay, same restriction
// (same-calendar-day sessions only). An arrival AFTER the session's own end
// (e.g. clocking in at 12:08 against a session that ends at 12:00) would
// otherwise wrap almost a full day under relativeMinutes and read as "must
// have arrived early" — instead of the entire session being missed, same
// failure mode as the departure case.
function lateArrivalMinutesSameDay(arrivalMin: number, schedStart: number, schedEnd: number): number {
  return Math.max(0, Math.min(arrivalMin, schedEnd) - schedStart);
}

// Undertime for one session with the AM/lone-session grace rule applied to
// its arrival (see GRACE_PERIOD_MINUTES); early departure is always
// counted in full regardless.
function sessionUndertimeWithGrace(arrivalMin: number, departureMin: number, schedStart: number, schedEnd: number): number {
  const duration = sessionDuration(schedStart, schedEnd);
  const rawLateArrival = lateArrivalMinutes(arrivalMin, schedStart, duration);
  const lateArrival = rawLateArrival <= GRACE_PERIOD_MINUTES ? 0 : rawLateArrival;
  const earlyDeparture = earlyDepartureMinutes(departureMin, schedStart, duration);
  return lateArrival + earlyDeparture;
}

export function computeAttendanceFromTimes(times: DtrTimes, schedule: ResolvedSchedule): ComputedAttendance {
  const session1Present = !!(times.amArrival && times.amDeparture);
  const session2Present = !!(times.pmArrival && times.pmDeparture);

  const lone = loneSession(schedule);
  if (lone) {
    // Continuous single-session schedule (e.g. a straight 12-hour shift) —
    // graded from whichever half of the DTR it's designated to (AM or PM).
    const present = lone.slot === "AM" ? session1Present : session2Present;
    if (present) {
      const arrival = lone.slot === "AM" ? times.amArrival! : times.pmArrival!;
      const departure = lone.slot === "AM" ? times.amDeparture! : times.pmDeparture!;
      const lateMinutes = sessionUndertimeWithGrace(minutesOfDay(arrival), minutesOfDay(departure), lone.start, lone.end);
      return lateMinutes > 0
        ? { code: "LATE", dayCredit: 1, lateMinutes }
        : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 };
    }
    return { code: "ABSENT", dayCredit: 0, lateMinutes: 0 };
  }

  if (session1Present && session2Present) {
    const amStart = schedule.session1!.start;
    const amEnd = schedule.session1!.end;
    const pmStart = schedule.session2!.start;
    const pmEnd = schedule.session2!.end;

    // AM arrival: grace-forgiven, same rule as everywhere else.
    const rawAmLate = lateArrivalMinutesSameDay(minutesOfDay(times.amArrival!), amStart, amEnd);
    const amLateArrival = rawAmLate <= GRACE_PERIOD_MINUTES ? 0 : rawAmLate;
    const amEarlyDeparture = earlyDepartureMinutesSameDay(minutesOfDay(times.amDeparture!), amStart, amEnd);

    // Leaving late for lunch pushes the return deadline out minute-for-
    // minute, capped at GRACE_PERIOD_MINUTES — e.g. leaving at 12:16 or
    // later never buys more than until 1:15 to be back. Below the cap
    // there's no separate forgiveness on top of it: back by 1:05 after
    // leaving at 12:05 is exactly on time, 1:06 is a minute late.
    const amDepartureDelay = Math.max(0, relativeMinutes(minutesOfDay(times.amDeparture!), amEnd));
    const pmDeadline = pmStart + Math.min(amDepartureDelay, GRACE_PERIOD_MINUTES);

    const pmLateArrival = lateArrivalMinutesSameDay(minutesOfDay(times.pmArrival!), pmDeadline, pmEnd);
    const pmEarlyDeparture = earlyDepartureMinutesSameDay(minutesOfDay(times.pmDeparture!), pmStart, pmEnd);

    const lateMinutes = amLateArrival + amEarlyDeparture + pmLateArrival + pmEarlyDeparture;
    return lateMinutes > 0
      ? { code: "LATE", dayCredit: 1, lateMinutes }
      : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 };
  }
  if (session1Present) return { code: "UNDERTIME_HALF", dayCredit: 0.5, lateMinutes: 0 };
  if (session2Present) return { code: "TARDY_HALF", dayCredit: 0.5, lateMinutes: 0 };
  return { code: "ABSENT", dayCredit: 0, lateMinutes: 0 };
}

// Minutes short of a full scheduled day, for display next to the code.
// LATE already carries this in ComputedAttendance.lateMinutes; the half-day
// and absent codes don't (their day-credit deduction is a fixed amount
// regardless of exactly how short), so it's derived from the schedule here
// instead of changing what computeAttendanceFromTimes returns.
export function undertimeMinutesForDisplay(
  code: AttendanceCode,
  lateMinutes: number,
  schedule: ResolvedSchedule,
): number {
  switch (code) {
    case "LATE":
      return lateMinutes;
    case "ABSENT":
      return scheduledDurationMinutes(schedule);
    case "UNDERTIME_HALF": // present AM only — missed the PM session
      return schedule.session2 ? sessionDuration(schedule.session2.start, schedule.session2.end) : 0;
    case "TARDY_HALF": // present PM only — missed the AM session
      return schedule.session1 ? sessionDuration(schedule.session1.start, schedule.session1.end) : 0;
    default:
      return 0;
  }
}

export type NightShiftContinuation = {
  // Combined shift grading, posted entirely to the start day.
  beforeGrade: ComputedAttendance;
  // The day after always gets zero credit of its own (the shift's credit
  // went to the start day) — this is true only when it has no arrival of
  // its own to show, so the DTR print's "From Duty" label applies instead
  // of hiding a real punch (see AttendanceDay.amArrivalFromDuty).
  afterAmArrivalFromDuty: boolean;
};

// A night shift that starts one calendar day and doesn't end until the
// next. Two ways this shows up:
//  - The evening arrival is entered on the START day with its departure
//    left blank (shift isn't over yet), and the morning departure ends up
//    on the NEXT day's row instead, with ITS arrival left blank (no fresh
//    arrival that morning) — neither row looks complete on its own.
//  - Or both rows get a full Time In/Time Out pair anyway (e.g. 10pm–11:59pm
//    on the start day, 12:00am–6am the next), purely for record-keeping —
//    the split is still artificial, not two separate shifts.
// Either way this combines them into one shift graded on the start day; the
// day after never adds its own extra credit.
type NightShiftDayFact = {
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
  overrideCode: ManualOverrideCode | null;
  // Requires an admin to have explicitly linked this day to the next one
  // (the join control on the DTR grid) — an overnight-shaped schedule plus a
  // blank field used to be enough on its own to trigger this combined
  // grading, which meant just configuring a wraparound schedule could dodge
  // undertime/tardiness detection with no one actually deciding that was
  // legitimate. See AttendanceDay.joinedWithNextDay.
  joinedWithNextDay: boolean;
};

export function detectNightShiftContinuation(
  dayBefore: NightShiftDayFact,
  dayAfter: NightShiftDayFact,
  scheduleForDayBefore: ResolvedSchedule,
  scheduleForDayAfter: ResolvedSchedule,
): NightShiftContinuation | null {
  if (!dayBefore.joinedWithNextDay) return null;
  if (dayBefore.overrideCode || dayAfter.overrideCode) return null;

  const beforeLone = loneSession(scheduleForDayBefore);
  if (!beforeLone || beforeLone.end >= beforeLone.start) return null;

  const beforeArrival = beforeLone.slot === "AM" ? dayBefore.amArrival : dayBefore.pmArrival;
  if (!beforeArrival) return null;

  // The closing punch reads from whichever half of the DTR the day AFTER is
  // itself designated to — almost always AM, since a departure this early
  // naturally lands there, but a day whose own schedule is PM-designated
  // keeps it under PM instead.
  const afterLone = loneSession(scheduleForDayAfter);
  const afterUsesAm = !afterLone || afterLone.slot === "AM";
  const afterDeparture = afterUsesAm ? dayAfter.amDeparture : dayAfter.pmDeparture;
  if (!afterDeparture) return null;
  const afterArrival = afterUsesAm ? dayAfter.amArrival : dayAfter.pmArrival;

  const lateMinutes = sessionUndertimeWithGrace(minutesOfDay(beforeArrival), minutesOfDay(afterDeparture), beforeLone.start, beforeLone.end);
  return {
    beforeGrade:
      lateMinutes > 0 ? { code: "LATE", dayCredit: 1, lateMinutes } : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 },
    // The "From Duty" print label is specifically an AM Arrival marker — if
    // the day after is itself PM-designated, its real arrival (if any) just
    // displays normally instead.
    afterAmArrivalFromDuty: afterUsesAm && !afterArrival,
  };
}

export type PreviewableRequest = DtrTimes & { overrideCode: ManualOverrideCode | null };

// Display-only preview of what a DtrEntryRequest will resolve to on approval.
export function previewRequestCode(request: PreviewableRequest, schedule: ResolvedSchedule): string {
  if (request.overrideCode) return ATTENDANCE_CODE_MAP[request.overrideCode].shortLabel;
  const computed = computeAttendanceFromTimes(request, schedule);
  return displayCodeForDay(computed.code, computed.lateMinutes);
}
