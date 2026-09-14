"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate, halfLabel, MONTH_NAMES, type Half } from "@/lib/period";
import { formatTimeHHMM, previewRequestCode, type ManualOverrideCode, type ResolvedSchedule } from "@/lib/dtr-time";
import { humanizeEnum } from "@/lib/utils";
import { RevertApprovalButton } from "./request-actions";

type ResolvedStatus = "APPROVED" | "REJECTED";

type ResolvedRequest = {
  id: string;
  date: Date;
  amArrival: Date | null;
  amDeparture: Date | null;
  pmArrival: Date | null;
  pmDeparture: Date | null;
  overrideCode: ManualOverrideCode | null;
  status: ResolvedStatus;
  employeeId: string;
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

  // Employee -> Month -> Half, most recently active first at every level.
  const employeeGroups = useMemo(() => {
    const byEmployee = new Map<
      string,
      { employeeId: string; employeeName: string; requests: ResolvedRequest[]; latest: number }
    >();
    for (const r of filtered) {
      const t = r.date.getTime();
      const group = byEmployee.get(r.employeeId);
      if (group) {
        group.requests.push(r);
        if (t > group.latest) group.latest = t;
      } else {
        byEmployee.set(r.employeeId, { employeeId: r.employeeId, employeeName: r.employee.name, requests: [r], latest: t });
      }
    }
    return Array.from(byEmployee.values()).sort((a, b) => b.latest - a.latest);
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by employee name..."
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

      {employeeGroups.length === 0 ? (
        <p className="rounded-lg border bg-card py-10 text-center text-sm text-muted-foreground shadow-sm">
          No requests match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {employeeGroups.map((group) => (
            <CollapsibleSection key={group.employeeId} label={group.employeeName} count={group.requests.length} level={0}>
              <MonthGroups requests={group.requests} />
            </CollapsibleSection>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {requests.length} shown
      </p>
    </div>
  );
}

function MonthGroups({ requests }: { requests: ResolvedRequest[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { year: number; month: number; requests: ResolvedRequest[] }>();
    for (const r of requests) {
      const year = r.date.getUTCFullYear();
      const month = r.date.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      const group = map.get(key);
      if (group) group.requests.push(r);
      else map.set(key, { year, month, requests: [r] });
    }
    return Array.from(map.values()).sort((a, b) => b.year - a.year || b.month - a.month);
  }, [requests]);

  return (
    <div className="space-y-2 p-2">
      {groups.map((group) => (
        <CollapsibleSection
          key={`${group.year}-${group.month}`}
          label={`${MONTH_NAMES[group.month - 1]} ${group.year}`}
          count={group.requests.length}
          level={1}
        >
          <HalfGroups requests={group.requests} />
        </CollapsibleSection>
      ))}
    </div>
  );
}

function HalfGroups({ requests }: { requests: ResolvedRequest[] }) {
  const groups = useMemo(() => {
    const map = new Map<Half, ResolvedRequest[]>();
    for (const r of requests) {
      const half: Half = r.date.getUTCDate() <= 15 ? 1 : 2;
      const list = map.get(half);
      if (list) list.push(r);
      else map.set(half, [r]);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([half, reqs]) => ({ half, requests: reqs }));
  }, [requests]);

  return (
    <div className="space-y-2 p-2">
      {groups.map((group) => (
        <CollapsibleSection key={group.half} label={halfLabel(group.half)} count={group.requests.length} level={2}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>AM</TableHead>
                  <TableHead>PM</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.requests.map((request) => (
                  <TableRow key={request.id}>
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
                    <TableCell>
                      <Badge variant={request.status === "APPROVED" ? "default" : "destructive"}>{humanizeEnum(request.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "APPROVED" && <RevertApprovalButton id={request.id} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
}

function CollapsibleSection({
  label,
  count,
  level,
  children,
}: {
  label: string;
  count: number;
  level: 0 | 1 | 2;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapperClass =
    level === 0
      ? "overflow-hidden rounded-lg border bg-card shadow-sm"
      : level === 1
        ? "overflow-hidden rounded-md border bg-background"
        : "overflow-hidden rounded-md border bg-muted/20";
  const headerClass =
    level === 0
      ? "bg-muted/40 px-4 py-2 text-sm font-semibold"
      : level === 1
        ? "bg-muted/30 px-3 py-1.5 text-sm font-medium"
        : "bg-muted/20 px-3 py-1.5 text-sm";

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 border-b text-left ${headerClass}`}
      >
        <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        {label}
        <span className="font-normal text-muted-foreground">
          &middot; {count} entr{count === 1 ? "y" : "ies"}
        </span>
      </button>
      {open && children}
    </div>
  );
}
