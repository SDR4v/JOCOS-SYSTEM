import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { getMonthRange, MONTH_NAMES } from "@/lib/period";

export default async function HistoryMonthPage({
  params,
}: PageProps<"/admin/history/[year]/[month]">) {
  await requireAdmin();
  const { year: yearParam, month: monthParam } = await params;

  const year = Number(yearParam);
  const month = Number(monthParam);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) notFound();

  const { dates } = getMonthRange(year, month);
  const rangeStart = dates[0];
  const rangeEnd = dates[dates.length - 1];

  const days = await prisma.attendanceDay.findMany({
    where: { date: { gte: rangeStart, lte: rangeEnd } },
    select: { employeeId: true, date: true },
  });

  const halvesByEmployee = new Map<string, { half1: boolean; half2: boolean }>();
  for (const day of days) {
    const entry = halvesByEmployee.get(day.employeeId) ?? { half1: false, half2: false };
    if (day.date.getUTCDate() <= 15) entry.half1 = true;
    else entry.half2 = true;
    halvesByEmployee.set(day.employeeId, entry);
  }

  const employees =
    halvesByEmployee.size > 0
      ? await prisma.employee.findMany({
          where: { id: { in: Array.from(halvesByEmployee.keys()) } },
          orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
        })
      : [];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/history" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          History
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {MONTH_NAMES[month - 1]} {year} &middot; Employee DTRs
        </h1>
        <p className="text-sm text-muted-foreground">
          Every employee with attendance on file this month. Print the half that has data.
        </p>
      </div>

      {employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attendance recorded for this month.</p>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Office Assignment</TableHead>
                <TableHead className="text-right">Print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const halves = halvesByEmployee.get(employee.id)!;
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.officeAssignment}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {halves.half1 && (
                          <Link href={`/dtr/${employee.id}/${year}/${month}/print?half=1`}>
                            <Button type="button" variant="outline" size="sm">
                              <Printer />
                              1st half
                            </Button>
                          </Link>
                        )}
                        {halves.half2 && (
                          <Link href={`/dtr/${employee.id}/${year}/${month}/print?half=2`}>
                            <Button type="button" variant="outline" size="sm">
                              <Printer />
                              2nd half
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
