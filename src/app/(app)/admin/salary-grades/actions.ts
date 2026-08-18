"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const rateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  salaryGrade: z.coerce.number().int().min(1).max(33),
  monthlyAmount: z.coerce.number().positive(),
});

export type FormState = { error: string | null };

export async function upsertSalaryGradeRate(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { year, salaryGrade, monthlyAmount } = parsed.data;
  await prisma.salaryGradeRate.upsert({
    where: { year_salaryGrade: { year, salaryGrade } },
    update: { monthlyAmount },
    create: { year, salaryGrade, monthlyAmount },
  });

  revalidatePath("/admin/salary-grades");
  return { error: null };
}

export async function deleteSalaryGradeRate(id: string) {
  await requireAdmin();
  await prisma.salaryGradeRate.delete({ where: { id } });
  revalidatePath("/admin/salary-grades");
}
