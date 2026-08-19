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
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { formatDisplayDate, parseISODate } from "@/lib/period";
import {
  computeAttendanceFromTimes,
  combineDateAndTime,
  minutesToHHMM,
  resolveSchedule,
  MANUAL_OVERRIDE_CODES,
  type ManualOverrideCode,
  type EmployeeScheduleFields,
  type ResolvedSchedule,
} from "@/lib/dtr-time";
import { submitDtrEntries } from "./actions";

export type MyDtrRow = {
  date: string;
  officialLabel: string;
  amArrival: string;
  amDeparture: string;
  pmArrival: string;
  pmDeparture: string;
  overrideCode: ManualOverrideCode | "";
  notes: string;
  pendingStatus: "PENDING" | "REJECTED" | null;
};

function fieldsEqual(a: MyDtrRow, b: MyDtrRow) {
  return (
    a.amArrival === b.amArrival &&
    a.amDeparture === b.amDeparture &&
    a.pmArrival === b.pmArrival &&
    a.pmDeparture === b.pmDeparture &&
    a.overrideCode === b.overrideCode &&
    a.notes === b.notes
  );
}

function rowPreview(row: MyDtrRow, schedule: ResolvedSchedule) {
  if (row.overrideCode) {
    const meta = ATTENDANCE_CODE_MAP[row.overrideCode];
    return meta.shortLabel;
  }
  const computed = computeAttendanceFromTimes(
    {
      amArrival: row.amArrival ? combineDateAndTime(row.date, row.amArrival) : null,
      amDeparture: row.amDeparture ? combineDateAndTime(row.date, row.amDeparture) : null,
      pmArrival: row.pmArrival ? combineDateAndTime(row.date, row.pmArrival) : null,
      pmDeparture: row.pmDeparture ? combineDateAndTime(row.date, row.pmDeparture) : null,
    },
    schedule,
  );
  return computed.code === "LATE" ? String(computed.lateMinutes) : ATTENDANCE_CODE_MAP[computed.code].shortLabel;
}

export function MyDtrForm({
  initialRows,
  employeeSchedule,
}: {
  initialRows: MyDtrRow[];
  employeeSchedule: EmployeeScheduleFields;
}) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  function updateRow(index: number, patch: Partial<MyDtrRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit() {
    const changed = rows.filter((row, i) => !fieldsEqual(row, initialRows[i]));

    if (changed.length === 0) {
      toast.error("No changes to submit");
      return;
    }

    startTransition(async () => {
      const result = await submitDtrEntries(
        changed.map((row) => ({
          date: row.date,
          amArrival: row.amArrival,
          amDeparture: row.amDeparture,
          pmArrival: row.pmArrival,
          pmDeparture: row.pmDeparture,
          overrideCode: row.overrideCode,
          notes: row.notes,
        })),
      );
      if (!result.error) {
        toast.success(`Submitted ${changed.length} day(s) for HR review`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const schedules = rows.map((row) => resolveSchedule(employeeSchedule, parseISODate(row.date).getUTCDay()));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {employeeSchedule.scheduleMode === "PER_DAY"
          ? "Your schedule varies by day of week — hover a row's date for that day's hours."
          : `Your schedule: ${minutesToHHMM(schedules[0].session1.start)}–${minutesToHHMM(schedules[0].session1.end)}${
              schedules[0].session2
                ? ` & ${minutesToHHMM(schedules[0].session2.start)}–${minutesToHHMM(schedules[0].session2.end)}`
                : " (single continuous session, no PM)"
            }`}
      </p>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Official</TableHead>
              <TableHead>AM Arrival</TableHead>
              <TableHead>AM Departure</TableHead>
              <TableHead>PM Arrival</TableHead>
              <TableHead>PM Departure</TableHead>
              <TableHead>Override</TableHead>
              <TableHead>Proposed</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const schedule = schedules[i];
              const hasSecondSession = !!schedule.session2;
              const timesDisabled = !!row.overrideCode;
              const scheduleTitle = `${minutesToHHMM(schedule.session1.start)}–${minutesToHHMM(schedule.session1.end)}${
                schedule.session2 ? ` & ${minutesToHHMM(schedule.session2.start)}–${minutesToHHMM(schedule.session2.end)}` : ""
              }`;
              return (
                <TableRow key={row.date}>
                  <TableCell className="whitespace-nowrap text-sm" title={scheduleTitle}>
                    {formatDisplayDate(row.date)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.officialLabel}</TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={timesDisabled}
                      value={row.amArrival}
                      onChange={(e) => updateRow(i, { amArrival: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={timesDisabled}
                      value={row.amDeparture}
                      onChange={(e) => updateRow(i, { amDeparture: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={timesDisabled || !hasSecondSession}
                      value={row.pmArrival}
                      onChange={(e) => updateRow(i, { pmArrival: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      className="w-28"
                      disabled={timesDisabled || !hasSecondSession}
                      value={row.pmDeparture}
                      onChange={(e) => updateRow(i, { pmDeparture: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.overrideCode || "AUTO"}
                      onValueChange={(value) =>
                        updateRow(i, { overrideCode: value === "AUTO" ? "" : (value as ManualOverrideCode) })
                      }
                    >
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AUTO">Auto (from times)</SelectItem>
                        {MANUAL_OVERRIDE_CODES.map((code) => (
                          <SelectItem key={code} value={code}>
                            {ATTENDANCE_CODE_MAP[code].shortLabel} — {ATTENDANCE_CODE_MAP[code].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{rowPreview(row, schedules[i])}</TableCell>
                  <TableCell>
                    <Input
                      className="w-40"
                      value={row.notes}
                      onChange={(e) => updateRow(i, { notes: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    {row.pendingStatus === "PENDING" && <Badge variant="outline">Pending review</Badge>}
                    {row.pendingStatus === "REJECTED" && <Badge variant="destructive">Rejected</Badge>}
                  </TableCell>
                </TableRow>
              );
            })}
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
