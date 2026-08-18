"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { parseISODate } from "@/lib/period";
import { AttendanceCode } from "@/generated/prisma/enums";

const dtrRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  code: z.enum(AttendanceCode),
  lateMinutes: z.coerce.number().int().min(0).max(1440).default(0),
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

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return { error: "Employee not found" };

  await prisma.$transaction(
    rows.map((row) => {
      const meta = ATTENDANCE_CODE_MAP[row.code];
      const lateMinutes = row.code === "LATE" ? row.lateMinutes : 0;
      const date = parseISODate(row.date);
      const data = {
        code: row.code,
        lateMinutes,
        dayCredit: meta.defaultDayCredit,
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
