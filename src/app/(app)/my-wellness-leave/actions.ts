"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { datesBetween, parseISODate } from "@/lib/period";
import { MAX_CONSECUTIVE_DAYS, getSemester } from "@/lib/wellness-leave";

export type FormState = { error: string | null };

const requestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional(),
});

export async function createMyWellnessLeaveRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { error: "Your account isn't linked to an employee record." };
  }

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const start = parseISODate(parsed.data.startDate);
  const end = parseISODate(parsed.data.endDate);
  if (end < start) return { error: "End date must be on or after the start date" };

  const dates = datesBetween(start, end);
  if (dates.length > MAX_CONSECUTIVE_DAYS) {
    return { error: `A single Wellness Leave request can cover at most ${MAX_CONSECUTIVE_DAYS} consecutive days` };
  }

  const semester = getSemester(start);
  if (getSemester(end) !== semester) {
    return { error: "The request must fall entirely within one semester (Jan–Jun or Jul–Dec)" };
  }

  await prisma.wellnessLeaveRequest.create({
    data: {
      employeeId: user.employeeId,
      startDate: start,
      endDate: end,
      daysCount: dates.length,
      notes: parsed.data.notes || null,
      requestedById: user.id,
    },
  });

  revalidatePath("/my-wellness-leave");
  revalidatePath("/admin/wellness-leave");
  return { error: null };
}
