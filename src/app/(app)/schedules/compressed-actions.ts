"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { formatFullDate, parseISODate } from "@/lib/period";

export type ActionResult = { error: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function revalidateAll() {
  revalidatePath("/schedules");
  revalidatePath("/my-dtr");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/employees");
  revalidatePath("/", "layout");
}

export async function startCompressedMode(startIso: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ISO_DATE.test(startIso)) return { error: "Choose a start date" };
  const startDate = parseISODate(startIso);

  const latest = await prisma.compressedWorkPeriod.findFirst({ orderBy: { startDate: "desc" } });
  if (latest && !latest.endDate) return { error: "Compressed Mode is already on" };
  if (latest?.endDate && startDate <= latest.endDate) {
    return { error: `The last period ran until ${formatFullDate(latest.endDate)}. Choose a later start date.` };
  }

  const period = await prisma.compressedWorkPeriod.create({ data: { startDate, startedById: admin.id } });
  await logAudit({
    actorId: admin.id,
    entityType: "CompressedWorkPeriod",
    entityId: period.id,
    action: "CREATE",
    summary: `Turned on Compressed Mode starting ${formatFullDate(startDate)}`,
  });

  const users = await prisma.user.findMany({
    where: { employee: { status: "ACTIVE", deletedAt: null, compressedExempt: false } },
    select: { id: true },
  });
  if (users.length > 0) {
    await prisma.notification.createMany({
      data: users.map((u) => ({
        recipientId: u.id,
        message: `Compressed work week starts ${formatFullDate(startDate)}: Monday to Thursday, start between 7:00 and 8:00 AM`,
        link: "/my-dtr",
      })),
    });
  }

  revalidateAll();
  return { error: null };
}

// `lastIso` is the last compressed day. Everything up to it stays compressed,
// so turning this off never changes an earlier stretch of dates.
export async function endCompressedMode(lastIso: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!ISO_DATE.test(lastIso)) return { error: "Choose the last day" };
  const endDate = parseISODate(lastIso);

  const latest = await prisma.compressedWorkPeriod.findFirst({ orderBy: { startDate: "desc" } });
  if (!latest) return { error: "Compressed Mode isn't on" };
  const today = parseISODate(new Date().toISOString().slice(0, 10));
  if (latest.endDate && latest.endDate < today) return { error: "Compressed Mode has already ended" };
  if (endDate < latest.startDate) {
    return { error: `The last day can't be before it started on ${formatFullDate(latest.startDate)}` };
  }

  await prisma.compressedWorkPeriod.update({ where: { id: latest.id }, data: { endDate } });
  await logAudit({
    actorId: admin.id,
    entityType: "CompressedWorkPeriod",
    entityId: latest.id,
    action: "UPDATE",
    summary: `Compressed Mode set to end after ${formatFullDate(endDate)}`,
  });

  revalidateAll();
  return { error: null };
}

export async function setOfficeCompressedExempt(office: string, exempt: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { count } = await prisma.employee.updateMany({
    where: { officeAssignment: office, deletedAt: null },
    data: { compressedExempt: exempt },
  });
  if (count === 0) return { error: "No employees in that office" };

  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: office,
    action: "UPDATE",
    summary: exempt
      ? `Exempted ${office} (${count} employees) from Compressed Mode`
      : `Put ${office} (${count} employees) under Compressed Mode`,
  });

  revalidateAll();
  return { error: null };
}

export async function toggleEmployeeCompressedExempt(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return { error: "Employee not found" };

  const compressedExempt = !employee.compressedExempt;
  await prisma.employee.update({ where: { id }, data: { compressedExempt } });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: id,
    action: "UPDATE",
    summary: compressedExempt
      ? `Exempted ${employee.name} from Compressed Mode`
      : `Put ${employee.name} under Compressed Mode`,
  });

  revalidateAll();
  return { error: null };
}
