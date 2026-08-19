"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseISODate } from "@/lib/period";
import { MANUAL_OVERRIDE_CODES, combineDateAndTime, hhmmToMinutes, DAY_NAMES } from "@/lib/dtr-time";

const timeField = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional();

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amArrival: timeField,
  amDeparture: timeField,
  pmArrival: timeField,
  pmDeparture: timeField,
  overrideCode: z.union([z.enum(MANUAL_OVERRIDE_CODES), z.literal("")]).optional(),
  notes: z.string().trim().max(500).optional(),
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

  await prisma.$transaction(
    parsed.data.map((row) => {
      const date = parseISODate(row.date);
      const data = {
        amArrival: !row.overrideCode && row.amArrival ? combineDateAndTime(row.date, row.amArrival) : null,
        amDeparture: !row.overrideCode && row.amDeparture ? combineDateAndTime(row.date, row.amDeparture) : null,
        pmArrival: !row.overrideCode && row.pmArrival ? combineDateAndTime(row.date, row.pmArrival) : null,
        pmDeparture: !row.overrideCode && row.pmDeparture ? combineDateAndTime(row.date, row.pmDeparture) : null,
        overrideCode: row.overrideCode || null,
        notes: row.notes || null,
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

  revalidatePath("/my-dtr");
  revalidatePath("/admin/dtr-requests");
  return { error: null };
}

const daySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  useStandard: z.boolean(),
  session1Start: z.string().optional(),
  session1End: z.string().optional(),
  hasSession2: z.boolean(),
  session2Start: z.string().optional(),
  session2End: z.string().optional(),
});

const scheduleSchema = z
  .object({
    scheduleMode: z.enum(["STANDARD", "CUSTOM", "PER_DAY"]),
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

  const { scheduleMode, session1Start, session1End, hasSession2, session2Start, session2End, days } = parsed.data;
  const isCustom = scheduleMode === "CUSTOM";
  const employeeId = user.employeeId;

  if (scheduleMode === "PER_DAY") {
    for (const day of days) {
      if (day.useStandard) continue;
      if (!day.session1Start || !day.session1End) {
        return { error: `${DAY_NAMES[day.dayOfWeek]}: session 1 start and end are required` };
      }
      if (day.hasSession2 && (!day.session2Start || !day.session2End)) {
        return { error: `${DAY_NAMES[day.dayOfWeek]}: session 2 start and end are required` };
      }
    }
  }

  await prisma.$transaction([
    prisma.employee.update({
      where: { id: employeeId },
      data: {
        scheduleMode,
        session1Start: isCustom ? hhmmToMinutes(session1Start!) : null,
        session1End: isCustom ? hhmmToMinutes(session1End!) : null,
        session2Start: isCustom && hasSession2 ? hhmmToMinutes(session2Start!) : null,
        session2End: isCustom && hasSession2 ? hhmmToMinutes(session2End!) : null,
      },
    }),
    prisma.employeeDaySchedule.deleteMany({ where: { employeeId } }),
    ...(scheduleMode === "PER_DAY"
      ? days
          .filter((d) => !d.useStandard)
          .map((d) =>
            prisma.employeeDaySchedule.create({
              data: {
                employeeId,
                dayOfWeek: d.dayOfWeek,
                session1Start: hhmmToMinutes(d.session1Start!),
                session1End: hhmmToMinutes(d.session1End!),
                session2Start: d.hasSession2 ? hhmmToMinutes(d.session2Start!) : null,
                session2End: d.hasSession2 ? hhmmToMinutes(d.session2End!) : null,
              },
            }),
          )
      : []),
  ]);

  revalidatePath("/my-dtr");
  return { error: null };
}
