"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_CODES } from "@/lib/attendance-codes";
import { formatDisplayDate } from "@/lib/period";
import { submitDtrEntries } from "./actions";
import type { AttendanceCode } from "@/generated/prisma/enums";

export type MyDtrRow = {
  date: string;
  officialLabel: string;
  proposedCode: AttendanceCode;
  proposedLateMinutes: number;
  proposedNotes: string;
  pendingStatus: "PENDING" | "REJECTED" | null;
};

function rowsEqual(a: { code: AttendanceCode; lateMinutes: number; notes: string }, b: typeof a) {
  return a.code === b.code && a.lateMinutes === b.lateMinutes && a.notes === b.notes;
}

export function MyDtrForm({ initialRows }: { initialRows: MyDtrRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  function updateRow(index: number, patch: Partial<MyDtrRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit() {
    const changed = rows.filter((row, i) => {
      const original = initialRows[i];
      return !rowsEqual(
        { code: row.proposedCode, lateMinutes: row.proposedLateMinutes, notes: row.proposedNotes },
        { code: original.proposedCode, lateMinutes: original.proposedLateMinutes, notes: original.proposedNotes },
      );
    });

    if (changed.length === 0) {
      toast.error("No changes to submit");
      return;
    }

    startTransition(async () => {
      const result = await submitDtrEntries(
        changed.map((row) => ({
          date: row.date,
          code: row.proposedCode,
          lateMinutes: row.proposedLateMinutes,
          notes: row.proposedNotes,
        })),
      );
      if (!result.error) {
        toast.success(`Submitted ${changed.length} day(s) for HR review`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Official</TableHead>
              <TableHead>Your Entry</TableHead>
              <TableHead>Late/Undertime (min)</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.date}>
                <TableCell className="whitespace-nowrap text-sm">{formatDisplayDate(row.date)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.officialLabel}</TableCell>
                <TableCell>
                  <Select
                    value={row.proposedCode}
                    onValueChange={(value) =>
                      updateRow(i, {
                        proposedCode: value as AttendanceCode,
                        proposedLateMinutes: value === "LATE" ? row.proposedLateMinutes : 0,
                      })
                    }
                  >
                    <SelectTrigger size="sm" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_CODES.map((meta) => (
                        <SelectItem key={meta.code} value={meta.code}>
                          {meta.shortLabel} — {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    disabled={row.proposedCode !== "LATE"}
                    value={row.proposedCode === "LATE" ? row.proposedLateMinutes : 0}
                    onChange={(e) => updateRow(i, { proposedLateMinutes: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-48"
                    value={row.proposedNotes}
                    onChange={(e) => updateRow(i, { proposedNotes: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  {row.pendingStatus === "PENDING" && <Badge variant="outline">Pending review</Badge>}
                  {row.pendingStatus === "REJECTED" && <Badge variant="destructive">Rejected</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Changes are submitted to HR for review — they won&apos;t affect your DTR or pay until approved.
        </p>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Submitting..." : "Submit changes for review"}
        </Button>
      </div>
    </div>
  );
}
