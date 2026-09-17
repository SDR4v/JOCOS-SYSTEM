"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CopyPlus, Sparkles } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeInputWithClear } from "@/components/time-input-with-clear";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DayScheduleButton } from "@/components/day-schedule-button";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { formatDisplayDate, parseISODate } from "@/lib/period";
import { humanizeEnum } from "@/lib/utils";
import {
  computeAttendanceFromTimes,
  combineDateAndTime,
  minutesToHHMM,
  resolveSchedule,
  scheduledDurationMinutes,
  formatDurationHM,
  formatScheduleSummary,
  MANUAL_OVERRIDE_CODES,
  type ManualOverrideCode,
  type EmployeeScheduleFields,
  type ResolvedSchedule,
  type DateScheduleOverrideFields,
} from "@/lib/dtr-time";
import { submitDtrEntries, setMyDateSchedule } from "./actions";

export type MyDtrRow = {
  date: string;
  officialLabel: string;
  amArrival: string;
  amDeparture: string;
  pmArrival: string;
  pmDeparture: string;
  overrideCode: ManualOverrideCode | "";
  pendingStatus: "PENDING" | "REJECTED" | "APPROVED" | null;
  // A free-text note explaining the day — never shown on the printed DTR.
  remarks: string;
  // A one-off schedule for just this date — see EmployeeDateSchedule. Null
  // means "use your usual schedule."
  dateOverride: DateScheduleOverrideFields | null;
};

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
  if (computed.code === "LATE") return String(computed.lateMinutes);
  if (computed.code === "ABSENT") return `Undertime — ${formatDurationHM(scheduledDurationMinutes(schedule))}`;
  return ATTENDANCE_CODE_MAP[computed.code].shortLabel;
}

type DraftFields = Pick<MyDtrRow, "amArrival" | "amDeparture" | "pmArrival" | "pmDeparture" | "overrideCode" | "remarks">;

function draftStorageKey(employeeId: string, rows: MyDtrRow[]): string | null {
  const first = rows[0]?.date;
  return first ? `jocos:my-dtr-draft:${employeeId}:${first}` : null;
}

export function MyDtrForm({
  employeeId,
  initialRows,
  employeeSchedule,
}: {
  employeeId: string;
  initialRows: MyDtrRow[];
  employeeSchedule: EmployeeScheduleFields;
}) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();

  function saveDraft(nextRows: MyDtrRow[]) {
    const key = draftStorageKey(employeeId, initialRows);
    if (!key) return;
    const draft: Record<string, DraftFields> = {};
    for (const row of nextRows) {
      const locked = row.pendingStatus === "PENDING" || row.pendingStatus === "APPROVED";
      if (locked) continue;
      draft[row.date] = {
        amArrival: row.amArrival,
        amDeparture: row.amDeparture,
        pmArrival: row.pmArrival,
        pmDeparture: row.pmDeparture,
        overrideCode: row.overrideCode,
        remarks: row.remarks,
      };
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // storage full/unavailable — the draft just won't persist this time
    }
  }

  function clearDraft() {
    const key = draftStorageKey(employeeId, initialRows);
    if (key) window.localStorage.removeItem(key);
  }

  // Typing here was otherwise only kept in memory — switching pages before
  // hitting Submit threw it all away. Restore whatever was last typed for
  // this exact half-month period, read once from localStorage on mount.
  useEffect(() => {
    const key = draftStorageKey(employeeId, initialRows);
    if (!key) return;
    let draft: Record<string, DraftFields> | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      draft = raw ? JSON.parse(raw) : null;
    } catch {
      draft = null;
    }
    if (!draft) return;
    const restored = draft;
    // One-time hydration from an external store (localStorage) on mount —
    // not state derived from props, so this is the legitimate exception to
    // "don't setState in an effect".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows((prev) =>
      prev.map((row) => {
        const locked = row.pendingStatus === "PENDING" || row.pendingStatus === "APPROVED";
        const saved = restored[row.date];
        return locked || !saved ? row : { ...row, ...saved };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(index: number, patch: Partial<MyDtrRow>) {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      saveDraft(next);
      return next;
    });
  }

  // One click instead of retyping the same schedule into every row — fills
  // every editable AUTO row (skips locked and overridden days) with that
  // day's resolved schedule times.
  function fillStandardHours() {
    setRows((prev) => {
      const next = prev.map((row, i) => {
        const locked = row.pendingStatus === "PENDING" || row.pendingStatus === "APPROVED";
        if (row.overrideCode || locked) return row;
        const schedule = schedules[i];
        return {
          ...row,
          amArrival: schedule.session1 ? minutesToHHMM(schedule.session1.start) : "",
          amDeparture: schedule.session1 ? minutesToHHMM(schedule.session1.end) : "",
          pmArrival: schedule.session2 ? minutesToHHMM(schedule.session2.start) : "",
          pmDeparture: schedule.session2 ? minutesToHHMM(schedule.session2.end) : "",
        };
      });
      saveDraft(next);
      return next;
    });
    toast.success("Filled standard hours for every editable day");
  }

  function copyPreviousRow(index: number) {
    if (index === 0) return;
    const prevRow = rows[index - 1];
    updateRow(index, {
      amArrival: prevRow.amArrival,
      amDeparture: prevRow.amDeparture,
      pmArrival: prevRow.pmArrival,
      pmDeparture: prevRow.pmDeparture,
    });
  }

  function handleSubmit() {
    // A day already awaiting HR review, or already approved and on file, is
    // locked — it can't be resubmitted. Rejected (or never-submitted) days
    // are fair game. An admin can revert an accidental approval to reopen it.
    // Days later than today are excluded too — submitting them blank would
    // lock those not-yet-elapsed rows as PENDING before the employee ever
    // gets a chance to fill them in.
    const todayISO = new Date().toISOString().slice(0, 10);
    const submittable = rows.filter(
      (row) => row.pendingStatus !== "PENDING" && row.pendingStatus !== "APPROVED" && row.date <= todayISO,
    );

    if (submittable.length === 0) {
      toast.error("Nothing left to submit — the rest is already approved, pending review, or hasn't happened yet");
      return;
    }

    startTransition(async () => {
      const result = await submitDtrEntries(
        submittable.map((row) => ({
          date: row.date,
          amArrival: row.amArrival,
          amDeparture: row.amDeparture,
          pmArrival: row.pmArrival,
          pmDeparture: row.pmDeparture,
          overrideCode: row.overrideCode,
          remarks: row.remarks,
        })),
      );
      if (!result.error) {
        toast.success(`Submitted ${submittable.length} day(s) for HR review`);
        clearDraft();
      } else {
        toast.error(result.error);
      }
    });
  }

  const schedules = rows.map((row) =>
    resolveSchedule(employeeSchedule, parseISODate(row.date).getUTCDay(), row.dateOverride),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {employeeSchedule.scheduleMode === "PER_DAY"
            ? "Your schedule varies by day of week — hover a row's date for that day's hours."
            : `Your schedule: ${formatScheduleSummary(schedules[0])}`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fillStandardHours}>
          <Sparkles />
          Fill standard hours
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
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
              <TableHead>Status</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const schedule = schedules[i];
              const hasFirstSession = !!schedule.session1;
              const hasSecondSession = !!schedule.session2;
              const isLocked = row.pendingStatus === "PENDING" || row.pendingStatus === "APPROVED";
              const timesDisabled = !!row.overrideCode || isLocked;
              const scheduleTitle = formatScheduleSummary(schedule);
              return (
                <TableRow key={row.date}>
                  <TableCell className="whitespace-nowrap text-sm" title={scheduleTitle}>
                    <div className="flex items-center gap-1">
                      <DayScheduleButton
                        date={row.date}
                        override={row.dateOverride}
                        action={setMyDateSchedule}
                        onSaved={(value) => updateRow(i, { dateOverride: value })}
                      />
                      {formatDisplayDate(row.date)}
                      {i > 0 && !timesDisabled && (
                        <button
                          type="button"
                          title="Copy times from the row above"
                          onClick={() => copyPreviousRow(i)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <CopyPlus className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.officialLabel}</TableCell>
                  <TableCell title={hasFirstSession ? undefined : "No AM session in this day's schedule"}>
                    <TimeInputWithClear
                      className="w-28"
                      disabled={timesDisabled || !hasFirstSession}
                      value={row.amArrival}
                      onChange={(value) => updateRow(i, { amArrival: value })}
                    />
                  </TableCell>
                  <TableCell title={hasFirstSession ? undefined : "No AM session in this day's schedule"}>
                    <TimeInputWithClear
                      className="w-28"
                      disabled={timesDisabled || !hasFirstSession}
                      value={row.amDeparture}
                      onChange={(value) => updateRow(i, { amDeparture: value })}
                    />
                  </TableCell>
                  <TableCell title={hasSecondSession ? undefined : "No PM session in this day's schedule"}>
                    <TimeInputWithClear
                      className="w-28"
                      disabled={timesDisabled || !hasSecondSession}
                      value={row.pmArrival}
                      onChange={(value) => updateRow(i, { pmArrival: value })}
                    />
                  </TableCell>
                  <TableCell title={hasSecondSession ? undefined : "No PM session in this day's schedule"}>
                    <TimeInputWithClear
                      className="w-28"
                      disabled={timesDisabled || !hasSecondSession}
                      value={row.pmDeparture}
                      onChange={(value) => updateRow(i, { pmDeparture: value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.overrideCode || "AUTO"}
                      disabled={isLocked}
                      onValueChange={(value) =>
                        updateRow(i, { overrideCode: value === "AUTO" ? "" : (value as ManualOverrideCode) })
                      }
                    >
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue>{(value: string) => humanizeEnum(value)}</SelectValue>
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
                    {row.pendingStatus === "PENDING" && <Badge variant="outline">Pending review</Badge>}
                    {row.pendingStatus === "REJECTED" && <Badge variant="destructive">Returned</Badge>}
                    {row.pendingStatus === "APPROVED" && <Badge>Approved</Badge>}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="min-w-48"
                      placeholder="Optional note..."
                      disabled={isLocked}
                      value={row.remarks}
                      onChange={(e) => updateRow(i, { remarks: e.target.value })}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
        <p className="text-xs text-muted-foreground">
          Changes are submitted to HR for review — they won&apos;t affect your DTR or pay until approved.
        </p>
        <Button onClick={handleSubmit} loading={pending}>
          {pending ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}
