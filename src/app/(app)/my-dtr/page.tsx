import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { computePayroll } from "@/lib/payroll";
import { displayCodeForDay } from "@/lib/attendance-codes";
import { getHalfMonthRange, formatISODate, halfLabel, type Half } from "@/lib/period";
import { formatTimeHHMM, resolveSchedule, MANUAL_OVERRIDE_CODES, type ManualOverrideCode } from "@/lib/dtr-time";
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

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: user.employeeId } });
  const schedule = resolveSchedule(employee);
  const { start, end, dates } = getHalfMonthRange(year, month, half);

  const [days, requests, rate] = await Promise.all([
    prisma.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.dtrEntryRequest.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.salaryGradeRate.findUnique({
      where: { year_salaryGrade: { year, salaryGrade: employee.salaryGrade } },
    }),
  ]);

  const dayMap = new Map(days.map((day) => [formatISODate(day.date), day]));
  const requestMap = new Map(requests.map((r) => [formatISODate(r.date), r]));

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
    const usePending = request?.status === "PENDING";
    const source = usePending ? request : day;
    const isManualOverride = usePending
      ? !!request.overrideCode
      : day
        ? MANUAL_OVERRIDE_SET.has(day.code)
        : false;

    return {
      date: iso,
      officialLabel: displayCodeForDay(officialCode, officialLateMinutes),
      amArrival: !isManualOverride && source?.amArrival ? formatTimeHHMM(source.amArrival) : "",
      amDeparture: !isManualOverride && source?.amDeparture ? formatTimeHHMM(source.amDeparture) : "",
      pmArrival: !isManualOverride && source?.pmArrival ? formatTimeHHMM(source.pmArrival) : "",
      pmDeparture: !isManualOverride && source?.pmDeparture ? formatTimeHHMM(source.pmDeparture) : "",
      overrideCode: isManualOverride
        ? ((usePending ? request.overrideCode : day?.code) as ManualOverrideCode)
        : "",
      notes: (usePending ? request.notes : day?.notes) ?? "",
      pendingStatus: request?.status === "PENDING" ? "PENDING" : request?.status === "REJECTED" ? "REJECTED" : null,
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
          <Link href={`/dtr/${employee.id}/${year}/${month}/print`}>
            <Button type="button" variant="outline">
              Print DTR (Form 48)
            </Button>
          </Link>
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
          <Stat label="Gross Amount" value={peso(totals.grossAmount)} />
          <Stat label="Deduction" value={peso(totals.deduction)} />
          <Stat label="Net Amount" value={peso(totals.netAmount)} />
        </CardContent>
      </Card>

      <MyDtrForm key={`${year}-${month}-${half}`} initialRows={rows} schedule={schedule} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function peso(amount: number): string {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function clampMonth(month: number): number {
  if (Number.isNaN(month) || month < 1) return 1;
  if (month > 12) return 12;
  return month;
}
