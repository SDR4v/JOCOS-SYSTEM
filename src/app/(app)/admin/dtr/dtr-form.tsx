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
import { saveDtrPeriod } from "./actions";

export type DtrRowValue = {
  date: string;
  amArrival: string;
  amDeparture: string;
  pmArrival: string;
  pmDeparture: string;
  overrideCode: ManualOverrideCode | "";
  notes: string;
};

function rowPreview(row: DtrRowValue, schedule: ResolvedSchedule) {
  if (row.overrideCode) {
    const meta = ATTENDANCE_CODE_MAP[row.overrideCode];
    return { code: meta.shortLabel, label: meta.label, dayCredit: meta.defaultDayCredit, lateMinutes: 0 };
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
  const meta = ATTENDANCE_CODE_MAP[computed.code];
  return {
    code: computed.code === "LATE" ? String(computed.lateMinutes) : meta.shortLabel,
    label: meta.label,
    dayCredit: computed.dayCredit,
    lateMinutes: computed.lateMinutes,
  };
}

export function DtrForm({
  employeeId,
  initialRows,
  employeeSchedule,
}: {
  employeeId: string;
  initialRows: DtrRowValue[];
  employeeSchedule: EmployeeScheduleFields;
}) {
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

  const schedules = rows.map((row) => resolveSchedule(employeeSchedule, parseISODate(row.date).getUTCDay()));
  const previews = rows.map((row, i) => rowPreview(row, schedules[i]));
  const totalCredit = previews.reduce((sum, p) => sum + p.dayCredit, 0);
  const totalLateMinutes = previews.reduce((sum, p) => sum + p.lateMinutes, 0);

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
        {employeeSchedule.scheduleMode === "PER_DAY"
          ? "Schedule varies by day of week — hover a row's date for that day's hours."
          : `Schedule: ${minutesToHHMM(schedules[0].session1.start)}–${minutesToHHMM(schedules[0].session1.end)}${
              schedules[0].session2
                ? ` & ${minutesToHHMM(schedules[0].session2.start)}–${minutesToHHMM(schedules[0].session2.end)}`
                : " (single continuous session, no PM)"
            }`}
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>AM Arrival</TableHead>
              <TableHead>AM Departure</TableHead>
              <TableHead>PM Arrival</TableHead>
              <TableHead>PM Departure</TableHead>
              <TableHead>Override</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const preview = previews[i];
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
                  <TableCell className="text-sm font-medium whitespace-nowrap" title={preview.label}>
                    {preview.code}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="w-40"
                      value={row.notes}
                      onChange={(e) => updateRow(i, { notes: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
        <p className="text-sm">
          Total day credit: <span className="font-semibold">{totalCredit.toFixed(1)}</span>
          <span className="text-muted-foreground"> &middot; Late/undertime minutes: {totalLateMinutes}</span>
        </p>
        <Button onClick={handleSave} disabled={pending}>
          {pending ? "Saving..." : "Save DTR"}
        </Button>
      </div>
    </div>
  );
}
