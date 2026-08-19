"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { parseISODate } from "@/lib/period";
import { computeAttendanceFromTimes, combineDateAndTime, resolveSchedule, MANUAL_OVERRIDE_CODES } from "@/lib/dtr-time";
import type { AttendanceCode } from "@/generated/prisma/enums";

const timeField = z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).optional();

const dtrRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amArrival: timeField,
  amDeparture: timeField,
  pmArrival: timeField,
  pmDeparture: timeField,
  overrideCode: z.union([z.enum(MANUAL_OVERRIDE_CODES), z.literal("")]).optional(),
  notes: z.string().trim().max(500).optional(),
});

const saveDtrSchema = z.object({
  employeeId: z.string().min(1),
  rows: z.array(dtrRowSchema).min(1),
});

export type SaveDtrInput = z.infer<typeof saveDtrSchema>;
export type FormState = { error: string | null };

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

  await prisma.$transaction(
    rows.map((row) => {
      const date = parseISODate(row.date);
      const schedule = resolveSchedule(employee, date.getUTCDay());

      let code: AttendanceCode;
      let dayCredit: number;
      let lateMinutes: number;
      let amArrival: Date | null = null;
      let amDeparture: Date | null = null;
      let pmArrival: Date | null = null;
      let pmDeparture: Date | null = null;

      if (row.overrideCode) {
        const meta = ATTENDANCE_CODE_MAP[row.overrideCode];
        code = meta.code;
        dayCredit = meta.defaultDayCredit;
        lateMinutes = 0;
      } else {
        amArrival = row.amArrival ? combineDateAndTime(row.date, row.amArrival) : null;
        amDeparture = row.amDeparture ? combineDateAndTime(row.date, row.amDeparture) : null;
        pmArrival = row.pmArrival ? combineDateAndTime(row.date, row.pmArrival) : null;
        pmDeparture = row.pmDeparture ? combineDateAndTime(row.date, row.pmDeparture) : null;
        const computed = computeAttendanceFromTimes({ amArrival, amDeparture, pmArrival, pmDeparture }, schedule);
        code = computed.code;
        dayCredit = computed.dayCredit;
        lateMinutes = computed.lateMinutes;
      }

      const data = {
        code,
        lateMinutes,
        dayCredit,
        amArrival,
        amDeparture,
        pmArrival,
        pmDeparture,
        notes: row.notes || null,
        source: "MANUAL" as const,
        editedById: user.id,
        editedAt: new Date(),
      };

      return prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: data,
        create: { employeeId, date, ...data },
      });
    }),
  );

  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/my-dtr");
  return { error: null };
}
