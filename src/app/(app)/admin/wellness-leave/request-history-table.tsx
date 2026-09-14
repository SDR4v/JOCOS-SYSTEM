"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import {
  semesterLabel,
  getSemester,
  wellnessLeaveDisplayStatus,
  wellnessLeaveDisplayStatusLabel,
  type WellnessLeaveDisplayStatus,
} from "@/lib/wellness-leave";
import { ViewWellnessLeaveRequestDialog } from "./view-request-dialog";
import { MarkTakenButton } from "./mark-taken-button";
import { DeleteRequestButton } from "./delete-restore-buttons";

type RequestStatus = "ACTIVE" | "CANCELLED";

type WellnessLeaveRequestRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  notes: string | null;
  status: RequestStatus;
  employee: { name: string; officeAssignment: string; positionTitle: string };
  createdAt: Date;
  cancelledByName: string | null;
  cancelledAt: Date | null;
  confirmedTakenByName: string | null;
  confirmedTakenAt: Date | null;
};

type StatusFilter = "ALL" | WellnessLeaveDisplayStatus;

const STATUS_BADGE_VARIANT: Record<WellnessLeaveDisplayStatus, "default" | "outline" | "destructive"> = {
  UPCOMING: "outline",
  TAKEN: "default",
  CANCELLED: "destructive",
};

export function RequestHistoryTable({ requests }: { requests: WellnessLeaveRequestRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const rows = useMemo(
    () =>
      requests.map((r) => ({
        ...r,
        displayStatus: wellnessLeaveDisplayStatus(r.status, r.endDate, r.confirmedTakenAt),
      })),
    [requests],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && r.displayStatus !== status) return false;
      if (q && !r.employee.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, status]);

  const counts = useMemo(() => {
    const c: Record<WellnessLeaveDisplayStatus, number> = { UPCOMING: 0, TAKEN: 0, CANCELLED: 0 };
    for (const r of rows) c[r.displayStatus]++;
    return c;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests by employee name..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={status === "ALL" ? "default" : "outline"} size="sm" onClick={() => setStatus("ALL")}>
            All
          </Button>
          <Button
            type="button"
            variant={status === "UPCOMING" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("UPCOMING")}
          >
            Upcoming ({counts.UPCOMING})
          </Button>
          <Button
            type="button"
            variant={status === "TAKEN" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("TAKEN")}
          >
            Taken ({counts.TAKEN})
          </Button>
          <Button
            type="button"
            variant={status === "CANCELLED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("CANCELLED")}
          >
            Pulled Out ({counts.CANCELLED})
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
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
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No requests match this filter.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.employee.name}</TableCell>
                <TableCell className="text-sm">
                  {formatISODate(request.startDate)} – {formatISODate(request.endDate)}
                </TableCell>
                <TableCell className="text-sm">{semesterLabel(getSemester(request.startDate))}</TableCell>
                <TableCell>{request.daysCount}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[request.displayStatus]}>
                    {wellnessLeaveDisplayStatusLabel(request.displayStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <ViewWellnessLeaveRequestDialog
                    request={{
                      employeeName: request.employee.name,
                      officeAssignment: request.employee.officeAssignment,
                      positionTitle: request.employee.positionTitle,
                      semesterLabel: semesterLabel(getSemester(request.startDate)),
                      datesLabel: `${formatISODate(request.startDate)} – ${formatISODate(request.endDate)}`,
                      daysCount: request.daysCount,
                      notes: request.notes,
                      displayStatus: request.displayStatus,
                      filedAtLabel: formatISODate(request.createdAt),
                      pulledOutByLabel: request.cancelledByName,
                      pulledOutAtLabel: request.cancelledAt ? formatISODate(request.cancelledAt) : null,
                      confirmedTakenByLabel: request.confirmedTakenByName,
                      confirmedTakenAtLabel: request.confirmedTakenAt ? formatISODate(request.confirmedTakenAt) : null,
                    }}
                  />
                  {request.displayStatus === "UPCOMING" && <MarkTakenButton id={request.id} />}
                  <Link href={`/wellness-leave/${request.id}/print`}>
                    <Button type="button" variant="outline" size="sm">
                      <Printer />
                      Print
                    </Button>
                  </Link>
                  <DeleteRequestButton id={request.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {requests.length} shown
      </p>
    </div>
  );
}
