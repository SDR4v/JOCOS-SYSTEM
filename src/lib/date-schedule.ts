// Shared lookups for each employee's published schedule (EmployeeDateSchedule),
// so everything that grades or classifies a day reads the same hours rather
// than only some screens following the posted schedule.
import { prisma } from "@/lib/prisma";
import { formatISODate } from "@/lib/period";
import type { DateScheduleOverrideFields } from "@/lib/dtr-time";

export async function fetchDateScheduleOverrides(
  employeeId: string,
  start: Date,
  end: Date,
): Promise<Map<string, DateScheduleOverrideFields>> {
  const rows = await prisma.employeeDateSchedule.findMany({
    where: { employeeId, date: { gte: start, lte: end } },
  });
  return new Map(rows.map((r) => [formatISODate(r.date), r]));
}

export async function fetchDateScheduleOverridesForDates(
  employeeId: string,
  dates: Date[],
): Promise<Map<string, DateScheduleOverrideFields>> {
  if (dates.length === 0) return new Map();
  const rows = await prisma.employeeDateSchedule.findMany({
    where: { employeeId, date: { in: dates } },
  });
  return new Map(rows.map((r) => [formatISODate(r.date), r]));
}

// The same lookup across many employees at once: employeeId → iso date → hours.
export async function fetchDateScheduleOverridesForEmployees(
  employeeIds: string[] | null,
  start: Date,
  end: Date,
): Promise<Map<string, Map<string, DateScheduleOverrideFields>>> {
  const rows = await prisma.employeeDateSchedule.findMany({
    where: { date: { gte: start, lte: end }, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) },
  });
  const byEmployee = new Map<string, Map<string, DateScheduleOverrideFields>>();
  for (const row of rows) {
    const dates = byEmployee.get(row.employeeId) ?? new Map<string, DateScheduleOverrideFields>();
    byEmployee.set(row.employeeId, dates);
    dates.set(formatISODate(row.date), row);
  }
  return byEmployee;
}
