"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseISODate } from "@/lib/period";
import { MANUAL_OVERRIDE_CODES, combineDateAndTime, buildStoredSession, resolveSchedule, DAY_NAMES } from "@/lib/dtr-time";
import { logAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";

const timeField = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional();

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amArrival: timeField,
  amDeparture: timeField,
  pmArrival: timeField,
  pmDeparture: timeField,
  overrideCode: z.union([z.enum(MANUAL_OVERRIDE_CODES), z.literal("")]).optional(),
  remarks: z.string().max(1000).optional(),
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

  await prisma.$transaction(
    parsed.data.map((row) => {
      const date = parseISODate(row.date);
      // A day with no AM (or no PM) block never grades that half at all —
      // so a shift typed into the wrong columns doesn't silently sit there
      // unused and confusing once it's approved.
      const schedule = resolveSchedule(employee, date.getUTCDay());
      const hasAmBlock = !row.overrideCode && !!schedule.session1;
      const hasPmBlock = !row.overrideCode && !!schedule.session2;
      const data = {
        amArrival: hasAmBlock && row.amArrival ? combineDateAndTime(row.date, row.amArrival) : null,
        amDeparture: hasAmBlock && row.amDeparture ? combineDateAndTime(row.date, row.amDeparture) : null,
        pmArrival: hasPmBlock && row.pmArrival ? combineDateAndTime(row.date, row.pmArrival) : null,
        pmDeparture: hasPmBlock && row.pmDeparture ? combineDateAndTime(row.date, row.pmDeparture) : null,
        overrideCode: row.overrideCode || null,
        remarks: row.remarks?.trim() || null,
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

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  dayMode: z.enum(["STANDARD", "CUSTOM"]),
  hasSession1: z.boolean(),
  session1Start: z.string().optional(),
  session1End: z.string().optional(),
  hasSession2: z.boolean(),
  session2Start: z.string().optional(),
  session2End: z.string().optional(),
});

const scheduleSchema = z
  .object({
    scheduleMode: z.enum(["STANDARD", "CUSTOM", "PER_DAY"]),
    hasSession1: z.boolean(),
    session1Start: z.string().optional(),
    session1End: z.string().optional(),
    hasSession2: z.boolean(),
    session2Start: z.string().optional(),
    session2End: z.string().optional(),
    days: z.array(daySchema).length(7),
  })
  .refine((v) => v.scheduleMode !== "CUSTOM" || (v.session1Start && v.session1End), {
    message: "Session 1 start and end are required for a custom schedule",
  })
  .refine((v) => v.scheduleMode !== "CUSTOM" || !v.hasSession2 || (v.session2Start && v.session2End), {
    message: "Session 2 start and end are required when a second session is set",
  });

export async function updateMySchedule(input: unknown): Promise<FormState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { error: "Your account isn't linked to an employee record." };
  }

  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { scheduleMode, hasSession1, session1Start, session1End, hasSession2, session2Start, session2End, days } = parsed.data;
  const isCustom = scheduleMode === "CUSTOM";
  const customSession = buildStoredSession({ hasSession1, session1Start, session1End, hasSession2, session2Start, session2End });
  const employeeId = user.employeeId;

  if (scheduleMode === "PER_DAY") {
    for (const day of days) {
      if (day.dayMode !== "CUSTOM") continue;
      if (!day.session1Start || !day.session1End) {
        return { error: `${DAY_NAMES[day.dayOfWeek]}: time in and out are required` };
      }
      if (day.hasSession2 && (!day.session2Start || !day.session2End)) {
        return { error: `${DAY_NAMES[day.dayOfWeek]}: second time in and out are required` };
      }
    }
  }

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employeeId },
      data: {
        scheduleMode,
        session1Start: isCustom ? customSession.session1Start : null,
        session1End: isCustom ? customSession.session1End : null,
        session2Start: isCustom ? customSession.session2Start : null,
        session2End: isCustom ? customSession.session2End : null,
      },
    }),
    prisma.employeeDaySchedule.deleteMany({ where: { employeeId } }),
    ...(scheduleMode === "PER_DAY"
      ? days
          .filter((d) => d.dayMode !== "STANDARD")
          .map((d) => {
            const stored = buildStoredSession(d);
            return prisma.employeeDaySchedule.create({
              data: { employeeId, dayOfWeek: d.dayOfWeek, ...stored },
            });
          })
      : []),
  ]);

  await logAudit({
    actorId: user.id,
    entityType: "Employee",
    entityId: employeeId,
    action: "UPDATE",
    summary: `${user.name} updated their own work schedule`,
  });

  revalidatePath("/my-dtr");
  return { error: null };
}
