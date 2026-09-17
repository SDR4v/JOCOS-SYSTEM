"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { parseISODate, formatISODate } from "@/lib/period";
import {
  computeAttendanceFromTimes,
  detectNightShiftContinuation,
  combineDateAndTime,
  minutesToHHMM,
  resolveSchedule,
  MANUAL_OVERRIDE_CODES,
  MANUAL_OVERRIDE_SET,
  ONE_DAY_MS,
  gradeChanged,
  gradeUpdateData,
  type Grade,
  type ManualOverrideCode,
  type EmployeeScheduleFields,
} from "@/lib/dtr-time";
import type { AttendanceCode } from "@/generated/prisma/enums";
import { logAudit } from "@/lib/audit";

const timeField = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional();

const dtrRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amArrival: timeField,
  amDeparture: timeField,
  pmArrival: timeField,
  pmDeparture: timeField,
  overrideCode: z.union([z.enum(MANUAL_OVERRIDE_CODES), z.literal("")]).optional(),
  amArrivalIsTA: z.boolean().optional(),
  amDepartureIsTA: z.boolean().optional(),
  pmArrivalIsTA: z.boolean().optional(),
  pmDepartureIsTA: z.boolean().optional(),
  remarks: z.string().max(1000).optional(),
});

const saveDtrSchema = z.object({
  employeeId: z.string().min(1),
  rows: z.array(dtrRowSchema).min(1),
});

export type SaveDtrInput = z.infer<typeof saveDtrSchema>;
export type FormState = { error: string | null };

type DayFact = {
  iso: string;
  date: Date;
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
  overrideCode: ManualOverrideCode | null;
  // Each punch marked TA carries its own scheduled moment here (not a real
  // punch) so the existing grading math treats it as on-time without
  // needing its own code path — these flags say which fields to null out
  // before saving and whether the day's code should read TRIP_AUTHORIZATION.
  amArrivalIsTA: boolean;
  amDepartureIsTA: boolean;
  pmArrivalIsTA: boolean;
  pmDepartureIsTA: boolean;
  // Only ever set from the actual save batch below — a boundary day fetched
  // just for night-shift pairing never needs or touches its own remarks.
  remarks: string | null;
};

function factFromExisting(date: Date, existing: { amArrival: Date | null; amDeparture: Date | null; pmArrival: Date | null; pmDeparture: Date | null; code: AttendanceCode } | null): DayFact {
  const overrideCode = existing && MANUAL_OVERRIDE_SET.has(existing.code) ? (existing.code as ManualOverrideCode) : null;
  return {
    iso: formatISODate(date),
    date,
    amArrival: existing?.amArrival ?? null,
    amDeparture: existing?.amDeparture ?? null,
    pmArrival: existing?.pmArrival ?? null,
    pmDeparture: existing?.pmDeparture ?? null,
    overrideCode,
    amArrivalIsTA: false,
    amDepartureIsTA: false,
    pmArrivalIsTA: false,
    pmDepartureIsTA: false,
    remarks: null,
  };
}

// Grades a contiguous run of days, resolving night-shift continuations that
// span midnight (see detectNightShiftContinuation) — a day with only an
// evening arrival pairs with the NEXT day's morning-only departure into one
// shift, credited entirely to the first day.
function gradeSequence(sequence: DayFact[], employee: EmployeeScheduleFields): Map<string, Grade> {
  const grades = new Map<string, Grade>();

  for (let i = 0; i < sequence.length; i++) {
    const day = sequence[i];
    if (grades.has(day.iso)) continue;

    if (day.overrideCode) {
      const meta = ATTENDANCE_CODE_MAP[day.overrideCode];
      grades.set(day.iso, { code: meta.code, dayCredit: meta.defaultDayCredit, lateMinutes: 0, amArrivalFromDuty: false });
      continue;
    }

    const schedule = resolveSchedule(employee, day.date.getUTCDay());

    if (day.amArrivalIsTA || day.amDepartureIsTA || day.pmArrivalIsTA || day.pmDepartureIsTA) {
      // Graded from the scheduled-time stand-ins already on this fact (see
      // parsedRows below) — never pairs into a night-shift continuation.
      const computed = computeAttendanceFromTimes(day, schedule);
      grades.set(day.iso, {
        code: "TRIP_AUTHORIZATION",
        dayCredit: computed.dayCredit,
        lateMinutes: computed.lateMinutes,
        amArrivalFromDuty: false,
      });
      continue;
    }

    const next = sequence[i + 1];
    const adjacent = next && next.date.getTime() === day.date.getTime() + ONE_DAY_MS ? next : null;
    const adjacentSchedule = adjacent ? resolveSchedule(employee, adjacent.date.getUTCDay()) : null;
    const pair = adjacent && adjacentSchedule ? detectNightShiftContinuation(day, adjacent, schedule, adjacentSchedule) : null;

    if (pair && adjacent) {
      grades.set(day.iso, { ...pair.beforeGrade, amArrivalFromDuty: false });
      grades.set(adjacent.iso, {
        code: pair.afterAmArrivalFromDuty ? "UNSET" : "PRESENT",
        dayCredit: 0,
        lateMinutes: 0,
        amArrivalFromDuty: pair.afterAmArrivalFromDuty,
      });
      continue;
    }

    const computed = computeAttendanceFromTimes(day, schedule);
    grades.set(day.iso, { ...computed, amArrivalFromDuty: false });
  }

  return grades;
}

export async function saveDtrPeriod(input: SaveDtrInput): Promise<FormState> {
  const user = await requireAdmin();

  const parsed = saveDtrSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { employeeId, rows } = parsed.data;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { daySchedules: true },
  });
  if (!employee) return { error: "Employee not found" };

  const parsedRows: DayFact[] = rows.map((row) => {
    const date = parseISODate(row.date);
    // A day with no AM (or no PM) block never grades that half at all (see
    // computeAttendanceFromTimes) — so stale or misplaced values (e.g. a
    // single-session shift typed into the wrong columns) never get silently
    // saved and left sitting unused/confusing on the record or the printed DTR.
    const schedule = resolveSchedule(employee, date.getUTCDay());
    const hasAmBlock = !row.overrideCode && !!schedule.session1;
    const hasPmBlock = !row.overrideCode && !!schedule.session2;
    const amArrivalIsTA = hasAmBlock && !!row.amArrivalIsTA;
    const amDepartureIsTA = hasAmBlock && !!row.amDepartureIsTA;
    const pmArrivalIsTA = hasPmBlock && !!row.pmArrivalIsTA;
    const pmDepartureIsTA = hasPmBlock && !!row.pmDepartureIsTA;

    function resolveTime(raw: string | undefined, hasBlock: boolean, isTA: boolean, minutes: number | undefined) {
      if (isTA) return minutes !== undefined ? combineDateAndTime(row.date, minutesToHHMM(minutes)) : null;
      return hasBlock && raw ? combineDateAndTime(row.date, raw) : null;
    }

    return {
      iso: row.date,
      date,
      amArrival: resolveTime(row.amArrival, hasAmBlock, amArrivalIsTA, schedule.session1?.start),
      amDeparture: resolveTime(row.amDeparture, hasAmBlock, amDepartureIsTA, schedule.session1?.end),
      pmArrival: resolveTime(row.pmArrival, hasPmBlock, pmArrivalIsTA, schedule.session2?.start),
      pmDeparture: resolveTime(row.pmDeparture, hasPmBlock, pmDepartureIsTA, schedule.session2?.end),
      overrideCode: row.overrideCode || null,
      amArrivalIsTA,
      amDepartureIsTA,
      pmArrivalIsTA,
      pmDepartureIsTA,
      remarks: row.remarks?.trim() || null,
    };
  });

  // Also check one day before/after this batch, so a night shift crossing a
  // save boundary (e.g. the half-month split on the 15th/16th) still pairs
  // up correctly — whichever half gets saved second is the one that
  // resolves it, retroactively fixing the other day's grade if needed.
  const dayBeforeDate = new Date(parsedRows[0].date.getTime() - ONE_DAY_MS);
  const dayAfterDate = new Date(parsedRows[parsedRows.length - 1].date.getTime() + ONE_DAY_MS);

  const [existingBefore, existingAfter] = await Promise.all([
    prisma.attendanceDay.findUnique({ where: { employeeId_date: { employeeId, date: dayBeforeDate } } }),
    prisma.attendanceDay.findUnique({ where: { employeeId_date: { employeeId, date: dayAfterDate } } }),
  ]);

  const sequence: DayFact[] = [
    factFromExisting(dayBeforeDate, existingBefore),
    ...parsedRows,
    factFromExisting(dayAfterDate, existingAfter),
  ];
  const grades = gradeSequence(sequence, employee);

  const now = new Date();
  const ops = parsedRows.map((row) => {
    const grade = grades.get(row.iso)!;
    const data = {
      code: grade.code,
      lateMinutes: grade.lateMinutes,
      dayCredit: grade.dayCredit,
      // A TA punch's stand-in time above is used only for grading — never
      // store it as if it were a real punch (there wasn't one; that's the
      // point of the TA slip).
      amArrival: row.amArrivalIsTA ? null : row.amArrival,
      amArrivalFromDuty: grade.amArrivalFromDuty,
      amDeparture: row.amDepartureIsTA ? null : row.amDeparture,
      pmArrival: row.pmArrivalIsTA ? null : row.pmArrival,
      pmDeparture: row.pmDepartureIsTA ? null : row.pmDeparture,
      remarks: row.remarks,
      // Preserve provenance — deleteHoliday() matches on source: "HOLIDAY"
      // to know which rows to clean up when a holiday is removed, and
      // re-saving the period shouldn't erase that; TRIP_AUTHORIZATION is
      // tagged the same way so it stays identifiable as TA-covered.
      source:
        row.overrideCode === "HOLIDAY"
          ? ("HOLIDAY" as const)
          : row.amArrivalIsTA || row.amDepartureIsTA || row.pmArrivalIsTA || row.pmDepartureIsTA
            ? ("TRIP_AUTHORIZATION" as const)
            : ("MANUAL" as const),
      editedById: user.id,
      editedAt: now,
    };
    return prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId, date: row.date } },
      update: data,
      create: { employeeId, date: row.date, ...data },
    });
  });

  // A pairing can also retroactively change a boundary day just outside
  // this batch (e.g. the shift started on the 15th, and this save is what
  // supplies the 16th's departure) — re-save it too, but only if its own
  // times were already on file and its grade actually moved.
  for (const [fact, existing] of [
    [sequence[0], existingBefore],
    [sequence[sequence.length - 1], existingAfter],
  ] as const) {
    if (!existing) continue;
    const grade = grades.get(fact.iso);
    if (!grade || !gradeChanged(grade, existing)) continue;
    ops.push(
      prisma.attendanceDay.update({
        where: { id: existing.id },
        data: gradeUpdateData(grade, user.id, now),
      }),
    );
  }

  await prisma.$transaction(ops);

  await logAudit({
    actorId: user.id,
    entityType: "AttendanceDay",
    entityId: employeeId,
    action: "UPDATE",
    summary: `Saved DTR for ${employee.name}, ${rows.length} day${rows.length > 1 ? "s" : ""}`,
  });

  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/monitoring");
  revalidatePath("/my-dtr");
  // The Monitoring nav badge (incomplete-DTR count) lives in the shared
  // (app) layout — a page-level revalidatePath doesn't reach it on its own.
  revalidatePath("/", "layout");
  return { error: null };
}
