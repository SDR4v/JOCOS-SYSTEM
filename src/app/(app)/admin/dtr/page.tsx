import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getHalfMonthRange, formatISODate, type Half } from "@/lib/period";
import { DtrFilters } from "./dtr-filters";
import { DtrForm, type DtrRowValue } from "./dtr-form";

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

  const existingDays = await prisma.attendanceDay.findMany({
    where: { employeeId, date: { gte: start, lte: end } },
  });
  const dayMap = new Map(existingDays.map((day) => [formatISODate(day.date), day]));

  const rows: DtrRowValue[] = dates.map((date) => {
    const iso = formatISODate(date);
    const existing = dayMap.get(iso);
    return {
      date: iso,
      code: existing?.code ?? "UNSET",
      lateMinutes: existing?.lateMinutes ?? 0,
      notes: existing?.notes ?? "",
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">DTR</h1>
        <p className="text-sm text-muted-foreground">Enter daily attendance for the selected employee and period.</p>
      </div>

      <DtrFilters employees={employees} employeeId={employeeId} year={year} month={month} half={half} />

      <DtrForm key={`${employeeId}-${year}-${month}-${half}`} employeeId={employeeId} initialRows={rows} />
    </div>
  );
}

function clampMonth(month: number): number {
  if (Number.isNaN(month) || month < 1) return 1;
  if (month > 12) return 12;
  return month;
}
