import Link from "next/link";
import { Printer, Files } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/period";

export default async function HistoryPage() {
  await requireAdmin();

  const days = await prisma.attendanceDay.findMany({
    where: { source: { not: "HOLIDAY" } },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  // Every month that has at least one recorded attendance day, across any
  // employee — that's the only thing that makes a month's JOCOS report or
  // DTRs worth pulling up. Holiday placeholder days (auto-stamped across the
  // whole year by "Add standard holidays") don't count on their own.
  const periods = Array.from(
    new Map(
      days.map((d) => {
        const year = d.date.getUTCFullYear();
        const month = d.date.getUTCMonth() + 1;
        return [`${year}-${month}`, { year, month }];
      }),
    ).values(),
  ).sort((a, b) => b.year - a.year || b.month - a.month);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">
          Past months&apos; JOCOS Daily Rate Computation and employee DTRs, ready to reprint.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly records</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No attendance recorded yet — once DTR entries are on file, months will show up here.
            </p>
          ) : (
            <ul className="divide-y">
              {periods.map(({ year, month }) => (
                <li key={`${year}-${month}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium">
                    {MONTH_NAMES[month - 1]} {year}
                  </span>
                  <div className="flex gap-2">
                    <Link href={`/admin/payroll/print?year=${year}&month=${month}`}>
                      <Button type="button" variant="outline" size="sm">
                        <Printer />
                        {MONTH_NAMES[month - 1]} JOCOS
                      </Button>
                    </Link>
                    <Link href={`/admin/history/${year}/${month}`}>
                      <Button type="button" variant="outline" size="sm">
                        <Files />
                        {MONTH_NAMES[month - 1]} DTR&apos;s
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
