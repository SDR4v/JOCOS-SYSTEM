import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computePayroll } from "@/lib/payroll";
import { displayCodeForDay } from "@/lib/attendance-codes";
import { getHalfMonthRange, formatISODate, formatDisplayDate, halfLabel, type Half } from "@/lib/period";
import { MyDtrFilters } from "./my-dtr-filters";

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
  const { start, end, dates } = getHalfMonthRange(year, month, half);

  const [days, rate] = await Promise.all([
    prisma.attendanceDay.findMany({ where: { employeeId: employee.id, date: { gte: start, lte: end } } }),
    prisma.salaryGradeRate.findUnique({
      where: { year_salaryGrade: { year, salaryGrade: employee.salaryGrade } },
    }),
  ]);

  const dayMap = new Map(days.map((day) => [formatISODate(day.date), day]));
  const totals = computePayroll(
    days.map((d) => ({ dayCredit: d.dayCredit, lateMinutes: d.lateMinutes })),
    rate?.monthlyAmount ?? 0,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">My DTR</h1>
        <p className="text-sm text-muted-foreground">
          {employee.name} &middot; SG {employee.salaryGrade} &middot; {employee.officeAssignment}
        </p>
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

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Late/Undertime (min)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dates.map((date) => {
              const iso = formatISODate(date);
              const day = dayMap.get(iso);
              const code = day?.code ?? "UNSET";
              return (
                <TableRow key={iso}>
                  <TableCell className="whitespace-nowrap text-sm">{formatDisplayDate(iso)}</TableCell>
                  <TableCell>{displayCodeForDay(code, day?.lateMinutes ?? 0)}</TableCell>
                  <TableCell>{code === "LATE" ? day?.lateMinutes ?? 0 : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{day?.notes ?? ""}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
