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
import { Button } from "@/components/ui/button";
import { ATTENDANCE_CODE_MAP } from "@/lib/attendance-codes";
import { formatDisplayDate, parseISODate } from "@/lib/period";
import { cn, humanizeEnum } from "@/lib/utils";
import {
  computeAttendanceFromTimes,
  combineDateAndTime,
  minutesToHHMM,
  resolveSchedule,
  undertimeMinutesForDisplay,
  formatDurationHM,
  formatScheduleSummary,
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
  // Each punch is independently toggleable — a physical Trip Authorization
  // slip can cover just one missed punch (e.g. no AM time-out) while the
  // rest of the day is real times, so these aren't paired per session.
  amArrivalIsTA: boolean;
  amDepartureIsTA: boolean;
  pmArrivalIsTA: boolean;
  pmDepartureIsTA: boolean;
};

// A punch marked TA isn't a real time — resolve it to its own scheduled
// moment instead, so the existing grading math treats it as on-time without
// needing its own code path.
function timeOrTA(raw: string, isTA: boolean, date: string, taMinutes: number | undefined): Date | null {
  if (isTA) return taMinutes !== undefined ? combineDateAndTime(date, minutesToHHMM(taMinutes)) : null;
  return raw ? combineDateAndTime(date, raw) : null;
}

function rowPreview(row: DtrRowValue, schedule: ResolvedSchedule) {
  if (row.overrideCode) {
    const meta = ATTENDANCE_CODE_MAP[row.overrideCode];
    return {
      code: meta.shortLabel,
      label: meta.label,
      dayCredit: meta.defaultDayCredit,
      undertimeMinutes: undertimeMinutesForDisplay(meta.code, 0, schedule),
    };
  }

  const computed = computeAttendanceFromTimes(
    {
      amArrival: timeOrTA(row.amArrival, row.amArrivalIsTA, row.date, schedule.session1?.start),
      amDeparture: timeOrTA(row.amDeparture, row.amDepartureIsTA, row.date, schedule.session1?.end),
      pmArrival: timeOrTA(row.pmArrival, row.pmArrivalIsTA, row.date, schedule.session2?.start),
      pmDeparture: timeOrTA(row.pmDeparture, row.pmDepartureIsTA, row.date, schedule.session2?.end),
    },
    schedule,
  );

  const usedTA = row.amArrivalIsTA || row.amDepartureIsTA || row.pmArrivalIsTA || row.pmDepartureIsTA;
  const meta = ATTENDANCE_CODE_MAP[usedTA ? "TRIP_AUTHORIZATION" : computed.code];
  const code = !usedTA && computed.code === "LATE" ? String(computed.lateMinutes) : meta.shortLabel;
  return {
    code,
    label: meta.label,
    dayCredit: computed.dayCredit,
    undertimeMinutes: undertimeMinutesForDisplay(computed.code, computed.lateMinutes, schedule),
  };
}

// Small, deliberately noticeable pill next to each punch — toggling it marks
// just that one punch as Trip Authorization instead of typing a time.
function TAToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Trip Authorization — click to unmark" : "Mark this punch as Trip Authorization"}
      className={cn(
        "shrink-0 rounded-md border px-1.5 py-1 text-[0.65rem] font-semibold transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary",
      )}
    >
      TA
    </button>
  );
}

type DraftFields = Pick<
  DtrRowValue,
  | "amArrival"
  | "amDeparture"
  | "pmArrival"
  | "pmDeparture"
  | "overrideCode"
  | "amArrivalIsTA"
  | "amDepartureIsTA"
  | "pmArrivalIsTA"
  | "pmDepartureIsTA"
>;

function draftStorageKey(employeeId: string, rows: DtrRowValue[]): string | null {
  const first = rows[0]?.date;
  return first ? `jocos:admin-dtr-draft:${employeeId}:${first}` : null;
}

type TaField = "amArrival" | "amDeparture" | "pmArrival" | "pmDeparture";

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

  function saveDraft(nextRows: DtrRowValue[]) {
    const key = draftStorageKey(employeeId, initialRows);
    if (!key) return;
    const draft: Record<string, DraftFields> = {};
    for (const row of nextRows) {
      draft[row.date] = {
        amArrival: row.amArrival,
        amDeparture: row.amDeparture,
        pmArrival: row.pmArrival,
        pmDeparture: row.pmDeparture,
        overrideCode: row.overrideCode,
        amArrivalIsTA: row.amArrivalIsTA,
        amDepartureIsTA: row.amDepartureIsTA,
        pmArrivalIsTA: row.pmArrivalIsTA,
        pmDepartureIsTA: row.pmDepartureIsTA,
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

  // Typing here was otherwise only kept in memory — switching employee or
  // period before hitting Save threw it all away. Restore whatever was last
  // typed for this exact employee + half-month period, read once on mount.
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
        const saved = restored[row.date];
        return saved ? { ...row, ...saved } : row;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateRow(index: number, patch: Partial<DtrRowValue>) {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      saveDraft(next);
      return next;
    });
  }

  // Toggling a punch's TA on clears its time (a TA slip stands in for that
  // one punch, not a real time); toggling off just re-enables the input.
  function toggleTA(index: number, field: TaField) {
    const flagKey = `${field}IsTA` as const;
    const nextIsTA = !rows[index][flagKey];
    updateRow(index, { [flagKey]: nextIsTA, [field]: "" } as Partial<DtrRowValue>);
  }

  // One click instead of retyping the same schedule into every row — fills
  // every AUTO row (skips REST_DAY/WORK_SUSPENDED/etc., since those are
  // deliberately different) with that day's resolved schedule times. Leaves
  // a punch already marked TA untouched rather than overwriting it.
  function fillStandardHours() {
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (row.overrideCode) return row;
        const schedule = schedules[i];
        return {
          ...row,
          amArrival: row.amArrivalIsTA ? row.amArrival : schedule.session1 ? minutesToHHMM(schedule.session1.start) : "",
          amDeparture: row.amDepartureIsTA ? row.amDeparture : schedule.session1 ? minutesToHHMM(schedule.session1.end) : "",
          pmArrival: row.pmArrivalIsTA ? row.pmArrival : schedule.session2 ? minutesToHHMM(schedule.session2.start) : "",
          pmDeparture: row.pmDepartureIsTA ? row.pmDeparture : schedule.session2 ? minutesToHHMM(schedule.session2.end) : "",
        };
      });
      saveDraft(next);
      return next;
    });
    toast.success("Filled standard hours for every non-override day");
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

  function handleSave() {
    startTransition(async () => {
      const result = await saveDtrPeriod({ employeeId, rows });
      if (!result.error) {
        toast.success("DTR saved");
        clearDraft();
      } else {
        toast.error(result.error);
      }
    });
  }

  const schedules = rows.map((row) => resolveSchedule(employeeSchedule, parseISODate(row.date).getUTCDay()));
  const previews = rows.map((row, i) => rowPreview(row, schedules[i]));
  const totalCredit = previews.reduce((sum, p) => sum + p.dayCredit, 0);
  const totalUndertimeMinutes = previews.reduce((sum, p) => sum + p.undertimeMinutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {employeeSchedule.scheduleMode === "PER_DAY"
            ? "Schedule varies by day of week — hover a row's date for that day's hours."
            : `Schedule: ${formatScheduleSummary(schedules[0])}`}
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
              <TableHead>AM Arrival</TableHead>
              <TableHead>AM Departure</TableHead>
              <TableHead>PM Arrival</TableHead>
              <TableHead>PM Departure</TableHead>
              <TableHead>Override</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Late/Undertime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const preview = previews[i];
              const schedule = schedules[i];
              const hasFirstSession = !!schedule.session1;
              const hasSecondSession = !!schedule.session2;
              const timesDisabled = !!row.overrideCode;
              const scheduleTitle = formatScheduleSummary(schedule);
              return (
                <TableRow key={row.date}>
                  <TableCell className="whitespace-nowrap text-sm" title={scheduleTitle}>
                    <div className="flex items-center gap-1">
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
                  <TableCell title={hasFirstSession ? undefined : "No AM session in this day's schedule"}>
                    <div className="flex items-center gap-1">
                      <TimeInputWithClear
                        className="w-28"
                        disabled={timesDisabled || !hasFirstSession || row.amArrivalIsTA}
                        value={row.amArrival}
                        onChange={(value) => updateRow(i, { amArrival: value })}
                      />
                      {!timesDisabled && hasFirstSession && (
                        <TAToggle active={row.amArrivalIsTA} onClick={() => toggleTA(i, "amArrival")} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell title={hasFirstSession ? undefined : "No AM session in this day's schedule"}>
                    <div className="flex items-center gap-1">
                      <TimeInputWithClear
                        className="w-28"
                        disabled={timesDisabled || !hasFirstSession || row.amDepartureIsTA}
                        value={row.amDeparture}
                        onChange={(value) => updateRow(i, { amDeparture: value })}
                      />
                      {!timesDisabled && hasFirstSession && (
                        <TAToggle active={row.amDepartureIsTA} onClick={() => toggleTA(i, "amDeparture")} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell title={hasSecondSession ? undefined : "No PM session in this day's schedule"}>
                    <div className="flex items-center gap-1">
                      <TimeInputWithClear
                        className="w-28"
                        disabled={timesDisabled || !hasSecondSession || row.pmArrivalIsTA}
                        value={row.pmArrival}
                        onChange={(value) => updateRow(i, { pmArrival: value })}
                      />
                      {!timesDisabled && hasSecondSession && (
                        <TAToggle active={row.pmArrivalIsTA} onClick={() => toggleTA(i, "pmArrival")} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell title={hasSecondSession ? undefined : "No PM session in this day's schedule"}>
                    <div className="flex items-center gap-1">
                      <TimeInputWithClear
                        className="w-28"
                        disabled={timesDisabled || !hasSecondSession || row.pmDepartureIsTA}
                        value={row.pmDeparture}
                        onChange={(value) => updateRow(i, { pmDeparture: value })}
                      />
                      {!timesDisabled && hasSecondSession && (
                        <TAToggle active={row.pmDepartureIsTA} onClick={() => toggleTA(i, "pmDeparture")} />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={row.overrideCode || "AUTO"}
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
                  <TableCell className="text-sm font-medium whitespace-nowrap" title={preview.label}>
                    {preview.code}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                    {preview.undertimeMinutes > 0 ? formatDurationHM(preview.undertimeMinutes) : "—"}
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
          <span className="text-muted-foreground">
            {" "}
            &middot; Late/undertime: {totalUndertimeMinutes > 0 ? formatDurationHM(totalUndertimeMinutes) : "0h 0m"}
          </span>
        </p>
        <Button onClick={handleSave} loading={pending}>
          {pending ? "Saving..." : "Save DTR"}
        </Button>
      </div>
    </div>
  );
}
