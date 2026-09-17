import { AttendanceCode } from "@/generated/prisma/enums";

export type AttendanceCodeMeta = {
  code: AttendanceCode;
  label: string;
  shortLabel: string;
  defaultDayCredit: number;
  takesLateMinutes: boolean;
};

// Day-credit rules confirmed by HR (see plan: C:\Users\rgnac\.claude\plans\lazy-marinating-kay.md)
export const ATTENDANCE_CODES: AttendanceCodeMeta[] = [
  { code: "PRESENT", label: "Present (full day)", shortLabel: "0", defaultDayCredit: 1, takesLateMinutes: false },
  { code: "LATE", label: "Present, late/undertime (minutes)", shortLabel: "min", defaultDayCredit: 1, takesLateMinutes: true },
  { code: "ABSENT", label: "Absent", shortLabel: "A", defaultDayCredit: 0, takesLateMinutes: false },
  { code: "UNDERTIME_HALF", label: "Undertime — present AM only", shortLabel: "U", defaultDayCredit: 0.5, takesLateMinutes: false },
  { code: "TARDY_HALF", label: "Tardiness — present PM only", shortLabel: "T", defaultDayCredit: 0.5, takesLateMinutes: false },
  { code: "REST_DAY", label: "Rest day / off (excluded)", shortLabel: "X", defaultDayCredit: 0, takesLateMinutes: false },
  { code: "WORK_SUSPENDED", label: "Work suspended (no pay)", shortLabel: "WS", defaultDayCredit: 0, takesLateMinutes: false },
  { code: "WELLNESS_LEAVE", label: "Wellness Leave", shortLabel: "WL", defaultDayCredit: 1, takesLateMinutes: false },
  { code: "TRIP_AUTHORIZATION", label: "Trip Authorization", shortLabel: "TA", defaultDayCredit: 1, takesLateMinutes: false },
  { code: "HOLIDAY", label: "Holiday (no work, no pay)", shortLabel: "H", defaultDayCredit: 0, takesLateMinutes: false },
  { code: "UNSET", label: "Not yet recorded", shortLabel: "—", defaultDayCredit: 0, takesLateMinutes: false },
];

export const ATTENDANCE_CODE_MAP: Record<AttendanceCode, AttendanceCodeMeta> = Object.fromEntries(
  ATTENDANCE_CODES.map((meta) => [meta.code, meta]),
) as Record<AttendanceCode, AttendanceCodeMeta>;

export function displayCodeForDay(code: AttendanceCode, lateMinutes: number): string {
  if (code === "LATE") return String(lateMinutes);
  return ATTENDANCE_CODE_MAP[code].shortLabel;
}
