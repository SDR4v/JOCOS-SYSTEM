import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getHalfMonthRange, formatISODate, type Half } from "@/lib/period";
import { formatTimeHHMM, resolveSchedule, MANUAL_OVERRIDE_CODES, type ManualOverrideCode } from "@/lib/dtr-time";
import { Button } from "@/components/ui/button";
import { DtrFilters } from "./dtr-filters";
import { DtrForm, type DtrRowValue } from "./dtr-form";

const MANUAL_OVERRIDE_SET = new Set<string>(MANUAL_OVERRIDE_CODES);

export default async function DtrPage({ searchParams }: PageProps<"/admin/dtr">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);
  const half: Half = Number(params.half) === 2 ? 2 : 1;

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
    select: { id: true, name: true, officeAssignment: true },
  });

  const employeeId =
    (typeof params.employeeId === "string" && params.employeeId) || employees[0]?.id || "";

  if (!employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">DTR</h1>
        <p className="text-sm text-muted-foreground">No active employees yet. Add employees first.</p>
      </div>
    );
  }

  const { start, end, dates } = getHalfMonthRange(year, month, half);

  const [selectedEmployee, existingDays] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    prisma.attendanceDay.findMany({ where: { employeeId, date: { gte: start, lte: end } } }),
  ]);
  const schedule = resolveSchedule(selectedEmployee);
  const dayMap = new Map(existingDays.map((day) => [formatISODate(day.date), day]));

  const rows: DtrRowValue[] = dates.map((date) => {
    const iso = formatISODate(date);
    const existing = dayMap.get(iso);
    const isManualOverride = existing ? MANUAL_OVERRIDE_SET.has(existing.code) : false;
    return {
      date: iso,
      amArrival: existing?.amArrival ? formatTimeHHMM(existing.amArrival) : "",
      amDeparture: existing?.amDeparture ? formatTimeHHMM(existing.amDeparture) : "",
      pmArrival: existing?.pmArrival ? formatTimeHHMM(existing.pmArrival) : "",
      pmDeparture: existing?.pmDeparture ? formatTimeHHMM(existing.pmDeparture) : "",
      overrideCode: isManualOverride ? (existing!.code as ManualOverrideCode) : "",
      notes: existing?.notes ?? "",
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">DTR</h1>
          <p className="text-sm text-muted-foreground">Enter daily attendance for the selected employee and period.</p>
        </div>
        <Link href={`/dtr/${employeeId}/${year}/${month}/print`}>
          <Button type="button" variant="outline">
            Print DTR (Form 48)
          </Button>
        </Link>
      </div>

      <DtrFilters employees={employees} employeeId={employeeId} year={year} month={month} half={half} />

      <DtrForm key={`${employeeId}-${year}-${month}-${half}`} employeeId={employeeId} initialRows={rows} schedule={schedule} />
    </div>
  );
}

function clampMonth(month: number): number {
  if (Number.isNaN(month) || month < 1) return 1;
  if (month > 12) return 12;
  return month;
}
