import Link from "next/link";
import { CheckCircle2, UserRoundSearch } from "lucide-react";
import { requireAdmin } from "@/lib/session";
import { getHalfMonthRange, clampMonth, type Half } from "@/lib/period";
import { getDtrMonitoringSummary, INCOMPLETE_REASON_LABEL, type IncompleteReason } from "@/lib/dtr-monitoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonitoringFilters } from "./monitoring-filters";

const REASON_BADGE_VARIANT: Record<IncompleteReason, "outline" | "destructive" | "secondary"> = {
  no_punch_data: "outline",
  incomplete_punches: "destructive",
  unsaved_biometric_data: "secondary",
};

export default async function MonitoringPage({ searchParams }: PageProps<"/admin/monitoring">) {
  await requireAdmin();

  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const month = clampMonth(Number(params.month) || now.getMonth() + 1);
  const half: Half = typeof params.half === "string" && Number(params.half) === 2 ? 2 : 1;

  const { start, end } = getHalfMonthRange(year, month, half);
  const { employees, unmatchedNames } = await getDtrMonitoringSummary(start, end);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Monitoring</h1>
        <p className="text-sm text-muted-foreground">
          Who still doesn&apos;t have a complete DTR for the selected period — a punch that never paired up, a
          scan that couldn&apos;t be matched to anyone, or simply no entry at all yet.
        </p>
      </div>

      <MonitoringFilters year={year} month={month} half={half} />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Names needing a match</h2>
        {unmatchedNames.length === 0 ? (
          <EmptyState message="No unmatched biometric names for this period." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scanned name</TableHead>
                <TableHead>Punches</TableHead>
                <TableHead>Upload</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatchedNames.map((u) => (
                <TableRow key={u.rawName}>
                  <TableCell className="text-sm font-medium">{u.rawName}</TableCell>
                  <TableCell className="text-sm">{u.count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.uploadTitle}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/biometrics/${u.uploadId}`}>
                      <Button type="button" variant="outline" size="sm">
                        Review
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          Employees with incomplete DTR
          {employees.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold/15 px-1.5 text-xs font-semibold text-brand-gold">
              {employees.length}
            </span>
          )}
        </h2>
        {employees.length === 0 ? (
          <EmptyState message="Nothing outstanding — every active employee's DTR is complete for this period so far." icon={<CheckCircle2 className="size-8 text-muted-foreground/50" />} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Missing days</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => (
                <TableRow key={e.employeeId}>
                  <TableCell className="text-sm font-medium whitespace-nowrap">{e.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{e.officeAssignment}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-wrap gap-1.5">
                      {e.days.map((d) => (
                        <Badge key={d.iso} variant={REASON_BADGE_VARIANT[d.reason]} title={INCOMPLETE_REASON_LABEL[d.reason]}>
                          {d.display}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/dtr?employeeId=${e.employeeId}&year=${year}&month=${month}&half=${half}`}>
                      <Button type="button" variant="outline" size="sm">
                        Open DTR
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline">Date</Badge> No punch data
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="destructive">Date</Badge> Partial punches — needs manual entry
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="secondary">Date</Badge> Biometric data ready — needs saving
        </span>
      </div>
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-card py-10 text-center shadow-sm">
      {icon ?? <UserRoundSearch className="size-8 text-muted-foreground/50" />}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
