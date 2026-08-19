"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { formatTimeHHMM, previewRequestCode, type ManualOverrideCode, type ResolvedSchedule } from "@/lib/dtr-time";

type ResolvedStatus = "APPROVED" | "REJECTED";

type ResolvedRequest = {
  id: string;
  date: Date;
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
  overrideCode: ManualOverrideCode | null;
  notes: string | null;
  status: ResolvedStatus;
  employee: { name: string };
  schedule: ResolvedSchedule;
};

type StatusFilter = "ALL" | ResolvedStatus;

export function HistoryTable({ requests }: { requests: ResolvedRequest[] }) {
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
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by employee name..."
          className="max-w-sm"
        />
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

      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>AM</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No requests match this filter.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">{request.employee.name}</TableCell>
                <TableCell className="text-sm">{formatISODate(request.date)}</TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {request.overrideCode
                    ? "—"
                    : `${request.amArrival ? formatTimeHHMM(request.amArrival) : "—"}–${request.amDeparture ? formatTimeHHMM(request.amDeparture) : "—"}`}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap">
                  {request.overrideCode
                    ? "—"
                    : `${request.pmArrival ? formatTimeHHMM(request.pmArrival) : "—"}–${request.pmDeparture ? formatTimeHHMM(request.pmDeparture) : "—"}`}
                </TableCell>
                <TableCell className="text-sm font-medium">{previewRequestCode(request, request.schedule)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{request.notes ?? ""}</TableCell>
                <TableCell>
                  <Badge variant={request.status === "APPROVED" ? "default" : "destructive"}>{request.status}</Badge>
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
