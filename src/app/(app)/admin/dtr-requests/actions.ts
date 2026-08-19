"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";

export type FormState = { error: string | null };

export async function approveDtrEntryRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.dtrEntryRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.status !== "PENDING") return { error: "This request has already been resolved" };

  const meta = ATTENDANCE_CODE_MAP[request.code];
  const data = {
    code: request.code,
    lateMinutes: request.lateMinutes,
    dayCredit: meta.defaultDayCredit,
    notes: request.notes,
    source: "EMPLOYEE_REQUEST" as const,
    editedById: admin.id,
    editedAt: new Date(),
  };

  await prisma.$transaction([
    prisma.dtrEntryRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: new Date() },
    }),
    prisma.attendanceDay.upsert({
      where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
      update: data,
      create: { employeeId: request.employeeId, date: request.date, ...data },
    }),
  ]);

  revalidatePath("/admin/dtr-requests");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/my-dtr");
  return { error: null };
}

export async function rejectDtrEntryRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.dtrEntryRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.status !== "PENDING") return { error: "This request has already been resolved" };

  await prisma.dtrEntryRequest.update({
    where: { id },
    data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() },
  });

  revalidatePath("/admin/dtr-requests");
  revalidatePath("/my-dtr");
  return { error: null };
}
