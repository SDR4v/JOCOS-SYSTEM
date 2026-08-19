"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { semesterLabel } from "@/lib/wellness-leave";

type ResolvedRequest = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  status: "APPROVED" | "REJECTED";
  employee: { name: string };
};

export function RequestHistoryTable({ requests }: { requests: ResolvedRequest[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => r.employee.name.toLowerCase().includes(q));
  }, [requests, query]);

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search request history by employee name..."
        className="max-w-sm"
      />

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
                  No requests match &quot;{query}&quot;.
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
                  <Badge variant={request.status === "APPROVED" ? "default" : "secondary"}>{request.status}</Badge>
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
