import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computePayroll, type PayrollTotals } from "@/lib/payroll";
import { getHalfMonthRange, halfLabel, MONTH_NAMES } from "@/lib/period";
import { PayrollFilters } from "./payroll-filters";

type PayrollHalf = "1" | "2" | "combined";

export default async function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);
  const half: PayrollHalf = params.half === "1" || params.half === "2" ? params.half : "combined";

  const [employees, rates] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
    }),
    prisma.salaryGradeRate.findMany({ where: { year } }),
  ]);
  const rateMap = new Map(rates.map((r) => [r.salaryGrade, r.monthlyAmount]));

  const range1 = getHalfMonthRange(year, month, 1);
  const range2 = getHalfMonthRange(year, month, 2);
  const rangeStart = half === "2" ? range2.start : range1.start;
  const rangeEnd = half === "1" ? range1.end : range2.end;

  const days = employees.length
    ? await prisma.attendanceDay.findMany({
        where: { employeeId: { in: employees.map((e) => e.id) }, date: { gte: rangeStart, lte: rangeEnd } },
      })
    : [];

  const daysByEmployee = new Map<string, { dayCredit: number; lateMinutes: number }[]>();
  for (const day of days) {
    const list = daysByEmployee.get(day.employeeId) ?? [];
    list.push({ dayCredit: day.dayCredit, lateMinutes: day.lateMinutes });
    daysByEmployee.set(day.employeeId, list);
  }

  type ReportRow = {
    employee: (typeof employees)[number];
    hasRate: boolean;
    totals: PayrollTotals;
  };

  const rows: ReportRow[] = employees.map((employee) => {
    const monthlyAmount = rateMap.get(employee.salaryGrade);
    const totals = computePayroll(daysByEmployee.get(employee.id) ?? [], monthlyAmount ?? 0);
    return { employee, hasRate: monthlyAmount !== undefined, totals };
  });

  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const list = groups.get(row.employee.officeAssignment) ?? [];
    list.push(row);
    groups.set(row.employee.officeAssignment, list);
  }

  const grandTotal = rows.reduce(
    (sum, row) => ({
      totalDaysRendered: sum.totalDaysRendered + row.totals.totalDaysRendered,
      grossAmount: sum.grossAmount + row.totals.grossAmount,
      deduction: sum.deduction + row.totals.deduction,
      netAmount: sum.netAmount + row.totals.netAmount,
    }),
    { totalDaysRendered: 0, grossAmount: 0, deduction: 0, netAmount: 0 },
  );

  const periodLabel = half === "combined" ? MONTH_NAMES[month - 1] : `${MONTH_NAMES[month - 1]}, ${halfLabel(half === "1" ? 1 : 2)}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Daily Rate Computation</h1>
        <p className="text-sm text-muted-foreground">
          {periodLabel} {year} &middot; JOCOS computation, grouped by office assignment.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PayrollFilters year={year} month={month} half={half} />
        <Link href={`/admin/payroll/print?year=${year}&month=${month}&half=${half}`}>
          <Button type="button" variant="outline">
            Print / JOCOS Report
          </Button>
        </Link>
      </div>

      {rows.length === 0 && <p className="text-sm text-muted-foreground">No active employees yet.</p>}

      {Array.from(groups.entries()).map(([office, groupRows]) => (
        <div key={office} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{office}</h2>
          <div className="rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SG</TableHead>
                  <TableHead className="text-right">Days Rendered</TableHead>
                  <TableHead className="text-right">Gross Amount</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupRows.map(({ employee, hasRate, totals }) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>
                      {employee.salaryGrade}
                      {!hasRate && (
                        <Badge variant="secondary" className="ml-2">
                          No rate for {year}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{totals.totalDaysRendered.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{peso(totals.grossAmount)}</TableCell>
                    <TableCell className="text-right">{peso(totals.deduction)}</TableCell>
                    <TableCell className="text-right font-medium">{peso(totals.netAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {rows.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 shadow-sm">
          <Table>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-semibold">Grand Total</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold">{grandTotal.totalDaysRendered.toFixed(1)}</TableCell>
                <TableCell className="text-right font-semibold">{peso(grandTotal.grossAmount)}</TableCell>
                <TableCell className="text-right font-semibold">{peso(grandTotal.deduction)}</TableCell>
                <TableCell className="text-right font-semibold text-primary">{peso(grandTotal.netAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
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
