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
export const MANUAL_OVERRIDE_CODES = ["REST_DAY", "WORK_SUSPENDED", "UNSET"] as const;
export type ManualOverrideCode = (typeof MANUAL_OVERRIDE_CODES)[number];

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

export type EmployeeScheduleFields = {
  scheduleMode: ScheduleMode;
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
};

export type ResolvedSchedule = {
  session1: { start: number; end: number };
  // null = a single continuous session (e.g. a night shift with no lunch
  // break) — presence in session1 alone counts as a full day, not half.
  session2: { start: number; end: number } | null;
};

export function resolveSchedule(employee: EmployeeScheduleFields): ResolvedSchedule {
  if (employee.scheduleMode === "CUSTOM" && employee.session1Start !== null && employee.session1End !== null) {
    const session2 =
      employee.session2Start !== null && employee.session2End !== null
        ? { start: employee.session2Start, end: employee.session2End }
        : null;
    return { session1: { start: employee.session1Start, end: employee.session1End }, session2 };
  }
  return {
    session1: { start: STANDARD_HOURS.amStart, end: STANDARD_HOURS.amEnd },
    session2: { start: STANDARD_HOURS.pmStart, end: STANDARD_HOURS.pmEnd },
  };
}

// Minutes elapsed from `base` to `t`, wrapping through midnight (always 0-1439).
function relativeMinutes(t: number, base: number): number {
  return ((t - base) % 1440 + 1440) % 1440;
}

function sessionDuration(start: number, end: number): number {
  const duration = relativeMinutes(end, start);
  return duration === 0 ? 1440 : duration;
}

// Undertime for one session, schedule-relative so overnight sessions
// (end < start) work the same as same-day ones.
function sessionUndertime(arrivalMin: number, departureMin: number, schedStart: number, schedEnd: number): number {
  const duration = sessionDuration(schedStart, schedEnd);
  const arrivalRel = relativeMinutes(arrivalMin, schedStart);
  const departureRel = relativeMinutes(departureMin, schedStart);

  // If arrivalRel is beyond the session length, they most likely arrived
  // early (wrapped past midnight relative to the start), not hours late.
  const lateArrival = arrivalRel <= duration ? arrivalRel : 0;
  const earlyDeparture = departureRel < duration ? duration - departureRel : 0;

  return lateArrival + earlyDeparture;
}

export function computeAttendanceFromTimes(times: DtrTimes, schedule: ResolvedSchedule): ComputedAttendance {
  const session1Present = !!(times.amArrival && times.amDeparture);
  const session2Present = !!(times.pmArrival && times.pmDeparture);

  if (!schedule.session2) {
    // Continuous single-session schedule (e.g. a straight 12-hour shift).
    if (session1Present) {
      const lateMinutes = sessionUndertime(
        minutesOfDay(times.amArrival!),
        minutesOfDay(times.amDeparture!),
        schedule.session1.start,
        schedule.session1.end,
      );
      return lateMinutes > 0
        ? { code: "LATE", dayCredit: 1, lateMinutes }
        : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 };
    }
    return { code: "ABSENT", dayCredit: 0, lateMinutes: 0 };
  }

  if (session1Present && session2Present) {
    const lateMinutes =
      sessionUndertime(minutesOfDay(times.amArrival!), minutesOfDay(times.amDeparture!), schedule.session1.start, schedule.session1.end) +
      sessionUndertime(minutesOfDay(times.pmArrival!), minutesOfDay(times.pmDeparture!), schedule.session2.start, schedule.session2.end);
    return lateMinutes > 0
      ? { code: "LATE", dayCredit: 1, lateMinutes }
      : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 };
  }
  if (session1Present) return { code: "UNDERTIME_HALF", dayCredit: 0.5, lateMinutes: 0 };
  if (session2Present) return { code: "TARDY_HALF", dayCredit: 0.5, lateMinutes: 0 };
  return { code: "ABSENT", dayCredit: 0, lateMinutes: 0 };
}

export type PreviewableRequest = DtrTimes & { overrideCode: ManualOverrideCode | null };

// Display-only preview of what a DtrEntryRequest will resolve to on approval.
export function previewRequestCode(request: PreviewableRequest, schedule: ResolvedSchedule): string {
  if (request.overrideCode) return ATTENDANCE_CODE_MAP[request.overrideCode].shortLabel;
  const computed = computeAttendanceFromTimes(request, schedule);
  return displayCodeForDay(computed.code, computed.lateMinutes);
}
