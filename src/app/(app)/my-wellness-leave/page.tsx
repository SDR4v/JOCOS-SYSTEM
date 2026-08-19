import Link from "next/link";
import { Printer } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatISODate } from "@/lib/period";
import {
  semesterLabel,
  wellnessLeaveDisplayStatus,
  wellnessLeaveDisplayStatusLabel,
  canPullOutWellnessLeave,
  type WellnessLeaveDisplayStatus,
} from "@/lib/wellness-leave";
import { NewMyWellnessLeaveRequestDialog } from "./request-dialog";
import { PullOutButton } from "./pull-out-button";

const STATUS_BADGE_VARIANT: Record<WellnessLeaveDisplayStatus, "default" | "outline" | "destructive"> = {
  UPCOMING: "outline",
  TAKEN: "default",
  CANCELLED: "destructive",
};

export default async function MyWellnessLeavePage({ searchParams }: PageProps<"/my-wellness-leave">) {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">My Wellness Leave</h1>
        <p className="text-sm text-muted-foreground">
          Your account isn&apos;t linked to an employee record yet. Ask HR to link it.
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();

  const [employee, balances, requests] = await Promise.all([
    prisma.employee.findUniqueOrThrow({ where: { id: user.employeeId } }),
    prisma.wellnessLeaveBalance.findMany({ where: { employeeId: user.employeeId, year } }),
    prisma.wellnessLeaveRequest.findMany({
      where: {
        employeeId: user.employeeId,
        startDate: { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const sem1 = balances.find((b) => b.semester === 1);
  const sem2 = balances.find((b) => b.semester === 2);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Wellness Leave</h1>
          <p className="text-sm text-muted-foreground">
            {employee.name} &middot; {employee.officeAssignment}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/wellness-leave/blank/${employee.id}/print`}>
            <Button type="button" variant="outline">
              <Printer />
              Print Blank Form
            </Button>
          </Link>
          <NewMyWellnessLeaveRequestDialog />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {yearOptions(year).map((y) => (
          <Link key={y} href={`/my-wellness-leave?year=${y}`}>
            <Button variant={y === year ? "default" : "outline"} size="sm">
              {y}
            </Button>
          </Link>
        ))}
      </div>

      {!sem1 && !sem2 ? (
        <p className="text-sm text-muted-foreground">
          No Wellness Leave balance has been set up for {year} yet. Check with HR.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <SemesterCard label={semesterLabel(1)} balance={sem1} />
          <SemesterCard label={semesterLabel(2)} balance={sem2} />
        </div>
      )}

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No Wellness Leave requests for {year}.
                </TableCell>
              </TableRow>
            )}
            {requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="text-sm">
                  {formatISODate(request.startDate)} – {formatISODate(request.endDate)}
                </TableCell>
                <TableCell>{request.daysCount}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{request.notes ?? ""}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[wellnessLeaveDisplayStatus(request.status, request.endDate)]}>
                    {wellnessLeaveDisplayStatusLabel(wellnessLeaveDisplayStatus(request.status, request.endDate))}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {canPullOutWellnessLeave(request.status, request.endDate) && <PullOutButton id={request.id} />}
                  <Link href={`/wellness-leave/${request.id}/print`}>
                    <Button type="button" variant="outline" size="sm">
                      <Printer />
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
  );
}

function SemesterCard({
  label,
  balance,
}: {
  label: string;
  balance?: { allotted: number; used: number };
}) {
  const remaining = balance ? balance.allotted - balance.used : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <Stat label="Allotted" value={balance ? String(balance.allotted) : "—"} />
        <Stat label="Used" value={balance ? String(balance.used) : "—"} />
        <Stat label="Remaining" value={remaining !== null ? String(remaining) : "—"} highlight />
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={highlight ? "text-lg font-semibold text-primary" : "text-lg font-semibold"}>{value}</div>
    </div>
  );
}

function yearOptions(current: number): number[] {
  const base = new Date().getFullYear();
  const years = new Set([current, base, base - 1, base + 1]);
  return Array.from(years).sort((a, b) => b - a);
}
