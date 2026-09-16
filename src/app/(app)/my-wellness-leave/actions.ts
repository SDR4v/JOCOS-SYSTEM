"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { datesBetween, parseISODate, formatFullDate } from "@/lib/period";
import { MAX_CONSECUTIVE_DAYS, getSemester, canPullOutWellnessLeave } from "@/lib/wellness-leave";
import { logAudit } from "@/lib/audit";
import { notifyAdmins } from "@/lib/notify";

export type FormState = { error: string | null };

const requestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional(),
});

function revalidateWellnessLeavePaths() {
  revalidatePath("/my-wellness-leave");
  revalidatePath("/admin/wellness-leave");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/monitoring");
  revalidatePath("/my-dtr");
  // The Monitoring nav badge (incomplete-DTR count) lives in the shared
  // (app) layout — a page-level revalidatePath doesn't reach it on its own.
  revalidatePath("/", "layout");
}

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

  const year = start.getUTCFullYear();
  const employeeId = user.employeeId;

  const balance = await prisma.wellnessLeaveBalance.findUnique({
    where: { employeeId_year_semester: { employeeId, year, semester } },
  });
  if (!balance) {
    return { error: "No Wellness Leave balance has been set up for you yet. Ask HR to initialize it." };
  }

  const remaining = balance.allotted - balance.used;
  if (dates.length > remaining) {
    return { error: `Only ${remaining} Wellness Leave day(s) remaining this semester` };
  }

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.wellnessLeaveRequest.create({
      data: {
        employeeId,
        startDate: start,
        endDate: end,
        daysCount: dates.length,
        notes: parsed.data.notes || null,
        requestedById: user.id,
      },
    });
    await tx.wellnessLeaveBalance.update({
      where: { id: balance.id },
      data: { used: { increment: dates.length } },
    });
    for (const date of dates) {
      await tx.attendanceDay.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: {
          code: "WELLNESS_LEAVE",
          dayCredit: 1,
          lateMinutes: 0,
          source: "WELLNESS_LEAVE",
          editedById: user.id,
          editedAt: new Date(),
        },
        create: {
          employeeId,
          date,
          code: "WELLNESS_LEAVE",
          dayCredit: 1,
          source: "WELLNESS_LEAVE",
          editedById: user.id,
        },
      });
    }
    return created;
  });

  const period = `${formatFullDate(start)}–${formatFullDate(end)}`;
  await logAudit({
    actorId: user.id,
    entityType: "WellnessLeaveRequest",
    entityId: request.id,
    action: "CREATE",
    summary: `${user.name} filed Wellness Leave for ${period} (${dates.length} day${dates.length > 1 ? "s" : ""})`,
  });
  await notifyAdmins(`${user.name} filed Wellness Leave for ${period}`, "/admin/wellness-leave");

  revalidateWellnessLeavePaths();
  return { error: null };
}

export async function pullOutMyWellnessLeaveRequest(id: string): Promise<FormState> {
  const user = await requireUser();
  if (!user.employeeId) {
    return { error: "Your account isn't linked to an employee record." };
  }

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" };
  if (request.employeeId !== user.employeeId) return { error: "This isn't your request" };
  if (request.status === "CANCELLED") return { error: "This request has already been pulled out" };
  if (!canPullOutWellnessLeave(request.status, request.endDate, request.confirmedTakenAt)) {
    return request.confirmedTakenAt
      ? { error: "HR has already confirmed this Wellness Leave as taken and it can no longer be pulled out" }
      : { error: "This Wellness Leave has already taken place and can no longer be pulled out" };
  }

  const semester = getSemester(request.startDate);
  const year = request.startDate.getUTCFullYear();
  const dates = datesBetween(request.startDate, request.endDate);

  const balance = await prisma.wellnessLeaveBalance.findUnique({
    where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester } },
  });

  await prisma.$transaction([
    prisma.wellnessLeaveRequest.update({
      where: { id },
      data: { status: "CANCELLED", cancelledById: user.id, cancelledAt: new Date() },
    }),
    ...(balance
      ? [
          prisma.wellnessLeaveBalance.update({
            where: { id: balance.id },
            data: { used: { decrement: request.daysCount } },
          }),
        ]
      : []),
    prisma.attendanceDay.deleteMany({
      where: { employeeId: request.employeeId, date: { in: dates }, source: "WELLNESS_LEAVE" },
    }),
  ]);

  const period = `${formatFullDate(request.startDate)}–${formatFullDate(request.endDate)}`;
  await logAudit({
    actorId: user.id,
    entityType: "WellnessLeaveRequest",
    entityId: request.id,
    action: "UPDATE",
    summary: `${user.name} pulled out Wellness Leave for ${period}`,
  });
  await notifyAdmins(`${user.name} pulled out Wellness Leave for ${period}`, "/admin/wellness-leave");

  revalidateWellnessLeavePaths();
  return { error: null };
}
