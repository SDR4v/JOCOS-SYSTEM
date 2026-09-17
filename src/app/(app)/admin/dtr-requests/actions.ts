"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import {
  computeAttendanceFromTimes,
  detectNightShiftContinuation,
  resolveSchedule,
  MANUAL_OVERRIDE_SET,
  ONE_DAY_MS,
  gradeChanged,
  gradeUpdateData,
  type Grade,
  type ManualOverrideCode,
} from "@/lib/dtr-time";
import { logAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { formatFullDate, formatISODate } from "@/lib/period";

export type FormState = { error: string | null };

type DayFact = {
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
  overrideCode: ManualOverrideCode | null;
};

// The pending-count nav badge lives in the shared (app) layout — a plain
// revalidatePath("/admin/dtr-requests") only busts that one page's cache,
// not the layout wrapping every route, so the badge never refreshed after
// approve/reject/revert. Revalidating the root layout fixes that everywhere.
function revalidateDtrRequestPaths() {
  revalidatePath("/", "layout");
}

export async function approveDtrEntryRequest(id: string): Promise<FormState> {
  return approveDtrEntryRequests([id]);
}

export async function approveDtrEntryRequests(ids: string[]): Promise<FormState> {
  const admin = await requireAdmin();
  if (ids.length === 0) return { error: "No requests to approve" };

  const requests = await prisma.dtrEntryRequest.findMany({ where: { id: { in: ids }, status: "PENDING" } });
  if (requests.length === 0) return { error: "These requests have already been resolved" };

  const employees = await prisma.employee.findMany({
    where: { id: { in: Array.from(new Set(requests.map((r) => r.employeeId))) } },
    include: { daySchedules: true, user: true },
  });
  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  // A night-shift continuation (see detectNightShiftContinuation) may pair
  // this request with the CALENDAR day before/after it — which could be
  // another request in this same approval batch, or an already-official
  // AttendanceDay that isn't being touched otherwise. Prefer the in-batch
  // request's proposed times over stale DB data for that lookup.
  const dayKey = (employeeId: string, date: Date) => `${employeeId}|${formatISODate(date)}`;
  const requestByKey = new Map(requests.map((r) => [dayKey(r.employeeId, r.date), r]));

  const neighborKeys = requests.flatMap((r) => [
    { employeeId: r.employeeId, date: new Date(r.date.getTime() - ONE_DAY_MS) },
    { employeeId: r.employeeId, date: new Date(r.date.getTime() + ONE_DAY_MS) },
  ]);
  const neighborsToFetch = neighborKeys.filter((n) => !requestByKey.has(dayKey(n.employeeId, n.date)));
  const existingNeighbors = neighborsToFetch.length
    ? await prisma.attendanceDay.findMany({
        where: { OR: neighborsToFetch.map((n) => ({ employeeId: n.employeeId, date: n.date })) },
      })
    : [];
  const existingByKey = new Map(existingNeighbors.map((d) => [dayKey(d.employeeId, d.date), d]));

  // One-off per-date schedule overrides (see EmployeeDateSchedule) for every
  // date resolveSchedule gets called with below — the request's own date
  // plus both neighbors, since a night-shift pairing check resolves those
  // too.
  const scheduleDateKeys = requests.flatMap((r) => [
    { employeeId: r.employeeId, date: r.date },
    { employeeId: r.employeeId, date: new Date(r.date.getTime() - ONE_DAY_MS) },
    { employeeId: r.employeeId, date: new Date(r.date.getTime() + ONE_DAY_MS) },
  ]);
  const dateOverrideRows = await prisma.employeeDateSchedule.findMany({
    where: { OR: scheduleDateKeys.map((k) => ({ employeeId: k.employeeId, date: k.date })) },
  });
  const dateOverrideByKey = new Map(dateOverrideRows.map((r) => [dayKey(r.employeeId, r.date), r]));

  function factFor(employeeId: string, date: Date): DayFact {
    const key = dayKey(employeeId, date);
    const req = requestByKey.get(key);
    if (req) {
      const overrideCode = req.overrideCode as ManualOverrideCode | null;
      return {
        amArrival: overrideCode ? null : req.amArrival,
        amDeparture: overrideCode ? null : req.amDeparture,
        pmArrival: overrideCode ? null : req.pmArrival,
        pmDeparture: overrideCode ? null : req.pmDeparture,
        overrideCode,
      };
    }
    const existing = existingByKey.get(key);
    const overrideCode = existing && MANUAL_OVERRIDE_SET.has(existing.code) ? (existing.code as ManualOverrideCode) : null;
    return {
      amArrival: existing?.amArrival ?? null,
      amDeparture: existing?.amDeparture ?? null,
      pmArrival: existing?.pmArrival ?? null,
      pmDeparture: existing?.pmDeparture ?? null,
      overrideCode,
    };
  }

  const grades = new Map<string, Grade>();

  for (const request of requests) {
    const key = dayKey(request.employeeId, request.date);
    if (grades.has(key)) continue;

    const employee = employeeMap.get(request.employeeId);
    if (!employee) continue;

    if (request.overrideCode) {
      const meta = ATTENDANCE_CODE_MAP[request.overrideCode];
      grades.set(key, { code: meta.code, dayCredit: meta.defaultDayCredit, lateMinutes: 0, amArrivalFromDuty: false });
      continue;
    }

    const thisFact = factFor(request.employeeId, request.date);
    const schedule = resolveSchedule(employee, request.date.getUTCDay(), dateOverrideByKey.get(key));

    // This request as the shift's START (evening arrival) pairing with the
    // NEXT calendar day's departure.
    const nextDate = new Date(request.date.getTime() + ONE_DAY_MS);
    const nextSchedule = resolveSchedule(
      employee,
      nextDate.getUTCDay(),
      dateOverrideByKey.get(dayKey(request.employeeId, nextDate)),
    );
    const forwardPair = detectNightShiftContinuation(thisFact, factFor(request.employeeId, nextDate), schedule, nextSchedule);
    if (forwardPair) {
      grades.set(key, { ...forwardPair.beforeGrade, amArrivalFromDuty: false });
      grades.set(dayKey(request.employeeId, nextDate), {
        code: forwardPair.afterAmArrivalFromDuty ? "UNSET" : "PRESENT",
        dayCredit: 0,
        lateMinutes: 0,
        amArrivalFromDuty: forwardPair.afterAmArrivalFromDuty,
      });
      continue;
    }

    // This request as the shift's CLOSE (departure) pairing with the
    // PREVIOUS calendar day's evening arrival.
    const prevDate = new Date(request.date.getTime() - ONE_DAY_MS);
    const prevSchedule = resolveSchedule(
      employee,
      prevDate.getUTCDay(),
      dateOverrideByKey.get(dayKey(request.employeeId, prevDate)),
    );
    const backwardPair = detectNightShiftContinuation(factFor(request.employeeId, prevDate), thisFact, prevSchedule, schedule);
    if (backwardPair) {
      grades.set(dayKey(request.employeeId, prevDate), { ...backwardPair.beforeGrade, amArrivalFromDuty: false });
      grades.set(key, {
        code: backwardPair.afterAmArrivalFromDuty ? "UNSET" : "PRESENT",
        dayCredit: 0,
        lateMinutes: 0,
        amArrivalFromDuty: backwardPair.afterAmArrivalFromDuty,
      });
      continue;
    }

    const computed = computeAttendanceFromTimes(thisFact, schedule);
    grades.set(key, { ...computed, amArrivalFromDuty: false });
  }

  const now = new Date();
  const ops = requests.flatMap((request) => {
    const employee = employeeMap.get(request.employeeId);
    if (!employee) return [];

    const grade = grades.get(dayKey(request.employeeId, request.date))!;
    // A day with no AM (or no PM) block never grades that half at all —
    // don't let a shift typed into the wrong columns quietly become part of
    // the official record.
    const requestSchedule = resolveSchedule(
      employee,
      request.date.getUTCDay(),
      dateOverrideByKey.get(dayKey(request.employeeId, request.date)),
    );
    const hasAmBlock = !request.overrideCode && !!requestSchedule.session1;
    const hasPmBlock = !request.overrideCode && !!requestSchedule.session2;
    const data = {
      code: grade.code,
      lateMinutes: grade.lateMinutes,
      dayCredit: grade.dayCredit,
      amArrival: hasAmBlock ? request.amArrival : null,
      amArrivalFromDuty: grade.amArrivalFromDuty,
      amDeparture: hasAmBlock ? request.amDeparture : null,
      pmArrival: hasPmBlock ? request.pmArrival : null,
      pmDeparture: hasPmBlock ? request.pmDeparture : null,
      remarks: request.remarks,
      source: "EMPLOYEE_REQUEST" as const,
      editedById: admin.id,
      editedAt: now,
    };

    return [
      prisma.dtrEntryRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: now },
      }),
      prisma.attendanceDay.upsert({
        where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
        update: data,
        create: { employeeId: request.employeeId, date: request.date, ...data },
      }),
    ];
  });

  // A pairing can also retroactively change an already-official day just
  // outside this batch (e.g. yesterday's shift only now gets its closing
  // departure) — re-save it too, but only if its grade actually moved.
  for (const [key, grade] of grades) {
    if (requestByKey.has(key)) continue;
    const existing = existingByKey.get(key);
    if (!existing || !gradeChanged(grade, existing)) continue;
    ops.push(
      prisma.attendanceDay.update({
        where: { id: existing.id },
        data: gradeUpdateData(grade, admin.id, now),
      }),
    );
  }

  await prisma.$transaction(ops);

  const names = requests.map((r) => employeeMap.get(r.employeeId)?.name).filter(Boolean);
  await logAudit({
    actorId: admin.id,
    entityType: "DtrEntryRequest",
    entityId: requests.length === 1 ? requests[0].id : `batch:${requests.length}`,
    action: "UPDATE",
    summary:
      requests.length === 1
        ? `Approved ${names[0]}'s DTR entry for ${formatFullDate(requests[0].date)}`
        : `Approved ${requests.length} DTR request(s)${names.length ? ` (${names.join(", ")})` : ""}`,
  });
  await Promise.all(
    requests.map((request) => {
      const userId = employeeMap.get(request.employeeId)?.user?.id;
      if (!userId) return Promise.resolve();
      return notifyUser(userId, `Your DTR entry for ${formatFullDate(request.date)} was approved`, "/my-dtr");
    }),
  );

  revalidateDtrRequestPaths();
  return { error: null };
}

// Undoes a mistaken approval: clears the official AttendanceDay record it
// wrote and lands the request on REJECTED — not PENDING, which is locked
// from the employee's side — so the employee can immediately edit and
// resubmit it. Only deletes the AttendanceDay this request itself wrote
// (source EMPLOYEE_REQUEST); a later MANUAL admin entry for the same day is
// left alone.
export async function revertDtrEntryApproval(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const request = await prisma.dtrEntryRequest.findUnique({
    where: { id },
    include: { employee: { include: { user: true } } },
  });
  if (!request) return { error: "Request not found" };
  if (request.status !== "APPROVED") return { error: "Only an approved request can be reverted" };

  await prisma.$transaction([
    prisma.dtrEntryRequest.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() },
    }),
    prisma.attendanceDay.deleteMany({
      where: { employeeId: request.employeeId, date: request.date, source: "EMPLOYEE_REQUEST" },
    }),
  ]);

  const dateLabel = formatFullDate(request.date);
  await logAudit({
    actorId: admin.id,
    entityType: "DtrEntryRequest",
    entityId: request.id,
    action: "UPDATE",
    summary: `Reverted approval for ${request.employee.name}'s DTR entry on ${dateLabel}`,
  });
  if (request.employee.user) {
    await notifyUser(
      request.employee.user.id,
      `Your approved DTR entry for ${dateLabel} was reverted — please resubmit`,
      "/my-dtr",
    );
  }

  revalidateDtrRequestPaths();
  return { error: null };
}

export async function rejectDtrEntryRequest(id: string): Promise<FormState> {
  return rejectDtrEntryRequests([id]);
}

export async function rejectDtrEntryRequests(ids: string[]): Promise<FormState> {
  const admin = await requireAdmin();
  if (ids.length === 0) return { error: "No requests to reject" };

  const requests = await prisma.dtrEntryRequest.findMany({
    where: { id: { in: ids }, status: "PENDING" },
    include: { employee: { include: { user: true } } },
  });
  if (requests.length === 0) return { error: "These requests have already been resolved" };

  await prisma.dtrEntryRequest.updateMany({
    where: { id: { in: requests.map((r) => r.id) } },
    data: { status: "REJECTED", reviewedById: admin.id, reviewedAt: new Date() },
  });

  const names = requests.map((r) => r.employee.name);
  await logAudit({
    actorId: admin.id,
    entityType: "DtrEntryRequest",
    entityId: requests.length === 1 ? requests[0].id : `batch:${requests.length}`,
    action: "UPDATE",
    summary:
      requests.length === 1
        ? `Rejected ${names[0]}'s DTR entry for ${formatFullDate(requests[0].date)}`
        : `Rejected ${requests.length} DTR request(s) (${names.join(", ")})`,
  });
  await Promise.all(
    requests.map((request) =>
      request.employee.user
        ? notifyUser(request.employee.user.id, `Your DTR entry for ${formatFullDate(request.date)} was rejected`, "/my-dtr")
        : Promise.resolve(),
    ),
  );

  revalidateDtrRequestPaths();
  return { error: null };
}
