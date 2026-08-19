"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { SEMESTER_ALLOTMENT, wellnessLeaveDisplayStatus } from "@/lib/wellness-leave";

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

// For an employee who filed a physical paper application instead of using
// My Wellness Leave — once HR has it in hand, lock the request to Taken
// early rather than waiting for its end date to pass.
export async function markWellnessLeaveTaken(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };

  const displayStatus = wellnessLeaveDisplayStatus(request.status, request.endDate, request.confirmedTakenAt);
  if (displayStatus !== "UPCOMING") {
    return { error: "Only an upcoming request can be marked as taken" };
  }

  await prisma.wellnessLeaveRequest.update({
    where: { id },
    data: { confirmedTakenById: admin.id, confirmedTakenAt: new Date() },
  });

  revalidatePath("/admin/wellness-leave");
  revalidatePath("/my-wellness-leave");
  return { error: null };
}
