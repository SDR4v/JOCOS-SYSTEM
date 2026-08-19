// Derives the JOCOS attendance code/day-credit/late-minutes from a day's
// punch times (CS Form No. 48: AM arrival/departure, PM arrival/departure).
// Manually entered today; RFID/biometric capture fills the same four fields
// later without changing this function.
import type { AttendanceCode } from "@/generated/prisma/enums";
import { ATTENDANCE_CODE_MAP, displayCodeForDay } from "@/lib/attendance-codes";

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

export function combineDateAndTime(dateIso: string, timeHHMM: string): Date | null {
  if (!timeHHMM) return null;
  const [hourStr, minuteStr] = timeHHMM.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const [year, month, day] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function undertimeForHalf(arrival: Date | null, departure: Date | null, start: number, end: number): number {
  if (!arrival || !departure) return 0;
  const lateArrival = Math.max(0, minutesOfDay(arrival) - start);
  const earlyDeparture = Math.max(0, end - minutesOfDay(departure));
  return lateArrival + earlyDeparture;
}

export function computeAttendanceFromTimes(times: DtrTimes): ComputedAttendance {
  const amPresent = !!(times.amArrival && times.amDeparture);
  const pmPresent = !!(times.pmArrival && times.pmDeparture);

  if (amPresent && pmPresent) {
    const lateMinutes =
      undertimeForHalf(times.amArrival, times.amDeparture, STANDARD_HOURS.amStart, STANDARD_HOURS.amEnd) +
      undertimeForHalf(times.pmArrival, times.pmDeparture, STANDARD_HOURS.pmStart, STANDARD_HOURS.pmEnd);
    return lateMinutes > 0
      ? { code: "LATE", dayCredit: 1, lateMinutes }
      : { code: "PRESENT", dayCredit: 1, lateMinutes: 0 };
  }
  if (amPresent) return { code: "UNDERTIME_HALF", dayCredit: 0.5, lateMinutes: 0 };
  if (pmPresent) return { code: "TARDY_HALF", dayCredit: 0.5, lateMinutes: 0 };
  return { code: "ABSENT", dayCredit: 0, lateMinutes: 0 };
}

export type PreviewableRequest = DtrTimes & { overrideCode: ManualOverrideCode | null };

// Display-only preview of what a DtrEntryRequest will resolve to on approval.
export function previewRequestCode(request: PreviewableRequest): string {
  if (request.overrideCode) return ATTENDANCE_CODE_MAP[request.overrideCode].shortLabel;
  const computed = computeAttendanceFromTimes(request);
  return displayCodeForDay(computed.code, computed.lateMinutes);
}
