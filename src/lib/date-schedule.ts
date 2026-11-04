// Shared lookups for what hours apply to an employee on a given date, so
// everything that grades or classifies a day reads the same answer. In order:
// the office's posted schedule (EmployeeDateSchedule), then Compressed Mode for
// anyone not exempt (see CompressedWorkPeriod), then, with nothing returned
// here, the employee's default.
import { prisma } from "@/lib/prisma";
import { datesBetween, formatISODate } from "@/lib/period";
import { COMPRESSED_HOURS, type DateScheduleOverrideFields } from "@/lib/dtr-time";

type Period = { startDate: Date; endDate: Date | null };

function compressedPeriods(start: Date, end: Date): Promise<Period[]> {
  return prisma.compressedWorkPeriod.findMany({
    where: { startDate: { lte: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] },
    select: { startDate: true, endDate: true },
  });
}

// Monday to Thursday are the working days of a compressed week.
export function compressedOverrideFor(date: Date): DateScheduleOverrideFields {
  const dow = date.getUTCDay();
  return dow >= 1 && dow <= 4
    ? { ...COMPRESSED_HOURS, compressed: true }
    : { session1Start: null, session1End: null, session2Start: null, session2End: null, isOff: true, compressed: true };
}

export function isInCompressedPeriod(date: Date, periods: Period[]): boolean {
  return periods.some((p) => p.startDate <= date && (!p.endDate || p.endDate >= date));
}

function fillCompressedDates(
  dates: Map<string, DateScheduleOverrideFields>,
  candidates: Date[],
  periods: Period[],
): void {
  for (const date of candidates) {
    const iso = formatISODate(date);
    if (!dates.has(iso) && isInCompressedPeriod(date, periods)) dates.set(iso, compressedOverrideFor(date));
  }
}

async function isExempt(employeeId: string): Promise<boolean> {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { compressedExempt: true } });
  return employee?.compressedExempt ?? true;
}

export async function fetchDateScheduleOverrides(
  employeeId: string,
  start: Date,
  end: Date,
): Promise<Map<string, DateScheduleOverrideFields>> {
  const [rows, periods] = await Promise.all([
    prisma.employeeDateSchedule.findMany({ where: { employeeId, date: { gte: start, lte: end } } }),
    compressedPeriods(start, end),
  ]);
  const dates = new Map<string, DateScheduleOverrideFields>(rows.map((r) => [formatISODate(r.date), r]));
  if (periods.length > 0 && !(await isExempt(employeeId))) fillCompressedDates(dates, datesBetween(start, end), periods);
  return dates;
}

export async function fetchDateScheduleOverridesForDates(
  employeeId: string,
  candidates: Date[],
): Promise<Map<string, DateScheduleOverrideFields>> {
  if (candidates.length === 0) return new Map();
  const times = candidates.map((d) => d.getTime());
  const [rows, periods] = await Promise.all([
    prisma.employeeDateSchedule.findMany({ where: { employeeId, date: { in: candidates } } }),
    compressedPeriods(new Date(Math.min(...times)), new Date(Math.max(...times))),
  ]);
  const dates = new Map<string, DateScheduleOverrideFields>(rows.map((r) => [formatISODate(r.date), r]));
  if (periods.length > 0 && !(await isExempt(employeeId))) fillCompressedDates(dates, candidates, periods);
  return dates;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The same lookup across many employees at once: employeeId → iso date → hours.
// Null means every active employee. `start` may be a punch's own timestamp, so
// it's taken back to midnight or that first day's row would be missed.
export async function fetchDateScheduleOverridesForEmployees(
  employeeIds: string[] | null,
  start: Date,
  end: Date,
): Promise<Map<string, Map<string, DateScheduleOverrideFields>>> {
  const from = startOfUtcDay(start);
  const to = startOfUtcDay(end);
  const [rows, periods] = await Promise.all([
    prisma.employeeDateSchedule.findMany({
      where: { date: { gte: from, lte: to }, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
    }),
    compressedPeriods(from, to),
  ]);

  const byEmployee = new Map<string, Map<string, DateScheduleOverrideFields>>();
  const datesFor = (employeeId: string) => {
    const dates = byEmployee.get(employeeId) ?? new Map<string, DateScheduleOverrideFields>();
    byEmployee.set(employeeId, dates);
    return dates;
  };
  for (const row of rows) datesFor(row.employeeId).set(formatISODate(row.date), row);

  if (periods.length > 0) {
    const covered = await prisma.employee.findMany({
      where: {
        compressedExempt: false,
        ...(employeeIds ? { id: { in: employeeIds } } : { status: "ACTIVE", deletedAt: null }),
      },
      select: { id: true },
    });
    const candidates = datesBetween(from, to);
    for (const { id } of covered) fillCompressedDates(datesFor(id), candidates, periods);
  }
  return byEmployee;
}
