"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { semesterLabel, getSemester } from "@/lib/wellness-leave";
import { RestoreRequestButton } from "./delete-restore-buttons";

type BinnedRequest = {
  id: string;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  employee: { name: string };
  deletedByName: string | null;
  deletedAt: Date;
};

export function BinTable({ requests }: { requests: BinnedRequest[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => r.employee.name.toLowerCase().includes(q));
  }, [requests, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search deleted requests by employee name..."
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Deleted By</TableHead>
              <TableHead>Deleted At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  {requests.length === 0 ? "The bin is empty." : "No deleted requests match this search."}
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
                <TableCell className="text-sm text-muted-foreground">{request.deletedByName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatISODate(request.deletedAt)}</TableCell>
                <TableCell className="text-right">
                  <RestoreRequestButton id={request.id} />
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
