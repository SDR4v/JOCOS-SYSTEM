import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/period";
import { semesterLabel } from "@/lib/wellness-leave";
import { NewWellnessLeaveRequestDialog, ApproveRejectButtons } from "./wellness-leave-dialogs";
import { InitializeYearButton } from "./initialize-year-button";

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
      include: { employee: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const balanceMap = new Map(balances.map((b) => [`${b.employeeId}-${b.semester}`, b]));
  const initialized = balances.length > 0;

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const resolvedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Wellness Leave</h1>
          <p className="text-sm text-muted-foreground">
            5 days/year per COS worker — 3 for 1st Sem (Jan–Jun), 2 for 2nd Sem (Jul–Dec).
          </p>
        </div>
        <NewWellnessLeaveRequestDialog
          employees={employees.map((e) => ({ id: e.id, name: e.name, officeAssignment: e.officeAssignment }))}
        />
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

      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Pending Requests</h2>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.employee.name}</TableCell>
                    <TableCell className="text-sm">
                      {formatISODate(request.startDate)} – {formatISODate(request.endDate)}
                    </TableCell>
                    <TableCell>{request.daysCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{request.notes ?? ""}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Link href={`/wellness-leave/${request.id}/print`}>
                        <Button type="button" variant="outline" size="sm">
                          Print
                        </Button>
                      </Link>
                      <ApproveRejectButtons id={request.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

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
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">1st Sem Used</TableHead>
                  <TableHead className="text-right">1st Sem Remaining</TableHead>
                  <TableHead className="text-right">2nd Sem Used</TableHead>
                  <TableHead className="text-right">2nd Sem Remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const sem1 = balanceMap.get(`${employee.id}-1`);
                  const sem2 = balanceMap.get(`${employee.id}-2`);
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell className="text-right">{sem1 ? sem1.used : "—"}</TableCell>
                      <TableCell className="text-right">{sem1 ? sem1.allotted - sem1.used : "—"}</TableCell>
                      <TableCell className="text-right">{sem2 ? sem2.used : "—"}</TableCell>
                      <TableCell className="text-right">{sem2 ? sem2.allotted - sem2.used : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/wellness-leave/blank/${employee.id}/print`}>
                          <Button type="button" variant="outline" size="sm">
                            Print
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {resolvedRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Request History</h2>
          <div className="rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Semester</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">{request.employee.name}</TableCell>
                    <TableCell className="text-sm">
                      {formatISODate(request.startDate)} – {formatISODate(request.endDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {semesterLabel(request.startDate.getUTCMonth() < 6 ? 1 : 2)}
                    </TableCell>
                    <TableCell>{request.daysCount}</TableCell>
                    <TableCell>
                      <Badge variant={request.status === "APPROVED" ? "default" : "secondary"}>
                        {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/wellness-leave/${request.id}/print`}>
                        <Button type="button" variant="outline" size="sm">
                          Print
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
