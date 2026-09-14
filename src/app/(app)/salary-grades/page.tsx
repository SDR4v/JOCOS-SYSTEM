import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getDailyRate, getPerMinuteRate } from "@/lib/payroll";

export default async function EmployeeSalaryGradesPage({ searchParams }: PageProps<"/salary-grades">) {
  await requireUser();

  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = Number(params.year) || currentYear;

  const [rates, years] = await Promise.all([
    prisma.salaryGradeRate.findMany({ where: { year }, orderBy: { salaryGrade: "asc" } }),
    prisma.salaryGradeRate.findMany({ distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
  ]);

  const availableYears = years.length ? years.map((y) => y.year) : [currentYear];
  if (!availableYears.includes(year)) availableYears.unshift(year);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Salary Grade Rates</h1>
        <p className="text-sm text-muted-foreground">Monthly amount per SG level, used to compute Daily Rate and Per-Minute Rate.</p>
      </div>

      <div className="flex gap-2">
        {availableYears.map((y) => (
          <Link key={y} href={`/salary-grades?year=${y}`}>
            <Button variant={y === year ? "default" : "outline"} size="sm">
              {y}
            </Button>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SG</TableHead>
              <TableHead>Monthly Amount</TableHead>
              <TableHead>Daily Rate</TableHead>
              <TableHead>Per-Minute Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  No rates for {year} yet.
                </TableCell>
              </TableRow>
            )}
            {rates.map((rate) => {
              const dailyRate = getDailyRate(rate.monthlyAmount);
              const perMinuteRate = getPerMinuteRate(dailyRate);
              return (
                <TableRow key={rate.id}>
                  <TableCell>{rate.salaryGrade}</TableCell>
                  <TableCell>₱{rate.monthlyAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>₱{dailyRate.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>₱{perMinuteRate.toLocaleString(undefined, { minimumFractionDigits: 5 })}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
