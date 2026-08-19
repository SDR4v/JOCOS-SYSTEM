"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { semesterLabel } from "@/lib/wellness-leave";

type ResolvedStatus = "APPROVED" | "REJECTED";

type ResolvedRequest = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  status: ResolvedStatus;
  employee: { name: string };
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
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search request history by employee name..."
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

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {requests.length} shown
      </p>
    </div>
  );
}
