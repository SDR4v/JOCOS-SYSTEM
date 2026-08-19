"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { semesterLabel, getSemester } from "@/lib/wellness-leave";
import { ViewWellnessLeaveRequestDialog } from "./view-request-dialog";

type ResolvedStatus = "APPROVED" | "REJECTED";

type ResolvedRequest = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  notes: string | null;
  status: ResolvedStatus;
  employee: { name: string; officeAssignment: string; positionTitle: string };
  createdAt: Date;
  resolvedByName: string | null;
  resolvedAt: Date | null;
};

type StatusFilter = "ALL" | ResolvedStatus;

export function RequestHistoryTable({ requests }: { requests: ResolvedRequest[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (q && !r.employee.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [requests, query, status]);

  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search request history by employee name..."
            className="pl-8"
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant={status === "ALL" ? "default" : "outline"} size="sm" onClick={() => setStatus("ALL")}>
            All
          </Button>
          <Button
            type="button"
            variant={status === "APPROVED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("APPROVED")}
          >
            Approved
          </Button>
          <Button
            type="button"
            variant={status === "REJECTED" ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus("REJECTED")}
          >
            Rejected ({rejectedCount})
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
                <TableCell className="text-sm">{semesterLabel(request.startDate.getUTCMonth() < 6 ? 1 : 2)}</TableCell>
                <TableCell>{request.daysCount}</TableCell>
                <TableCell>
                  <Badge variant={request.status === "APPROVED" ? "default" : "destructive"}>{request.status}</Badge>
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
                      status: request.status,
                      filedAtLabel: formatISODate(request.createdAt),
                      resolvedByLabel: request.resolvedByName,
                      resolvedAtLabel: request.resolvedAt ? formatISODate(request.resolvedAt) : null,
                    }}
                  />
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

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {requests.length} shown
      </p>
    </div>
  );
}
