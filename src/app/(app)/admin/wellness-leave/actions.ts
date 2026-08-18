"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { datesBetween, parseISODate } from "@/lib/period";
import { SEMESTER_ALLOTMENT, MAX_CONSECUTIVE_DAYS, getSemester } from "@/lib/wellness-leave";

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

const requestSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional(),
});

export async function createWellnessLeaveRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

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
      employeeId: parsed.data.employeeId,
      startDate: start,
      endDate: end,
      daysCount: dates.length,
      notes: parsed.data.notes || null,
      requestedById: admin.id,
    },
  });

  revalidatePath("/admin/wellness-leave");
  return { error: null };
}

export async function approveWellnessLeaveRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.status !== "PENDING") return { error: "This request has already been resolved" };

  const semester = getSemester(request.startDate);
  const year = request.startDate.getUTCFullYear();
  const balance = await prisma.wellnessLeaveBalance.findUnique({
    where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester } },
  });
  if (!balance) {
    return { error: "No Wellness Leave balance found for this employee/semester. Initialize the year first." };
  }

  const remaining = balance.allotted - balance.used;
  if (request.daysCount > remaining) {
    return { error: `Only ${remaining} Wellness Leave day(s) remaining this semester` };
  }

  const dates = datesBetween(request.startDate, request.endDate);

  await prisma.$transaction([
    prisma.wellnessLeaveRequest.update({
      where: { id },
      data: { status: "APPROVED", approvedById: admin.id, approvedAt: new Date() },
    }),
    prisma.wellnessLeaveBalance.update({
      where: { id: balance.id },
      data: { used: { increment: request.daysCount } },
    }),
    ...dates.map((date) =>
      prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: request.employeeId, date } },
        update: {
          code: "WELLNESS_LEAVE",
          dayCredit: 1,
          lateMinutes: 0,
          source: "WELLNESS_LEAVE",
          editedById: admin.id,
          editedAt: new Date(),
        },
        create: {
          employeeId: request.employeeId,
          date,
          code: "WELLNESS_LEAVE",
          dayCredit: 1,
          source: "WELLNESS_LEAVE",
          editedById: admin.id,
        },
      }),
    ),
  ]);

  revalidatePath("/admin/wellness-leave");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/my-dtr");
  revalidatePath("/my-wellness-leave");
  return { error: null };
}

export async function rejectWellnessLeaveRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.status !== "PENDING") return { error: "This request has already been resolved" };

  await prisma.wellnessLeaveRequest.update({
    where: { id },
    data: { status: "REJECTED", approvedById: admin.id, approvedAt: new Date() },
  });

  revalidatePath("/admin/wellness-leave");
  revalidatePath("/my-wellness-leave");
  return { error: null };
}
