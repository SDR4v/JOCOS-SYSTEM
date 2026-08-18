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
import { ATTENDANCE_CODES, ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { formatDisplayDate } from "@/lib/period";
import { saveDtrPeriod } from "./actions";
import type { AttendanceCode } from "@/generated/prisma/enums";

export type DtrRowValue = {
  date: string;
  code: AttendanceCode;
  lateMinutes: number;
  notes: string;
};

export function DtrForm({ employeeId, initialRows }: { employeeId: string; initialRows: DtrRowValue[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  function updateRow(index: number, patch: Partial<DtrRowValue>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveDtrPeriod({ employeeId, rows });
      if (!result.error) {
        toast.success("DTR saved");
      } else {
        toast.error(result.error);
      }
    });
  }

  const totalCredit = rows.reduce((sum, row) => sum + ATTENDANCE_CODE_MAP[row.code].defaultDayCredit, 0);
  const totalLateMinutes = rows.reduce((sum, row) => sum + (row.code === "LATE" ? row.lateMinutes : 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Late/Undertime (min)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.date}>
                <TableCell className="whitespace-nowrap text-sm">{formatDisplayDate(row.date)}</TableCell>
                <TableCell>
                  <Select
                    value={row.code}
                    onValueChange={(value) =>
                      updateRow(i, {
                        code: value as AttendanceCode,
                        lateMinutes: value === "LATE" ? row.lateMinutes : 0,
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
                    disabled={row.code !== "LATE"}
                    value={row.code === "LATE" ? row.lateMinutes : 0}
                    onChange={(e) => updateRow(i, { lateMinutes: Number(e.target.value) })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="w-56"
                    value={row.notes}
                    onChange={(e) => updateRow(i, { notes: e.target.value })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Total day credit: {totalCredit.toFixed(1)} &middot; Late/undertime minutes: {totalLateMinutes}
        </p>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving..." : "Save DTR"}
        </Button>
      </div>
    </div>
  );
}
