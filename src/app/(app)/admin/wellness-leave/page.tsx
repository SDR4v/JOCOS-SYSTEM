import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { InitializeYearButton } from "./initialize-year-button";
import { BalancesTable } from "./balances-table";
import { RequestHistoryTable } from "./request-history-table";

export default async function WellnessLeavePage({ searchParams }: PageProps<"/admin/wellness-leave">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();

  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
  });

  const [balances, requests] = await Promise.all([
    prisma.wellnessLeaveBalance.findMany({ where: { year } }),
    prisma.wellnessLeaveRequest.findMany({
      where: { startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) } },
      include: { employee: true, cancelledBy: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const balanceMap = Object.fromEntries(balances.map((b) => [`${b.employeeId}-${b.semester}`, b]));
  const initialized = balances.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Wellness Leave</h1>
        <p className="text-sm text-muted-foreground">
          5 days/year per COS worker — 3 for 1st Sem (Jan–Jun), 2 for 2nd Sem (Jul–Dec). Employees file their own
          requests and they take effect right away — no approval needed. Track below whether each one is upcoming,
          already taken, or was pulled out.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {yearOptions(year).map((y) => (
          <Link key={y} href={`/admin/wellness-leave?year=${y}`}>
            <Button variant={y === year ? "default" : "outline"} size="sm">
              {y}
            </Button>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Balances — {year}</h2>
          {!initialized && <InitializeYearButton year={year} />}
        </div>
        {!initialized ? (
          <p className="text-sm text-muted-foreground">
            No Wellness Leave balances have been set up for {year} yet. Click &quot;Initialize {year}&quot; to grant
            every active employee their 3/2-day semester buckets.
          </p>
        ) : (
          <BalancesTable
            employees={employees.map((e) => ({ id: e.id, name: e.name, officeAssignment: e.officeAssignment }))}
            balanceMap={balanceMap}
          />
        )}
      </div>

      {requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Requests — {year}</h2>
          <RequestHistoryTable
            requests={requests.map((r) => ({
              id: r.id,
              startDate: r.startDate,
              endDate: r.endDate,
              daysCount: r.daysCount,
              notes: r.notes,
              status: r.status as "ACTIVE" | "CANCELLED",
              employee: { name: r.employee.name, officeAssignment: r.employee.officeAssignment, positionTitle: r.employee.positionTitle },
              createdAt: r.createdAt,
              cancelledByName: r.cancelledBy?.username ?? null,
              cancelledAt: r.cancelledAt,
            }))}
          />
        </div>
      )}
    </div>
  );
}

function yearOptions(current: number): number[] {
  const base = new Date().getFullYear();
  const years = new Set([current, base, base - 1, base + 1]);
  return Array.from(years).sort((a, b) => b - a);
}
