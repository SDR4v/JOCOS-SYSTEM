"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseISODate } from "@/lib/period";
import { AttendanceCode } from "@/generated/prisma/enums";

const rowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  code: z.enum(AttendanceCode),
  lateMinutes: z.coerce.number().int().min(0).max(1440).default(0),
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
      const lateMinutes = row.code === "LATE" ? row.lateMinutes : 0;
      const data = {
        code: row.code,
        lateMinutes,
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
