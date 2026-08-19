"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { computeAttendanceFromTimes, resolveSchedule } from "@/lib/dtr-time";
import type { AttendanceCode } from "@/generated/prisma/enums";

export type FormState = { error: string | null };

export async function approveDtrEntryRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.dtrEntryRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.status !== "PENDING") return { error: "This request has already been resolved" };

  const employee = await prisma.employee.findUnique({
    where: { id: request.employeeId },
    include: { daySchedules: true },
  });
  if (!employee) return { error: "Employee not found" };

  let code: AttendanceCode;
  let dayCredit: number;
  let lateMinutes: number;

  if (request.overrideCode) {
    const meta = ATTENDANCE_CODE_MAP[request.overrideCode];
    code = meta.code;
    dayCredit = meta.defaultDayCredit;
    lateMinutes = 0;
  } else {
    const computed = computeAttendanceFromTimes(
      {
        amArrival: request.amArrival,
        amDeparture: request.amDeparture,
        pmArrival: request.pmArrival,
        pmDeparture: request.pmDeparture,
      },
      resolveSchedule(employee, request.date.getUTCDay()),
    );
    code = computed.code;
    dayCredit = computed.dayCredit;
    lateMinutes = computed.lateMinutes;
  }

  const data = {
    code,
    lateMinutes,
    dayCredit,
    amArrival: request.overrideCode ? null : request.amArrival,
    amDeparture: request.overrideCode ? null : request.amDeparture,
    pmArrival: request.overrideCode ? null : request.pmArrival,
    pmDeparture: request.overrideCode ? null : request.pmDeparture,
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
