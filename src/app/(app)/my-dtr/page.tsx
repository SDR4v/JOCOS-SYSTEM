import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computePayroll, formatPeso } from "@/lib/payroll";
import { displayCodeForDay } from "@/lib/attendance-codes";
import { getHalfMonthRange, formatISODate, halfLabel, clampMonth, type Half } from "@/lib/period";
import { formatTimeHHMM, MANUAL_OVERRIDE_CODES, type ManualOverrideCode } from "@/lib/dtr-time";
import { reviewEmployeePunches } from "@/lib/biometric-review";
import { fetchDateScheduleOverrides } from "@/lib/date-schedule";
import { MyDtrFilters } from "./my-dtr-filters";
import { MyDtrForm, type MyDtrRow } from "./my-dtr-form";
import { MyScheduleDialog } from "./my-schedule-dialog";

const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

export default async function MyDtrPage({ searchParams }: PageProps<"/my-dtr">) {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My DTR</h1>
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet. Ask HR to link it.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);
  const half: Half = Number(params.half) === 2 ? 2 : 1;

  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: user.employeeId },
    include: { daySchedules: true },
  });
  const { start, end, dates } = getHalfMonthRange(year, month, half);
  // AttendanceDay/DtrEntryRequest dates are stored midnight-anchored, so
  // `end` (midnight of the period's last day) bounds them correctly — but a
  // PunchRecord's timestamp carries a real time of day, which would fall
  // just past that midnight and get excluded. Push the punch query's upper
  // bound to the start of the following day instead.
  const punchRangeEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  const [days, requests, punches, rate, dateOverrides, dayBeforePeriod] = await Promise.all([
    prisma.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.dtrEntryRequest.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.punchRecord.findMany({
      where: {
        employeeId: employee.id,
        isDuplicate: false,
        timestamp: { gte: start, lt: punchRangeEnd },
        biometricUpload: { status: "REVIEWED" },
      },
      select: { timestamp: true },
    }),
    prisma.salaryGradeRate.findUnique({
      where: { year_salaryGrade: { year, salaryGrade: employee.salaryGrade } },
    }),
    fetchDateScheduleOverrides(employee.id, start, end),
    // The day just before this half-month period — a join set on it doesn't
    // appear anywhere in THIS table's own rows, so without this the
    // "continued from above" connector would never show across the
    // 15th/16th boundary even though the actual grading already handles it.
    prisma.attendanceDay.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: new Date(start.getTime() - 24 * 60 * 60 * 1000) } },
      select: { joinedWithNextDay: true },
    }),
  ]);

  const dayMap = new Map(days.map((day) => [formatISODate(day.date), day]));
  const requestMap = new Map(requests.map((r) => [formatISODate(r.date), r]));
  // A day only ever gets a biometric pre-fill when NOTHING else already
  // exists for it (see the `!day && !request` check below) — this is purely
  // a default the employee sees and can edit, never a silent overwrite of an
  // official record or an in-flight request.
  const biometricByIso = new Map(
    reviewEmployeePunches(employee, punches.map((p) => p.timestamp)).map((d) => [d.iso, d]),
  );

  const totals = computePayroll(
    days.map((d) => ({ dayCredit: d.dayCredit, lateMinutes: d.lateMinutes })),
    rate?.monthlyAmount ?? 0,
  );

  const rows: MyDtrRow[] = dates.map((date) => {
    const iso = formatISODate(date);
    const day = dayMap.get(iso);
    const officialCode = day?.code ?? "UNSET";
    const officialLateMinutes = day?.lateMinutes ?? 0;

    const request = requestMap.get(iso);
    // Show the request's own values (not just the official record) whenever
    // it's still awaiting review OR was rejected — a rejected day's original
    // submission stays visible so the employee can resubmit it as-is.
    const useRequestData = request?.status === "PENDING" || request?.status === "REJECTED";
    const source = useRequestData ? request : day;
    const isManualOverride = useRequestData
      ? !!request.overrideCode
      : day
        ? MANUAL_OVERRIDE_SET.has(day.code)
        : false;

    // Only offered when the day is otherwise untouched (see biometricByIso
    // above) — a default the employee still has to check and Submit
    // themselves, never a stand-in for an official record or a request.
    const biometricDay = !day && !request ? biometricByIso.get(iso) : undefined;
    const biometricTimes = biometricDay?.classification.kind === "confident" ? biometricDay.classification : null;

    const hasRecord = !!day || !!request;
    const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
    const defaultOverride: ManualOverrideCode | "" = hasRecord || biometricTimes ? "" : isWeekend ? "REST_DAY" : "";

    function pickTime(fromRecord: Date | null | undefined, fromBiometric: Date | null | undefined): string {
      if (isManualOverride) return "";
      if (fromRecord) return formatTimeHHMM(fromRecord);
      if (fromBiometric) return formatTimeHHMM(fromBiometric);
      return "";
    }

    return {
      date: iso,
      officialLabel: displayCodeForDay(officialCode, officialLateMinutes),
      amArrival: pickTime(source?.amArrival, biometricTimes?.amArrival),
      amDeparture: pickTime(source?.amDeparture, biometricTimes?.amDeparture),
      pmArrival: pickTime(source?.pmArrival, biometricTimes?.pmArrival),
      pmDeparture: pickTime(source?.pmDeparture, biometricTimes?.pmDeparture),
      overrideCode: isManualOverride
        ? ((useRequestData ? request.overrideCode : day?.code) as ManualOverrideCode)
        : defaultOverride,
      // A day already on file (approved and written into the official
      // record) doesn't need resubmitting — it's locked here too, same as
      // PENDING. An admin can revert an accidental approval from DTR
      // Requests, which reopens it for editing again.
      pendingStatus:
        request?.status === "PENDING"
          ? "PENDING"
          : request?.status === "REJECTED"
            ? "REJECTED"
            : day
              ? "APPROVED"
              : null,
      remarks: (useRequestData ? request?.remarks : day?.remarks) ?? "",
      dateOverride: dateOverrides.get(iso) ?? null,
      joinedWithNextDay: source?.joinedWithNextDay ?? false,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My DTR</h1>
          <p className="text-sm text-muted-foreground">
            {employee.name} &middot; SG {employee.salaryGrade} &middot; {employee.officeAssignment}
          </p>
        </div>
        <div className="flex gap-2">
          <MyScheduleDialog employee={employee} />
        </div>
      </div>

      <MyDtrFilters year={year} month={month} half={half} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {halfLabel(half)} summary
            {!rate && <span className="ml-2 text-sm font-normal text-muted-foreground">(no SG rate published for {year})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Days Rendered" value={totals.totalDaysRendered.toFixed(1)} />
          <Stat label="Gross Amount" value={formatPeso(totals.grossAmount)} />
          <Stat label="Deduction" value={formatPeso(totals.deduction)} />
          <Stat label="Net Amount" value={formatPeso(totals.netAmount)} highlight />
        </CardContent>
      </Card>

      <MyDtrForm
        key={`${year}-${month}-${half}`}
        employeeId={employee.id}
        initialRows={rows}
        employeeSchedule={employee}
        continuedFromPreviousPeriod={dayBeforePeriod?.joinedWithNextDay ?? false}
      />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={highlight ? "text-lg font-semibold text-primary" : "text-lg font-semibold"}>{value}</div>
    </div>
  );
}

