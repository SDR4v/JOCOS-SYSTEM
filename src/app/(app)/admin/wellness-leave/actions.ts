"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { datesBetween, formatFullDate } from "@/lib/period";
import { SEMESTER_ALLOTMENT, getSemester, wellnessLeaveDisplayStatus, canPullOutWellnessLeave } from "@/lib/wellness-leave";
import { logAudit } from "@/lib/audit";

function revalidateWellnessLeavePaths() {
  revalidatePath("/admin/wellness-leave");
  revalidatePath("/my-wellness-leave");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/monitoring");
  revalidatePath("/my-dtr");
  // The Monitoring nav badge (incomplete-DTR count) lives in the shared
  // (app) layout — a page-level revalidatePath doesn't reach it on its own.
  revalidatePath("/", "layout");
}

export type FormState = { error: string | null };

export async function initializeWellnessLeaveBalances(year: number): Promise<FormState> {
  const admin = await requireAdmin();

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

  await logAudit({
    actorId: admin.id,
    entityType: "WellnessLeaveBalance",
    entityId: String(year),
    action: "CREATE",
    summary: `Initialized Wellness Leave balances for ${year} (${employees.length} employee(s))`,
  });

  revalidatePath("/admin/wellness-leave");
  return { error: null };
}

// For an employee who filed a physical paper application instead of using
// My Wellness Leave — once HR has it in hand, lock the request to Taken
// early rather than waiting for its end date to pass.
export async function markWellnessLeaveTaken(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!request) return { error: "Request not found" };

  const displayStatus = wellnessLeaveDisplayStatus(request.status, request.endDate, request.confirmedTakenAt);
  if (displayStatus !== "UPCOMING") {
    return { error: "Only an upcoming request can be marked as taken" };
  }

  await prisma.wellnessLeaveRequest.update({
    where: { id },
    data: { confirmedTakenById: admin.id, confirmedTakenAt: new Date() },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "WellnessLeaveRequest",
    entityId: request.id,
    action: "UPDATE",
    summary: `Marked ${request.employee.name}'s Wellness Leave (${formatFullDate(request.startDate)}–${formatFullDate(request.endDate)}) as taken`,
  });

  revalidatePath("/admin/wellness-leave");
  revalidatePath("/my-wellness-leave");
  return { error: null };
}

// Admin cleanup for a duplicate/erroneous filing. Deleting a still-ACTIVE
// request reverts it first (same balance/attendance-day cleanup as a
// pull-out) before hiding it in the Bin; deleting an already-CANCELLED one
// just hides it, since it was already reverted when it was cancelled. Same
// guard as the employee-facing pull-out: an ACTIVE request that's already
// taken (confirmed or past its end date) can't be silently reverted.
export async function deleteWellnessLeaveRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!request) return { error: "Request not found" };
  if (request.deletedAt) return { error: "This request has already been deleted" };
  if (request.status === "ACTIVE" && !canPullOutWellnessLeave(request.status, request.endDate, request.confirmedTakenAt)) {
    return request.confirmedTakenAt
      ? { error: "This Wellness Leave was already confirmed as taken and can no longer be deleted" }
      : { error: "This Wellness Leave has already taken place and can no longer be deleted" };
  }

  const wasActive = request.status === "ACTIVE";
  const semester = getSemester(request.startDate);
  const year = request.startDate.getUTCFullYear();
  const dates = datesBetween(request.startDate, request.endDate);

  const balance = wasActive
    ? await prisma.wellnessLeaveBalance.findUnique({
        where: { employeeId_year_semester: { employeeId: request.employeeId, year, semester } },
      })
    : null;

  await prisma.$transaction([
    prisma.wellnessLeaveRequest.update({
      where: { id },
      data: {
        deletedById: admin.id,
        deletedAt: new Date(),
        ...(wasActive ? { status: "CANCELLED" as const, cancelledById: admin.id, cancelledAt: new Date() } : {}),
      },
    }),
    ...(wasActive && balance
      ? [prisma.wellnessLeaveBalance.update({ where: { id: balance.id }, data: { used: { decrement: request.daysCount } } })]
      : []),
    ...(wasActive
      ? [
          prisma.attendanceDay.deleteMany({
            where: { employeeId: request.employeeId, date: { in: dates }, source: "WELLNESS_LEAVE" },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorId: admin.id,
    entityType: "WellnessLeaveRequest",
    entityId: request.id,
    action: "DELETE",
    summary: `Deleted ${request.employee.name}'s Wellness Leave request (${formatFullDate(request.startDate)}–${formatFullDate(request.endDate)})`,
  });

  revalidateWellnessLeavePaths();
  return { error: null };
}

// Un-hides a deleted request. Does NOT re-apply balance/attendance effects
// (to avoid double-booking) — the record just becomes visible again.
export async function restoreWellnessLeaveRequest(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.wellnessLeaveRequest.findUnique({ where: { id }, include: { employee: true } });
  if (!request) return { error: "Request not found" };
  if (!request.deletedAt) return { error: "This request isn't in the bin" };

  await prisma.wellnessLeaveRequest.update({
    where: { id },
    data: { deletedById: null, deletedAt: null },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "WellnessLeaveRequest",
    entityId: request.id,
    action: "UPDATE",
    summary: `Restored ${request.employee.name}'s Wellness Leave request (${formatFullDate(request.startDate)}–${formatFullDate(request.endDate)})`,
  });

  revalidateWellnessLeavePaths();
  return { error: null };
}
