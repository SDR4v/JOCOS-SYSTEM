"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { parseBiometricPdf } from "@/lib/biometric-parser";
import { markDuplicates, buildNameMatchIndex, matchEmployeeByName } from "@/lib/biometric-match";
import { reviewEmployeePunches, planEmployeeDays } from "@/lib/biometric-review";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB, matches next.config.ts's serverActions.bodySizeLimit

const metaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  periodStart: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  periodEnd: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
});

export type FormState = { error: string | null };

export async function uploadBiometricDocument(formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = metaSchema.safeParse({
    title: formData.get("title"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF file to upload" };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are accepted" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: "File is too large — the limit is 20MB" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { title, periodStart, periodEnd } = parsed.data;

  const upload = await prisma.biometricUpload.create({
    data: {
      title,
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      fileData: buffer,
      periodStart: periodStart ? new Date(`${periodStart}T00:00:00.000Z`) : null,
      periodEnd: periodEnd ? new Date(`${periodEnd}T00:00:00.000Z`) : null,
      uploadedById: admin.id,
    },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: upload.id,
    action: "CREATE",
    summary: `Uploaded biometrics file '${upload.title}'`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath("/biometrics");
  return { error: null };
}

// Parses the stored PDF, matches each punch's Name column to an employee
// (see matchEmployeeByName — exact name first, falling back to last+first
// name only when that's unambiguous), and writes one PunchRecord per punch
// (isDuplicate set for same-device scans a few minutes apart — see
// markDuplicates). Re-running this on an already-processed upload replaces
// its punches from scratch, so re-uploading a corrected export or re-parsing
// after a matching fix is always safe — the one thing it does NOT preserve
// is any manual employee links made via linkPunchesToEmployee, since those
// attached to the punches this just deleted.
export type ProcessResult = { error: string | null; droppedRows?: number };

export async function processBiometricUpload(id: string): Promise<ProcessResult> {
  const admin = await requireAdmin();

  const upload = await prisma.biometricUpload.findUnique({ where: { id } });
  if (!upload) return { error: "File not found" };

  const { punches, unparsedLines, droppedRows } = await parseBiometricPdf(Buffer.from(upload.fileData));
  if (punches.length === 0) {
    return { error: unparsedLines > 0 ? "Found rows but couldn't read any of them — the export format may have changed" : "No punch rows found in this PDF" };
  }

  const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
  const nameIndex = buildNameMatchIndex(employees);

  // Duplicates are about the device double-scanning, not about who it is —
  // group by the raw device "No." column, independent of whether it matched.
  const byRawNo = new Map<string, number[]>();
  punches.forEach((p, i) => {
    const list = byRawNo.get(p.rawNo);
    if (list) list.push(i);
    else byRawNo.set(p.rawNo, [i]);
  });
  const isDuplicate = new Array(punches.length).fill(false);
  for (const indices of byRawNo.values()) {
    const flags = markDuplicates(indices.map((i) => punches[i].timestamp));
    indices.forEach((punchIndex, j) => {
      isDuplicate[punchIndex] = flags[j];
    });
  }

  await prisma.$transaction(
    [
      prisma.punchRecord.deleteMany({ where: { biometricUploadId: id } }),
      prisma.punchRecord.createMany({
        data: punches.map((p, i) => ({
          biometricUploadId: id,
          employeeId: matchEmployeeByName(p.rawName, nameIndex)?.id ?? null,
          rawDept: p.rawDept || null,
          rawName: p.rawName,
          rawNo: p.rawNo,
          timestamp: p.timestamp,
          isDuplicate: isDuplicate[i],
        })),
      }),
      prisma.biometricUpload.update({ where: { id }, data: { status: "PROCESSED" } }),
    ],
    // Prisma's default is 5s — too short once a large multi-page export
    // (hundreds of pages, thousands of punches) is being written in one go.
    { timeout: 60_000 },
  );

  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: id,
    action: "UPDATE",
    summary: `Processed biometrics file '${upload.title}' — ${punches.length} punches read${droppedRows > 0 ? `, ${droppedRows} row(s) couldn't be read` : ""}`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath(`/admin/biometrics/${id}`);
  revalidatePath("/admin/monitoring");
  return { error: null, droppedRows };
}

// Manually links every still-unmatched punch under one raw scanned name to an
// employee — for the real-world cases automatic name matching can't safely
// resolve on its own (a dropped middle initial, "Jr." moved around, a typo).
// Only fills in punches that are still unmatched, so it can never silently
// steal punches away from a name that matched correctly on its own.
export async function linkPunchesToEmployee(uploadId: string, rawName: string, employeeId: string): Promise<FormState> {
  const admin = await requireAdmin();

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
  if (!employee) return { error: "Employee not found" };

  const { count } = await prisma.punchRecord.updateMany({
    where: { biometricUploadId: uploadId, rawName, employeeId: null },
    data: { employeeId, linkedManually: true },
  });
  if (count === 0) return { error: "Nothing to link — these punches may already be matched" };

  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: uploadId,
    action: "UPDATE",
    summary: `Linked ${count} punch(es) for "${rawName}" to ${employee.name}`,
  });

  revalidatePath(`/admin/biometrics/${uploadId}`);
  revalidatePath("/admin/monitoring");
  return { error: null };
}

// Undoes a hand-made link (see linkPunchesToEmployee) — for when it turns
// out to be the wrong person. Only ever touches punches THIS action linked
// (linkedManually: true), never an automatic name match, so it can't
// accidentally unpick something the matcher resolved on its own. The name
// goes back to "Unmatched" (or "Possible matches") on the review screen —
// nothing else about it changes, so it can be relinked correctly right away.
export async function unlinkPunches(uploadId: string, rawName: string): Promise<FormState> {
  const admin = await requireAdmin();

  const existing = await prisma.punchRecord.findFirst({
    where: { biometricUploadId: uploadId, rawName, linkedManually: true },
    select: { employee: { select: { name: true } } },
  });
  if (!existing) return { error: "Nothing to unlink" };

  const { count } = await prisma.punchRecord.updateMany({
    where: { biometricUploadId: uploadId, rawName, linkedManually: true },
    data: { employeeId: null, linkedManually: false },
  });

  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: uploadId,
    action: "UPDATE",
    summary: `Unlinked ${count} punch(es) for "${rawName}" from ${existing.employee?.name ?? "an employee"}`,
  });

  revalidatePath(`/admin/biometrics/${uploadId}`);
  revalidatePath("/admin/monitoring");
  return { error: null };
}

// Marks a scanned name as confirmed NOT one of this office's employees (a
// regular/permanent staffer, someone from another office — the shared
// biometric machine logs more than just this office's COS roster). Global by
// name, so it stops showing up in "Unmatched names" on every future upload
// too, not just this one.
export async function ignoreBiometricName(rawName: string): Promise<FormState> {
  const admin = await requireAdmin();

  await prisma.ignoredBiometricName.upsert({
    where: { rawName },
    update: {},
    create: { rawName, ignoredById: admin.id },
  });

  await logAudit({
    actorId: admin.id,
    entityType: "IgnoredBiometricName",
    entityId: rawName,
    action: "CREATE",
    summary: `Marked "${rawName}" as not an employee — hidden from future biometrics review`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath("/admin/monitoring");
  return { error: null };
}

export async function unignoreBiometricName(rawName: string): Promise<FormState> {
  const admin = await requireAdmin();

  await prisma.ignoredBiometricName.deleteMany({ where: { rawName } });

  await logAudit({
    actorId: admin.id,
    entityType: "IgnoredBiometricName",
    entityId: rawName,
    action: "DELETE",
    summary: `Un-ignored "${rawName}" — it will show up in unmatched review again`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath("/admin/monitoring");
  return { error: null };
}

export type ApplyResult = {
  error: string | null;
  summary?: { submitted: number; skippedExisting: number; flaggedDays: number; unmatchedPunches: number };
};

// Marks the upload REVIEWED, which is what makes its confident days show up
// PRE-FILLED (but still fully editable, and NOT yet submitted anywhere) on
// each matched employee's own My DTR page — see my-dtr/page.tsx, which reads
// PunchRecords straight from any REVIEWED upload. This writes nothing to
// AttendanceDay or DtrEntryRequest itself; the employee still has to look at
// the pre-filled times, fill in whatever biometrics couldn't resolve
// (flagged below), and click Submit themselves — which is what actually
// creates the DtrEntryRequest an admin approves at /admin/dtr-requests. A day
// that already has an official AttendanceDay OR an existing DtrEntryRequest
// is never pre-filled from biometrics — this only ever offers a default for
// a day nobody has touched yet.
export async function submitConfidentDaysForReview(uploadId: string): Promise<ApplyResult> {
  const admin = await requireAdmin();

  const upload = await prisma.biometricUpload.findUnique({ where: { id: uploadId } });
  if (!upload) return { error: "File not found" };
  if (upload.status === "UPLOADED") return { error: "Process this file first" };

  const punchRecords = await prisma.punchRecord.findMany({
    where: { biometricUploadId: uploadId, isDuplicate: false },
    orderBy: { timestamp: "asc" },
  });
  const ignoredNames = new Set((await prisma.ignoredBiometricName.findMany({ select: { rawName: true } })).map((n) => n.rawName));
  const unmatchedPunches = punchRecords.filter((p) => !p.employeeId && !ignoredNames.has(p.rawName)).length;

  const byEmployee = new Map<string, Date[]>();
  for (const p of punchRecords) {
    if (!p.employeeId) continue;
    const arr = byEmployee.get(p.employeeId);
    if (arr) arr.push(p.timestamp);
    else byEmployee.set(p.employeeId, [p.timestamp]);
  }

  const employees = await prisma.employee.findMany({
    where: { id: { in: [...byEmployee.keys()] } },
    include: { daySchedules: true },
  });

  const [existingDays, existingRequests] = await Promise.all([
    prisma.attendanceDay.findMany({
      where: { employeeId: { in: [...byEmployee.keys()] } },
      select: { employeeId: true, date: true },
    }),
    prisma.dtrEntryRequest.findMany({
      where: { employeeId: { in: [...byEmployee.keys()] } },
      select: { employeeId: true, date: true },
    }),
  ]);
  const blockedByEmployee = new Map<string, Set<string>>();
  for (const d of [...existingDays, ...existingRequests]) {
    const iso = d.date.toISOString().slice(0, 10);
    const set = blockedByEmployee.get(d.employeeId);
    if (set) set.add(iso);
    else blockedByEmployee.set(d.employeeId, new Set([iso]));
  }

  let submitted = 0;
  let flaggedDays = 0;
  let skippedExisting = 0;

  for (const employee of employees) {
    const punches = byEmployee.get(employee.id)!;
    const days = reviewEmployeePunches(employee, punches);
    const plans = planEmployeeDays(days, blockedByEmployee.get(employee.id) ?? new Set());

    for (const day of plans) {
      if (day.planAction === "flag") flaggedDays++;
      else if (day.planAction === "skip-existing") skippedExisting++;
      else submitted++;
    }
  }

  await prisma.biometricUpload.update({ where: { id: uploadId }, data: { status: "REVIEWED" } });

  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: uploadId,
    action: "UPDATE",
    summary: `Made ${submitted} confident day(s) from '${upload.title}' visible on employees' My DTR for review`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath(`/admin/biometrics/${uploadId}`);
  revalidatePath("/admin/monitoring");
  revalidatePath("/my-dtr");
  return { error: null, summary: { submitted, skippedExisting, flaggedDays, unmatchedPunches } };
}

export async function deleteBiometricUpload(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const existing = await prisma.biometricUpload.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!existing) return { error: "File not found" };

  await prisma.punchRecord.deleteMany({ where: { biometricUploadId: id } });
  await prisma.biometricUpload.delete({ where: { id } });
  await logAudit({
    actorId: admin.id,
    entityType: "BiometricUpload",
    entityId: id,
    action: "DELETE",
    summary: `Deleted biometrics file '${existing.title}'`,
  });

  revalidatePath("/admin/biometrics");
  revalidatePath("/biometrics");
  revalidatePath("/admin/monitoring");
  return { error: null };
}
