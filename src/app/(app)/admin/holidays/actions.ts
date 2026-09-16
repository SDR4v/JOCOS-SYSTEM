"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { parseISODate, formatFullDate } from "@/lib/period";
import { getStandardPhilippineHolidays } from "@/lib/holidays";
import { logAudit } from "@/lib/audit";

export type FormState = { error: string | null };

function revalidateHolidayPaths() {
  revalidatePath("/admin/holidays");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/monitoring");
  revalidatePath("/my-dtr");
  // The Monitoring nav badge (incomplete-DTR count) lives in the shared
  // (app) layout — see the same fix in admin/dtr-requests/actions.ts —
  // so a page-level revalidatePath above doesn't reach it on its own.
  revalidatePath("/", "layout");
}

// Writes AttendanceCode.HOLIDAY (0 credit — no work, no pay) or, for a
// SUSPENDED calendar entry, AttendanceCode.WORK_SUSPENDED (full credit, no
// deduction) into every active employee's AttendanceDay for the given date,
// so DTR and the JOCOS report both reflect it immediately. Leaves
// WELLNESS_LEAVE and TRIP_AUTHORIZATION records alone — those are governed
// by their own approval flows and shouldn't be silently overwritten.
async function syncHolidayAttendance(date: Date, adminId: string, type: "REGULAR" | "SPECIAL_NON_WORKING" | "SUSPENDED") {
  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  if (employees.length === 0) return;

  const existing = await prisma.attendanceDay.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) }, date },
    select: { employeeId: true, source: true },
  });
  const skip = new Set(
    existing.filter((d) => d.source === "WELLNESS_LEAVE" || d.source === "TRIP_AUTHORIZATION").map((d) => d.employeeId),
  );

  const isSuspended = type === "SUSPENDED";
  const data = {
    code: isSuspended ? ("WORK_SUSPENDED" as const) : ("HOLIDAY" as const),
    lateMinutes: 0,
    dayCredit: isSuspended ? 1 : 0,
    source: "HOLIDAY" as const,
    amArrival: null,
    amDeparture: null,
    pmArrival: null,
    pmDeparture: null,
    editedById: adminId,
    editedAt: new Date(),
  };

  await prisma.$transaction(
    employees
      .filter((e) => !skip.has(e.id))
      .map((e) =>
        prisma.attendanceDay.upsert({
          where: { employeeId_date: { employeeId: e.id, date } },
          update: data,
          create: { employeeId: e.id, date, ...data },
        }),
      ),
    // Prisma's default interactive-transaction timeout (5s) isn't enough to
    // upsert one row per active employee over the pooled remote connection
    // once the roster is a couple hundred people — it was rolling back
    // silently (Holiday row created, but no AttendanceDay actually written).
    { timeout: 30_000 },
  );
}

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["REGULAR", "SPECIAL_NON_WORKING", "SUSPENDED"]),
});

export async function createHoliday(input: unknown): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const date = parseISODate(parsed.data.date);
  const existing = await prisma.holiday.findUnique({ where: { date } });
  if (existing) {
    return { error: `${existing.name} is already set for this date` };
  }

  const holiday = await prisma.holiday.create({
    data: { date, name: parsed.data.name, type: parsed.data.type, createdById: admin.id },
  });
  await syncHolidayAttendance(date, admin.id, parsed.data.type);
  await logAudit({
    actorId: admin.id,
    entityType: "Holiday",
    entityId: holiday.id,
    action: "CREATE",
    summary: `Added holiday '${holiday.name}' on ${formatFullDate(date)}`,
  });

  revalidateHolidayPaths();
  return { error: null };
}

export async function deleteHoliday(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const holiday = await prisma.holiday.findUnique({ where: { id } });
  if (!holiday) return { error: "Holiday not found" };

  await prisma.$transaction([
    prisma.holiday.delete({ where: { id } }),
    prisma.attendanceDay.deleteMany({ where: { date: holiday.date, source: "HOLIDAY" } }),
  ]);
  await logAudit({
    actorId: admin.id,
    entityType: "Holiday",
    entityId: holiday.id,
    action: "DELETE",
    summary: `Removed holiday '${holiday.name}' on ${formatFullDate(holiday.date)}`,
  });

  revalidateHolidayPaths();
  return { error: null };
}

// Adds the well-known recurring PH holidays for a year in one click, skipping
// any date that already has a holiday set (an admin's own entry always wins).
export async function addStandardHolidays(year: number): Promise<FormState & { added?: number }> {
  const admin = await requireAdmin();

  const standard = getStandardPhilippineHolidays(year);
  const existingDates = new Set(
    (
      await prisma.holiday.findMany({
        where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
        select: { date: true },
      })
    ).map((h) => h.date.toISOString().slice(0, 10)),
  );

  let added = 0;
  for (const h of standard) {
    const date = new Date(Date.UTC(year, h.month - 1, h.day));
    const iso = date.toISOString().slice(0, 10);
    if (existingDates.has(iso)) continue;

    await prisma.holiday.create({
      data: { date, name: h.name, type: h.type, createdById: admin.id },
    });
    await syncHolidayAttendance(date, admin.id, h.type);
    added += 1;
  }

  if (added > 0) {
    await logAudit({
      actorId: admin.id,
      entityType: "Holiday",
      entityId: String(year),
      action: "CREATE",
      summary: `Added ${added} standard PH holiday(s) for ${year}`,
    });
  }

  revalidateHolidayPaths();
  return { error: null, added };
}
