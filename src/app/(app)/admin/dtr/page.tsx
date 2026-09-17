import Link from "next/link";
import { cookies } from "next/headers";
import { Printer } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getHalfMonthRange, formatISODate, clampMonth, type Half } from "@/lib/period";
import { formatTimeHHMM, MANUAL_OVERRIDE_CODES, type ManualOverrideCode } from "@/lib/dtr-time";
import { reviewEmployeePunches } from "@/lib/biometric-review";
import { fetchDateScheduleOverrides } from "@/lib/date-schedule";
import { Button } from "@/components/ui/button";
import { DtrFilters } from "./dtr-filters";
import { DtrForm, type DtrRowValue } from "./dtr-form";

const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

export default async function DtrPage({ searchParams }: PageProps<"/admin/dtr">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();

  // Falls back to whichever employee/period was last viewed (remembered via
  // cookies, set by DtrFilters) rather than always resetting to the first
  // employee and current month — the nav's "DTR" link carries neither over.
  const cookieStore = await cookies();
  const lastEmployeeId = cookieStore.get("jocos-last-dtr-employee")?.value;
  const lastPeriod = cookieStore.get("jocos-last-dtr-period")?.value;
  const [lastYear, lastMonth, lastHalf] = lastPeriod?.split(":") ?? [];

  const year = Number(params.year) || Number(lastYear) || now.getFullYear();
  const month = clampMonth(Number(params.month) || Number(lastMonth) || now.getMonth() + 1);
  const half: Half =
    typeof params.half === "string" ? (Number(params.half) === 2 ? 2 : 1) : Number(lastHalf) === 2 ? 2 : 1;

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
    select: { id: true, name: true, officeAssignment: true },
  });

  const employeeId =
    (typeof params.employeeId === "string" && params.employeeId) ||
    (lastEmployeeId && employees.some((e) => e.id === lastEmployeeId) ? lastEmployeeId : "") ||
    employees[0]?.id ||
    "";

  if (!employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">DTR</h1>
        <p className="text-sm text-muted-foreground">No active employees yet. Add employees first.</p>
      </div>
    );
  }

  const { start, end, dates } = getHalfMonthRange(year, month, half);
  // AttendanceDay dates are stored midnight-anchored, so `end` (midnight of
  // the period's last day) bounds them correctly — but a PunchRecord's
  // timestamp carries a real time of day, which would fall just past that
  // midnight and get excluded. Push the punch query's upper bound to the
  // start of the following day instead.
  const punchRangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  const [selectedEmployee, existingDays, punches, dateOverrides] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { daySchedules: true } }),
    prisma.attendanceDay.findMany({ where: { employeeId, date: { gte: start, lte: end } } }),
    prisma.punchRecord.findMany({
      where: {
        employeeId,
        isDuplicate: false,
        timestamp: { gte: start, lt: punchRangeEnd },
        biometricUpload: { status: "REVIEWED" },
      },
      select: { timestamp: true },
    }),
    fetchDateScheduleOverrides(employeeId, start, end),
  ]);
  const dayMap = new Map(existingDays.map((day) => [formatISODate(day.date), day]));
  // Same pre-fill as My DTR (see my-dtr/page.tsx) — only ever offered for a
  // day with no official AttendanceDay yet, still fully editable, and saving
  // this grid is exactly as deliberate an admin action as typing the times
  // in by hand would have been.
  const biometricByIso = new Map(
    reviewEmployeePunches(selectedEmployee, punches.map((p) => p.timestamp)).map((d) => [d.iso, d]),
  );

  const rows: DtrRowValue[] = dates.map((date) => {
    const iso = formatISODate(date);
    const existing = dayMap.get(iso);
    const isManualOverride = existing ? MANUAL_OVERRIDE_SET.has(existing.code) : false;

    const biometricDay = !existing ? biometricByIso.get(iso) : undefined;
    const biometricTimes = biometricDay?.classification.kind === "confident" ? biometricDay.classification : null;

    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const defaultOverride: ManualOverrideCode | "" = existing || biometricTimes ? "" : isWeekend ? "REST_DAY" : "";
    // A TA-covered punch was saved with a null time (see saveDtrPeriod) —
    // code TRIP_AUTHORIZATION plus a null field is what marks it as TA
    // rather than genuinely blank when reopening the page.
    const wasTA = existing?.code === "TRIP_AUTHORIZATION";

    function pickTime(fromRecord: Date | null | undefined, fromBiometric: Date | null | undefined): string {
      if (isManualOverride) return "";
      if (fromRecord) return formatTimeHHMM(fromRecord);
      if (fromBiometric) return formatTimeHHMM(fromBiometric);
      return "";
    }

    return {
      date: iso,
      amArrival: pickTime(existing?.amArrival, biometricTimes?.amArrival),
      amDeparture: pickTime(existing?.amDeparture, biometricTimes?.amDeparture),
      pmArrival: pickTime(existing?.pmArrival, biometricTimes?.pmArrival),
      pmDeparture: pickTime(existing?.pmDeparture, biometricTimes?.pmDeparture),
      overrideCode: isManualOverride ? (existing!.code as ManualOverrideCode) : defaultOverride,
      amArrivalIsTA: wasTA && !existing.amArrival,
      amDepartureIsTA: wasTA && !existing.amDeparture,
      pmArrivalIsTA: wasTA && !existing.pmArrival,
      pmDepartureIsTA: wasTA && !existing.pmDeparture,
      remarks: existing?.remarks ?? "",
      dateOverride: dateOverrides.get(iso) ?? null,
      joinedWithNextDay: existing?.joinedWithNextDay ?? false,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DTR</h1>
          <p className="text-sm text-muted-foreground">Enter daily attendance for the selected employee and period.</p>
        </div>
        <Link href={`/dtr/${employeeId}/${year}/${month}/print?half=${half}`}>
          <Button type="button" variant="outline">
            <Printer />
            Print DTR (Form 48)
          </Button>
        </Link>
      </div>

      <DtrFilters employees={employees} employeeId={employeeId} year={year} month={month} half={half} />

      <DtrForm
        key={`${employeeId}-${year}-${month}-${half}`}
        employeeId={employeeId}
        initialRows={rows}
        employeeSchedule={selectedEmployee}
      />
    </div>
  );
}
