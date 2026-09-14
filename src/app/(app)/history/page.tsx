import Link from "next/link";
import { Printer } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES } from "@/lib/period";

export default async function HistoryPage() {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet. Ask HR to link it.
        </p>
      </div>
    );
  }

  const days = await prisma.attendanceDay.findMany({
    where: { employeeId: user.employeeId, source: { not: "HOLIDAY" } },
    select: { date: true },
    orderBy: { date: "desc" },
  });

  // Every month with at least one official (approved/admin-entered) day on
  // file — only these have anything real to print. Each half prints
  // separately since that's how entry and approval actually work.
  const halvesByMonth = new Map<string, { year: number; month: number; half1: boolean; half2: boolean }>();
  for (const day of days) {
    const year = day.date.getUTCFullYear();
    const month = day.date.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const entry = halvesByMonth.get(key) ?? { year, month, half1: false, half2: false };
    if (day.date.getUTCDate() <= 15) entry.half1 = true;
    else entry.half2 = true;
    halvesByMonth.set(key, entry);
  }

  const periods = Array.from(halvesByMonth.values()).sort((a, b) => b.year - a.year || b.month - a.month);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-muted-foreground">Past months&apos; approved DTR, ready to reprint.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly records</CardTitle>
        </CardHeader>
        <CardContent>
          {periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved DTR yet — once HR approves a submission (or enters it directly), it&apos;ll show up here to
              print.
            </p>
          ) : (
            <ul className="divide-y">
              {periods.map(({ year, month, half1, half2 }) => (
                <li key={`${year}-${month}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium">
                    {MONTH_NAMES[month - 1]} {year}
                  </span>
                  <div className="flex gap-2">
                    {half1 && (
                      <Link href={`/dtr/${user.employeeId}/${year}/${month}/print?half=1`}>
                        <Button type="button" variant="outline" size="sm">
                          <Printer />
                          1st half
                        </Button>
                      </Link>
                    )}
                    {half2 && (
                      <Link href={`/dtr/${user.employeeId}/${year}/${month}/print?half=2`}>
                        <Button type="button" variant="outline" size="sm">
                          <Printer />
                          2nd half
                        </Button>
                      </Link>
                    )}
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
