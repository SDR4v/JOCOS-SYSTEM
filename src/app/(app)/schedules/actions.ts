"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { notifyAdmins, notifyUser } from "@/lib/notify";
import { MONTH_NAMES, getMonthRange, parseISODate } from "@/lib/period";
import { canAccessOffice, requireSchedulePoster, type ScheduleAccess } from "@/lib/schedule-access";
import { extractGrids, UnreadableFileError } from "@/lib/schedule-import/extract";
import { detectSchedule, tokenFromText } from "@/lib/schedule-import/detect";
import { activeRows, findBlockers, isReady } from "@/lib/schedule-import/review";
import { normalizeTokenKey, parseShiftText, type Shift } from "@/lib/schedule-import/shift-text";
import { BLANK_TOKEN, type ScheduleDocument } from "@/lib/schedule-import/types";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // matches next.config.ts's serverActions.bodySizeLimit

export type ActionResult = { error: string | null };

function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

async function rememberedCodes(office: string): Promise<Map<string, Shift>> {
  const rows = await prisma.scheduleShiftCode.findMany({ where: { office } });
  return new Map(rows.map((r) => [r.code, r.shift as unknown as Shift]));
}

const uploadSchema = z.object({
  office: z.string().trim().min(1, "Choose an office"),
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function uploadSchedule(formData: FormData): Promise<ActionResult & { id?: string }> {
  const access = await requireSchedulePoster();

  const parsed = uploadSchema.safeParse({
    office: access.isAdmin ? formData.get("office") : access.office,
    year: formData.get("year"),
    month: formData.get("month"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { office, year, month } = parsed.data;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload" };
  if (file.size > MAX_FILE_BYTES) return { error: "File is too large — the limit is 20MB" };

  const buffer = Buffer.from(await file.arrayBuffer());
  let grids;
  try {
    grids = await extractGrids(file.name, buffer);
  } catch (error) {
    if (error instanceof UnreadableFileError) return { error: error.message };
    throw error;
  }

  const allEmployees = await prisma.employee.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, officeAssignment: true },
  });
  const result = detectSchedule({
    grids,
    year,
    month,
    officeEmployees: allEmployees.filter((e) => e.officeAssignment === office),
    allEmployees,
    remembered: await rememberedCodes(office),
  });
  if (!result.ok) return { error: result.reason };

  const upload = await prisma.$transaction(async (tx) => {
    // Unfinished earlier attempts for this month give way to the new file. A
    // PUBLISHED one stays in force until this one is itself published.
    await tx.scheduleUpload.updateMany({
      where: { office, year, month, status: { in: ["DRAFT", "SUBMITTED"] } },
      data: { status: "SUPERSEDED" },
    });
    return tx.scheduleUpload.create({
      data: {
        office,
        year,
        month,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        fileData: buffer,
        document: result.document as unknown as Prisma.InputJsonValue,
        uploadedById: access.userId,
      },
    });
  });

  await logAudit({
    actorId: access.userId,
    entityType: "ScheduleUpload",
    entityId: upload.id,
    action: "CREATE",
    summary: `Uploaded ${office}'s schedule for ${monthLabel(year, month)} (${file.name})`,
  });

  revalidatePath("/schedules");
  return { error: null, id: upload.id };
}

type EditableUpload = { id: string; office: string; year: number; month: number; document: ScheduleDocument };

// Corrections are only open while it's a draft in the office's hands, or
// waiting on HR. Reopening is how a published schedule gets corrected.
async function loadEditable(
  access: ScheduleAccess,
  id: string,
): Promise<{ upload: EditableUpload } | { error: string }> {
  const upload = await prisma.scheduleUpload.findUnique({
    where: { id },
    select: { id: true, office: true, year: true, month: true, status: true, document: true },
  });
  if (!upload || !canAccessOffice(access, upload.office)) return { error: "Schedule not found" };
  if (upload.status === "PUBLISHED") return { error: "Reopen this schedule before correcting it" };
  if (upload.status === "SUPERSEDED") return { error: "A newer file has replaced this one" };
  if (upload.status === "SUBMITTED" && !access.isAdmin) return { error: "This is already with HR" };
  return { upload: { ...upload, document: upload.document as unknown as ScheduleDocument } };
}

async function saveDocument(id: string, document: ScheduleDocument) {
  await prisma.scheduleUpload.update({
    where: { id },
    data: { document: document as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/schedules/${id}`);
}

export async function linkRow(id: string, rowKey: string, employeeId: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { document, office } = loaded.upload;

  const row = document.rows.find((r) => r.key === rowKey);
  if (!row) return { error: "Row not found" };

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, status: "ACTIVE", deletedAt: null },
    select: { id: true, name: true, officeAssignment: true },
  });
  if (!employee) return { error: "Employee not found" };
  if (!access.isAdmin && employee.officeAssignment !== office) {
    return { error: "You can only link employees of your own office" };
  }
  const taken = activeRows(document).find((r) => r.employeeId === employeeId && r.key !== rowKey);
  if (taken) return { error: `${employee.name} is already on this schedule as "${taken.rawName}"` };

  row.employeeId = employee.id;
  row.employeeName = employee.name;
  row.match = "linked";
  await saveDocument(id, document);
  return { error: null };
}

// A row that isn't one of ours (a regular employee, say) stays out of the
// schedule; undoing it puts the row back as needing a match.
export async function setRowSkipped(id: string, rowKey: string, skipped: boolean): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { document } = loaded.upload;

  const row = document.rows.find((r) => r.key === rowKey);
  if (!row) return { error: "Row not found" };
  if (skipped) {
    row.match = "skipped";
    row.employeeId = null;
    row.employeeName = null;
  } else {
    row.match = "none";
  }
  await saveDocument(id, document);
  return { error: null };
}

function shiftFromMeaning(text: string): Shift | { error: string } {
  const key = normalizeTokenKey(text);
  if (key === "usual") return { kind: "usual" };
  const reading = parseShiftText(text);
  if (reading.shift) return reading.shift;
  if (reading.alternatives.length > 0) return { error: `"${text}" could mean day or night. Add AM or PM, like 10PM-6AM.` };
  return { error: `Couldn't read "${text}" as hours. Try something like 8AM-5PM or OFF.` };
}

export async function setTokenMeaning(id: string, tokenKey: string, meaning: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { document } = loaded.upload;

  const token = document.tokens[tokenKey];
  if (!token) return { error: "Code not found" };
  const shift = shiftFromMeaning(meaning);
  if ("error" in shift) return { error: shift.error };

  document.tokens[tokenKey] = { ...token, shift, source: "you", alternatives: [] };
  await saveDocument(id, document);
  return { error: null };
}

// What's typed goes through the same reader as the file, so a correction can be
// an existing code ("N"), new hours ("7-3"), "OFF", or blank.
export async function editCell(id: string, rowKey: string, iso: string, text: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { document, office } = loaded.upload;

  const row = document.rows.find((r) => r.key === rowKey);
  if (!row) return { error: "Row not found" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { error: "Invalid date" };

  const trimmed = text.trim();
  if (!trimmed) {
    row.cells[iso] = BLANK_TOKEN;
    document.tokens[BLANK_TOKEN] ??= { raw: "(blank cell)", shift: { kind: "off" }, source: "default", alternatives: [] };
  } else {
    const key = normalizeTokenKey(trimmed);
    if (!document.tokens[key]) {
      const reading = tokenFromText(trimmed, await rememberedCodes(office));
      if (!reading.shift && reading.alternatives.length === 0) {
        return { error: `Couldn't read "${trimmed}" as hours. Try something like 8AM-5PM or OFF.` };
      }
      document.tokens[key] = reading;
    }
    row.cells[iso] = key;
  }
  await saveDocument(id, document);
  return { error: null };
}

export async function submitSchedule(id: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { office, year, month, document } = loaded.upload;

  if (!isReady(findBlockers(document), document)) return { error: "Resolve the highlighted items first" };

  await prisma.scheduleUpload.update({ where: { id }, data: { status: "SUBMITTED", returnNote: null } });
  await logAudit({
    actorId: access.userId,
    entityType: "ScheduleUpload",
    entityId: id,
    action: "UPDATE",
    summary: `${access.userName} submitted ${office}'s schedule for ${monthLabel(year, month)} to HR`,
  });
  await notifyAdmins(`${office}'s schedule for ${monthLabel(year, month)} is ready to publish`, `/schedules/${id}`);

  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/", "layout");
  return { error: null };
}

export async function returnSchedule(id: string, note: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  if (!access.isAdmin) return { error: "Only HR can return a schedule" };

  const upload = await prisma.scheduleUpload.findUnique({
    where: { id },
    select: { office: true, year: true, month: true, status: true, uploadedById: true },
  });
  if (!upload) return { error: "Schedule not found" };
  if (upload.status !== "SUBMITTED") return { error: "Only a submitted schedule can be returned" };

  const returnNote = note.trim().slice(0, 500) || null;
  await prisma.scheduleUpload.update({ where: { id }, data: { status: "DRAFT", returnNote } });
  await logAudit({
    actorId: access.userId,
    entityType: "ScheduleUpload",
    entityId: id,
    action: "UPDATE",
    summary: `Returned ${upload.office}'s schedule for ${monthLabel(upload.year, upload.month)}`,
  });
  await notifyUser(
    upload.uploadedById,
    `HR returned your schedule for ${monthLabel(upload.year, upload.month)}${returnNote ? `: ${returnNote}` : ""}`,
    `/schedules/${id}`,
  );

  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/", "layout");
  return { error: null };
}

// Everyone on this file gets exactly what's in it for the month: their earlier
// rows for those dates are replaced, and anyone only on the schedule this one
// replaces goes back to their default.
export async function publishSchedule(id: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  if (!access.isAdmin) return { error: "Only HR can publish a schedule" };

  const loaded = await loadEditable(access, id);
  if ("error" in loaded) return { error: loaded.error };
  const { office, year, month, document } = loaded.upload;

  if (!isReady(findBlockers(document), document)) return { error: "Resolve the highlighted items first" };

  const rows = activeRows(document);
  const employeeIds = rows.map((r) => r.employeeId!);
  const { start, end } = getMonthRange(year, month);

  const data: Prisma.EmployeeDateScheduleCreateManyInput[] = [];
  for (const row of rows) {
    for (const [iso, tokenKey] of Object.entries(row.cells)) {
      const shift = document.tokens[tokenKey].shift!;
      if (shift.kind === "usual") continue;
      data.push({
        employeeId: row.employeeId!,
        date: parseISODate(iso),
        scheduleUploadId: id,
        isOff: shift.kind === "off",
        session1Start: shift.kind === "hours" ? (shift.session1?.start ?? null) : null,
        session1End: shift.kind === "hours" ? (shift.session1?.end ?? null) : null,
        session2Start: shift.kind === "hours" ? (shift.session2?.start ?? null) : null,
        session2End: shift.kind === "hours" ? (shift.session2?.end ?? null) : null,
      });
    }
  }

  // Only what a person decided or the file itself spelled out is worth
  // remembering. A plain "8AM-5PM" reads the same way every time anyway.
  const toRemember = Object.entries(document.tokens).filter(
    ([, token]) => token.shift && (token.source === "you" || token.source === "legend"),
  );

  const now = new Date();
  const previous = await prisma.scheduleUpload.findMany({
    where: { office, year, month, status: "PUBLISHED", id: { not: id } },
    select: { id: true },
  });
  const previousIds = previous.map((p) => p.id);

  await prisma.$transaction(
    async (tx) => {
      await tx.employeeDateSchedule.deleteMany({
        where: {
          date: { gte: start, lte: end },
          OR: [{ employeeId: { in: employeeIds } }, { scheduleUpload: { office, year, month } }],
        },
      });
      await tx.employeeDateSchedule.createMany({ data });
      await tx.scheduleUpload.updateMany({ where: { id: { in: previousIds } }, data: { status: "SUPERSEDED" } });
      await tx.scheduleUpload.update({
        where: { id },
        data: { status: "PUBLISHED", publishedById: access.userId, publishedAt: now, returnNote: null },
      });
      for (const [code, token] of toRemember) {
        const shift = token.shift as unknown as Prisma.InputJsonValue;
        await tx.scheduleShiftCode.upsert({
          where: { office_code: { office, code } },
          update: { shift },
          create: { office, code, shift },
        });
      }
    },
    { timeout: 60_000 },
  );

  await logAudit({
    actorId: access.userId,
    entityType: "ScheduleUpload",
    entityId: id,
    action: "UPDATE",
    summary: `Published ${office}'s schedule for ${monthLabel(year, month)} — ${rows.length} employee(s)`,
  });

  const users = await prisma.user.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
  if (users.length > 0) {
    await prisma.notification.createMany({
      data: users.map((u) => ({
        recipientId: u.id,
        message: `Your schedule for ${monthLabel(year, month)} has been posted`,
        link: "/my-dtr",
      })),
    });
  }

  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
  revalidatePath("/my-dtr");
  revalidatePath("/admin/dtr");
  revalidatePath("/admin/monitoring");
  revalidatePath("/", "layout");
  return { error: null };
}

// Lets HR correct a published schedule. The schedule stays in force exactly as
// published until it's published again.
export async function reopenSchedule(id: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();
  if (!access.isAdmin) return { error: "Only HR can reopen a schedule" };

  const upload = await prisma.scheduleUpload.findUnique({ where: { id }, select: { status: true } });
  if (upload?.status !== "PUBLISHED") return { error: "Only a published schedule can be reopened" };

  await prisma.scheduleUpload.update({ where: { id }, data: { status: "SUBMITTED" } });
  revalidatePath("/schedules");
  revalidatePath(`/schedules/${id}`);
  return { error: null };
}

// Deleting a schedule that took effect removes its dates too, putting those
// employees back on their default. Days already graded keep their grade.
export async function deleteSchedule(id: string): Promise<ActionResult> {
  const access = await requireSchedulePoster();

  const upload = await prisma.scheduleUpload.findUnique({
    where: { id },
    select: { office: true, year: true, month: true, status: true },
  });
  if (!upload || !canAccessOffice(access, upload.office)) return { error: "Schedule not found" };
  if (!access.isAdmin && upload.status !== "DRAFT") return { error: "Only HR can delete this now" };

  await prisma.$transaction([
    prisma.employeeDateSchedule.deleteMany({ where: { scheduleUploadId: id } }),
    prisma.scheduleUpload.delete({ where: { id } }),
  ]);
  await logAudit({
    actorId: access.userId,
    entityType: "ScheduleUpload",
    entityId: id,
    action: "DELETE",
    summary: `Deleted ${upload.office}'s schedule for ${monthLabel(upload.year, upload.month)}`,
  });

  revalidatePath("/schedules");
  revalidatePath("/my-dtr");
  revalidatePath("/admin/dtr");
  revalidatePath("/", "layout");
  return { error: null };
}
