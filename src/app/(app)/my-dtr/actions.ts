"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseISODate } from "@/lib/period";
import { MANUAL_OVERRIDE_CODES, combineDateAndTime } from "@/lib/dtr-time";

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
