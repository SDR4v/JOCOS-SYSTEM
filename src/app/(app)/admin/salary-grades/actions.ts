"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const rateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  salaryGrade: z.coerce.number().int().min(1).max(33),
  monthlyAmount: z.coerce.number().positive(),
});

export type FormState = { error: string | null };

export async function upsertSalaryGradeRate(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = rateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { year, salaryGrade, monthlyAmount } = parsed.data;
  const existed = await prisma.salaryGradeRate.findUnique({ where: { year_salaryGrade: { year, salaryGrade } } });
  const rate = await prisma.salaryGradeRate.upsert({
    where: { year_salaryGrade: { year, salaryGrade } },
    update: { monthlyAmount },
    create: { year, salaryGrade, monthlyAmount },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "SalaryGradeRate",
    entityId: rate.id,
    action: existed ? "UPDATE" : "CREATE",
    summary: `Set SG ${salaryGrade} rate for ${year} to ₱${monthlyAmount.toLocaleString()}`,
  });

  revalidatePath("/admin/salary-grades");
  return { error: null };
}

export async function deleteSalaryGradeRate(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const existing = await prisma.salaryGradeRate.findUnique({ where: { id } });
  if (!existing) return { error: "Rate not found" };

  await prisma.salaryGradeRate.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    entityType: "SalaryGradeRate",
    entityId: id,
    action: "DELETE",
    summary: `Removed SG ${existing.salaryGrade} rate for ${existing.year}`,
  });
  revalidatePath("/admin/salary-grades");
  return { error: null };
}
