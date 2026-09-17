// Shared by admin DTR, My DTR, and DTR Requests approval — all three grade
// days and need to look up/apply the same one-off per-date schedule
// overrides (EmployeeDateSchedule) consistently, not just show them in the
// live on-screen preview.
import { prisma } from "@/lib/prisma";
import { formatISODate } from "@/lib/period";
import { hhmmToMinutes, type DateScheduleOverrideFields } from "@/lib/dtr-time";

export type DateScheduleInput = {
  session1Start: string;
  session1End: string;
  session2Start: string;
  session2End: string;
};

// A blank field means "no session" (the same convention used everywhere
// else a schedule is resolved), not zero — but a session needs BOTH ends
// filled in or both left blank; one without the other can't resolve to a
// time range.
export function parseDateScheduleInput(input: DateScheduleInput): DateScheduleOverrideFields | { error: string } {
  const session1Start = hhmmToMinutes(input.session1Start);
  const session1End = hhmmToMinutes(input.session1End);
  const session2Start = hhmmToMinutes(input.session2Start);
  const session2End = hhmmToMinutes(input.session2End);
  if ((session1Start === null) !== (session1End === null)) {
    return { error: "AM Start and AM End must both be filled in, or both left blank" };
  }
  if ((session2Start === null) !== (session2End === null)) {
    return { error: "PM Start and PM End must both be filled in, or both left blank" };
  }
  return { session1Start, session1End, session2Start, session2End };
}

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

// A blank submission (every field null) means "no override" — clear the row
// instead of leaving a pointless all-null record behind.
export async function setDateScheduleOverride(
  employeeId: string,
  date: Date,
  input: DateScheduleOverrideFields,
): Promise<DateScheduleOverrideFields | null> {
  const isBlank = !input.session1Start && !input.session1End && !input.session2Start && !input.session2End;
  if (isBlank) {
    await clearDateScheduleOverride(employeeId, date);
    return null;
  }
  const saved = await prisma.employeeDateSchedule.upsert({
    where: { employeeId_date: { employeeId, date } },
    update: input,
    create: { employeeId, date, ...input },
  });
  return {
    session1Start: saved.session1Start,
    session1End: saved.session1End,
    session2Start: saved.session2Start,
    session2End: saved.session2End,
  };
}

export async function clearDateScheduleOverride(employeeId: string, date: Date): Promise<void> {
  await prisma.employeeDateSchedule.deleteMany({ where: { employeeId, date } });
}
