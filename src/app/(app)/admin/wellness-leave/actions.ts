"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { SEMESTER_ALLOTMENT } from "@/lib/wellness-leave";

export type FormState = { error: string | null };

export async function initializeWellnessLeaveBalances(year: number): Promise<FormState> {
  await requireAdmin();

  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true } });

  await prisma.$transaction(
    employees.flatMap((employee) => [
      prisma.wellnessLeaveBalance.upsert({
        where: { employeeId_year_semester: { employeeId: employee.id, year, semester: 1 } },
        update: {},
        create: { employeeId: employee.id, year, semester: 1, allotted: SEMESTER_ALLOTMENT[1] },
      }),
      prisma.wellnessLeaveBalance.upsert({
        where: { employeeId_year_semester: { employeeId: employee.id, year, semester: 2 } },
        update: {},
        create: { employeeId: employee.id, year, semester: 2, allotted: SEMESTER_ALLOTMENT[2] },
      }),
    ]),
  );

  revalidatePath("/admin/wellness-leave");
  return { error: null };
}
