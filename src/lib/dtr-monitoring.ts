// Cross-employee "is the DTR actually complete" view — nothing here writes
// anything, it only reads AttendanceDay/PunchRecord and reuses the same
// per-employee classification admin/dtr and the biometrics review screen
// already rely on (reviewEmployeePunches), just run across the whole roster
// instead of one employee or one upload at a time.
import { prisma } from "@/lib/prisma";
import { formatISODate, formatDisplayDate, datesBetween } from "@/lib/period";
import { reviewEmployeePunches, type EmployeeDayReview } from "@/lib/biometric-review";
import type { EmployeeScheduleFields } from "@/lib/dtr-time";

export type IncompleteReason = "no_punch_data" | "incomplete_punches" | "unsaved_biometric_data";

export const INCOMPLETE_REASON_LABEL: Record<IncompleteReason, string> = {
  no_punch_data: "No punch data",
  incomplete_punches: "Partial punches — needs manual entry",
  unsaved_biometric_data: "Biometric data ready — needs saving",
};

export type IncompleteDay = { iso: string; display: string; reason: IncompleteReason };

export type EmployeeIncompleteDtr = {
  employeeId: string;
  name: string;
  officeAssignment: string;
  days: IncompleteDay[];
};

export type UnmatchedName = {
  rawName: string;
  count: number;
  uploadId: string;
  uploadTitle: string;
};

type MonitoringEmployee = EmployeeScheduleFields & { id: string; name: string; officeAssignment: string };

// Which dates an employee is actually expected to have a DTR entry for.
// resolveSchedule() always falls back to a schedule (it can't itself express
// "not a work day"), so this can't be derived from it — instead this
// mirrors the DTR grid's own weekend-default convention: Mon-Fri for
// STANDARD/CUSTOM employees, and for PER_DAY employees only the weekdays
// that have an explicit EmployeeDaySchedule row with a session configured.
function isDueDate(employee: EmployeeScheduleFields, date: Date): boolean {
  const dow = date.getUTCDay();
  if (employee.scheduleMode === "PER_DAY") {
    const day = employee.daySchedules?.find((d) => d.dayOfWeek === dow);
    return !!day && (day.session1Start != null || day.session2Start != null);
  }
  return dow !== 0 && dow !== 6;
}

function classifyReason(review: EmployeeDayReview | undefined): IncompleteReason {
  if (!review || review.classification.kind === "blank") return "no_punch_data";
  if (review.classification.kind === "flagged") return "incomplete_punches";
  return "unsaved_biometric_data";
}

// Caps the scanned range at today — a future date in the selected period
// hasn't happened yet, so it's not "missing" anything.
function cappedRangeEnd(end: Date): Date {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return end < todayUtc ? end : todayUtc;
}

export async function getDtrMonitoringSummary(
  start: Date,
  end: Date,
): Promise<{ employees: EmployeeIncompleteDtr[]; unmatchedNames: UnmatchedName[] }> {
  const rangeEnd = cappedRangeEnd(end);
  const punchRangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  const [employees, attendanceDays, punches, unmatchedNames] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
      include: { daySchedules: true },
    }),
    prisma.attendanceDay.findMany({
      where: { date: { gte: start, lte: end } },
      select: { employeeId: true, date: true, code: true },
    }),
    prisma.punchRecord.findMany({
      where: {
        employeeId: { not: null },
        isDuplicate: false,
        timestamp: { gte: start, lt: punchRangeEnd },
        biometricUpload: { status: "REVIEWED" },
      },
      select: { employeeId: true, timestamp: true },
    }),
    getUnmatchedBiometricNames(start, punchRangeEnd),
  ]);

  const attendanceByKey = new Map<string, string>();
  for (const day of attendanceDays) {
    attendanceByKey.set(`${day.employeeId}:${formatISODate(day.date)}`, day.code);
  }

  const punchesByEmployee = new Map<string, Date[]>();
  for (const p of punches) {
    if (!p.employeeId) continue;
    const arr = punchesByEmployee.get(p.employeeId);
    if (arr) arr.push(p.timestamp);
    else punchesByEmployee.set(p.employeeId, [p.timestamp]);
  }

  const dueDates = rangeEnd >= start ? datesBetween(start, rangeEnd) : [];

  const result: EmployeeIncompleteDtr[] = [];
  for (const employee of employees as MonitoringEmployee[]) {
    const reviewByIso = new Map(
      reviewEmployeePunches(employee, punchesByEmployee.get(employee.id) ?? []).map((r) => [r.iso, r]),
    );

    const days: IncompleteDay[] = [];
    for (const date of dueDates) {
      if (!isDueDate(employee, date)) continue;
      const iso = formatISODate(date);
      const code = attendanceByKey.get(`${employee.id}:${iso}`);
      if (code && code !== "UNSET") continue;
      days.push({ iso, display: formatDisplayDate(iso), reason: classifyReason(reviewByIso.get(iso)) });
    }

    if (days.length > 0) {
      result.push({ employeeId: employee.id, name: employee.name, officeAssignment: employee.officeAssignment, days });
    }
  }

  return { employees: result, unmatchedNames };
}

async function getUnmatchedBiometricNames(start: Date, punchRangeEnd: Date): Promise<UnmatchedName[]> {
  const ignored = await prisma.ignoredBiometricName.findMany({ select: { rawName: true } });
  const ignoredSet = new Set(ignored.map((i) => i.rawName));

  const punches = await prisma.punchRecord.findMany({
    where: { employeeId: null, isDuplicate: false, timestamp: { gte: start, lt: punchRangeEnd } },
    select: { rawName: true, biometricUploadId: true, biometricUpload: { select: { title: true } } },
    orderBy: { timestamp: "desc" },
  });

  const byName = new Map<string, UnmatchedName>();
  for (const p of punches) {
    if (ignoredSet.has(p.rawName)) continue;
    const existing = byName.get(p.rawName);
    if (existing) {
      existing.count += 1;
    } else {
      byName.set(p.rawName, {
        rawName: p.rawName,
        count: 1,
        uploadId: p.biometricUploadId,
        uploadTitle: p.biometricUpload.title,
      });
    }
  }
  return Array.from(byName.values()).sort((a, b) => b.count - a.count);
}

// Cheap nav-badge count — reuses the same due-date/complete logic above so
// it can never drift out of sync with what the monitoring page itself shows.
export async function countEmployeesWithIncompleteDtr(start: Date, end: Date): Promise<number> {
  const { employees } = await getDtrMonitoringSummary(start, end);
  return employees.length;
}
