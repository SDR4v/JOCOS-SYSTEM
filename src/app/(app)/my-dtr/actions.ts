"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseISODate, formatFullDate } from "@/lib/period";
import {
  MANUAL_OVERRIDE_CODES,
  combineDateAndTime,
  resolveSchedule,
  type DateScheduleOverrideFields,
} from "@/lib/dtr-time";
import { logAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";
import {
  fetchDateScheduleOverridesForDates,
  setDateScheduleOverride,
  parseDateScheduleInput,
  type DateScheduleInput,
} from "@/lib/date-schedule";

const timeField = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional();

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amArrival: timeField,
  amDeparture: timeField,
  pmArrival: timeField,
  pmDeparture: timeField,
  overrideCode: z.union([z.enum(MANUAL_OVERRIDE_CODES), z.literal("")]).optional(),
  remarks: z.string().max(1000).optional(),
  joinedWithNextDay: z.boolean().optional(),
});

export type FormState = { error: string | null };

export async function submitDtrEntries(rows: unknown): Promise<FormState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { error: "Your account isn't linked to an employee record." };
  }

  const parsed = z.array(rowSchema).min(1).safeParse(rows);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const employeeId = user.employeeId;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, include: { daySchedules: true } });
  if (!employee) return { error: "Your account isn't linked to an employee record." };

  const dateOverrides = await fetchDateScheduleOverridesForDates(employeeId, parsed.data.map((row) => parseISODate(row.date)));

  await prisma.$transaction(
    parsed.data.map((row) => {
      const date = parseISODate(row.date);
      // A day with no AM (or no PM) block never grades that half at all —
      // so a shift typed into the wrong columns doesn't silently sit there
      // unused and confusing once it's approved.
      const schedule = resolveSchedule(employee, date.getUTCDay(), dateOverrides.get(row.date));
      const hasAmBlock = !row.overrideCode && !!schedule.session1;
      const hasPmBlock = !row.overrideCode && !!schedule.session2;
      const data = {
        amArrival: hasAmBlock && row.amArrival ? combineDateAndTime(row.date, row.amArrival) : null,
        amDeparture: hasAmBlock && row.amDeparture ? combineDateAndTime(row.date, row.amDeparture) : null,
        pmArrival: hasPmBlock && row.pmArrival ? combineDateAndTime(row.date, row.pmArrival) : null,
        pmDeparture: hasPmBlock && row.pmDeparture ? combineDateAndTime(row.date, row.pmDeparture) : null,
        overrideCode: row.overrideCode || null,
        remarks: row.remarks?.trim() || null,
        joinedWithNextDay: !!row.joinedWithNextDay,
        status: "PENDING" as const,
        submittedAt: new Date(),
        reviewedById: null,
        reviewedAt: null,
      };
      return prisma.dtrEntryRequest.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: data,
        create: { employeeId, date, ...data },
      });
    }),
  );

  const n = parsed.data.length;
  await logAudit({
    actorId: user.id,
    entityType: "DtrEntryRequest",
    entityId: employeeId,
    action: "CREATE",
    summary: `${user.name} submitted ${n} DTR entr${n > 1 ? "ies" : "y"} for review`,
  });
  await notifyAdmins(`${user.name} submitted ${n} DTR entr${n > 1 ? "ies" : "y"} for review`, "/admin/dtr-requests");

  // Also revalidate the shared layout — the "DTR Requests" nav badge (pending
  // count) is computed there, and a plain page-level revalidatePath doesn't
  // reach it.
  revalidatePath("/", "layout");
  return { error: null };
}

// Sets (or, given an all-blank input, clears) a one-off schedule for a
// single calendar date, on the employee's own record — see
// EmployeeDateSchedule and setEmployeeDateSchedule (the admin equivalent).
export async function setMyDateSchedule(
  dateIso: string,
  input: DateScheduleInput,
): Promise<{ error: string | null; value: DateScheduleOverrideFields | null }> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { error: "Your account isn't linked to an employee record.", value: null };
  }

  const parsed = parseDateScheduleInput(input);
  if ("error" in parsed) return { error: parsed.error, value: null };

  const date = parseISODate(dateIso);
  const value = await setDateScheduleOverride(user.employeeId, date, parsed);

  await logAudit({
    actorId: user.id,
    entityType: "EmployeeDateSchedule",
    entityId: user.employeeId,
    action: "UPDATE",
    summary: value
      ? `${user.name} set a one-off schedule for ${formatFullDate(date)}`
      : `${user.name} reverted their schedule on ${formatFullDate(date)} to the default`,
  });

  revalidatePath("/my-dtr");
  return { error: null, value };
}
