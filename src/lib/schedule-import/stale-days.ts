// Days that were already saved before this schedule, and would grade
// differently under it. Publishing never rewrites these on its own: their
// punches may be filed under columns that no longer apply (a 4-punch day against
// a new single-session shift), and re-grading that blindly could read as a full
// absence. So they're listed for a person to open and re-save instead.
import { prisma } from "@/lib/prisma";
import { computeAttendanceFromTimes, resolveSchedule } from "@/lib/dtr-time";
import { formatISODate, getMonthRange } from "@/lib/period";
import { activeRows } from "@/lib/schedule-import/review";
import type { ScheduleDocument } from "@/lib/schedule-import/types";

export type StaleDay = { employeeId: string; employeeName: string; iso: string; reason: string };

const REGRADABLE = new Set(["PRESENT", "LATE", "UNDERTIME_HALF", "TARDY_HALF", "ABSENT"]);

export async function findStaleSavedDays(document: ScheduleDocument, year: number, month: number): Promise<StaleDay[]> {
  const rows = activeRows(document).filter((row) => row.employeeId);
  if (rows.length === 0) return [];
  const { start, end } = getMonthRange(year, month);
  const ids = rows.map((row) => row.employeeId!);

  const [days, employees] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: { employeeId: { in: ids }, date: { gte: start, lte: end } },
      orderBy: { date: "asc" },
    }),
    prisma.employee.findMany({ where: { id: { in: ids } }, include: { daySchedules: true } }),
  ]);
  const employeeById = new Map(employees.map((e) => [e.id, e]));
  const rowByEmployee = new Map(rows.map((row) => [row.employeeId!, row]));

  const stale: StaleDay[] = [];
  for (const day of days) {
    if (!REGRADABLE.has(day.code) || day.joinedWithNextDay || day.amArrivalFromDuty) continue;
    const employee = employeeById.get(day.employeeId);
    const iso = formatISODate(day.date);
    const token = rowByEmployee.get(day.employeeId)?.cells[iso];
    const shift = token ? document.tokens[token]?.shift : null;
    if (!employee || !shift || shift.kind === "usual") continue;

    if (shift.kind === "off") {
      stale.push({ employeeId: employee.id, employeeName: employee.name, iso, reason: "Now a day off" });
      continue;
    }
    const schedule = resolveSchedule(employee, day.date.getUTCDay(), {
      session1Start: shift.session1?.start ?? null,
      session1End: shift.session1?.end ?? null,
      session2Start: shift.session2?.start ?? null,
      session2End: shift.session2?.end ?? null,
    });
    const graded = computeAttendanceFromTimes(day, schedule);
    if (graded.code !== day.code || graded.lateMinutes !== day.lateMinutes || graded.dayCredit !== day.dayCredit) {
      stale.push({ employeeId: employee.id, employeeName: employee.name, iso, reason: "Different hours now" });
    }
  }
  return stale;
}
