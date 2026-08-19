"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { minutesToHHMM, DAY_NAMES } from "@/lib/dtr-time";

export type DayScheduleFormValue = {
  dayOfWeek: number;
  useStandard: boolean;
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
};

export type ScheduleFormValue = {
  scheduleMode: "STANDARD" | "CUSTOM" | "PER_DAY";
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
  days: DayScheduleFormValue[];
};

type EmployeeScheduleSource = {
  scheduleMode: "STANDARD" | "CUSTOM" | "PER_DAY";
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
  daySchedules?: {
    dayOfWeek: number;
    session1Start: number | null;
    session1End: number | null;
    session2Start: number | null;
    session2End: number | null;
  }[];
};

function emptyDay(dayOfWeek: number): DayScheduleFormValue {
  return {
    dayOfWeek,
    useStandard: true,
    session1Start: "08:00",
    session1End: "12:00",
    hasSession2: true,
    session2Start: "13:00",
    session2End: "17:00",
  };
}

export function defaultScheduleFormValue(employee: EmployeeScheduleSource): ScheduleFormValue {
  const days = DAY_NAMES.map((_, dayOfWeek) => {
    const existing = employee.daySchedules?.find((d) => d.dayOfWeek === dayOfWeek);
    if (!existing || existing.session1Start === null || existing.session1End === null) {
      return emptyDay(dayOfWeek);
    }
    return {
      dayOfWeek,
      useStandard: false,
      session1Start: minutesToHHMM(existing.session1Start),
      session1End: minutesToHHMM(existing.session1End),
      hasSession2: existing.session2Start !== null && existing.session2End !== null,
      session2Start: existing.session2Start !== null ? minutesToHHMM(existing.session2Start) : "13:00",
      session2End: existing.session2End !== null ? minutesToHHMM(existing.session2End) : "17:00",
    };
  });

  return {
    scheduleMode: employee.scheduleMode,
    session1Start: employee.session1Start !== null ? minutesToHHMM(employee.session1Start) : "08:00",
    session1End: employee.session1End !== null ? minutesToHHMM(employee.session1End) : "12:00",
    hasSession2:
      employee.scheduleMode === "STANDARD" ? true : employee.session2Start !== null && employee.session2End !== null,
    session2Start: employee.session2Start !== null ? minutesToHHMM(employee.session2Start) : "13:00",
    session2End: employee.session2End !== null ? minutesToHHMM(employee.session2End) : "17:00",
    days,
  };
}

export function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleFormValue;
  onChange: (patch: Partial<ScheduleFormValue>) => void;
}) {
  function updateDay(dayOfWeek: number, patch: Partial<DayScheduleFormValue>) {
    onChange({
      days: value.days.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Schedule</Label>
        <Select
          value={value.scheduleMode}
          onValueChange={(v) => onChange({ scheduleMode: v as ScheduleFormValue["scheduleMode"] })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STANDARD">Standard office hours (8:00–12:00 &amp; 1:00–5:00)</SelectItem>
            <SelectItem value="CUSTOM">Custom — same hours every day</SelectItem>
            <SelectItem value="PER_DAY">Varies by day of week</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.scheduleMode === "CUSTOM" && (
        <SessionInputs
          session1Start={value.session1Start}
          session1End={value.session1End}
          hasSession2={value.hasSession2}
          session2Start={value.session2Start}
          session2End={value.session2End}
          onChange={onChange}
        />
      )}

      {value.scheduleMode === "PER_DAY" && (
        <div className="space-y-3">
          {value.days.map((day) => (
            <div key={day.dayOfWeek} className="space-y-2 rounded-md border p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{DAY_NAMES[day.dayOfWeek]}</p>
                <Select
                  value={day.useStandard ? "STANDARD" : "CUSTOM"}
                  onValueChange={(v) => updateDay(day.dayOfWeek, { useStandard: v === "STANDARD" })}
                >
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard hours (8–12 &amp; 1–5)</SelectItem>
                    <SelectItem value="CUSTOM">Custom hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!day.useStandard && (
                <SessionInputs
                  session1Start={day.session1Start}
                  session1End={day.session1End}
                  hasSession2={day.hasSession2}
                  session2Start={day.session2Start}
                  session2End={day.session2End}
                  onChange={(patch) => updateDay(day.dayOfWeek, patch)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {(value.scheduleMode === "CUSTOM" || value.scheduleMode === "PER_DAY") && (
        <p className="text-xs text-muted-foreground">
          If a session&apos;s end time is earlier than its start time, it&apos;s treated as crossing midnight
          (night shift).
        </p>
      )}
    </div>
  );
}

function SessionInputs({
  session1Start,
  session1End,
  hasSession2,
  session2Start,
  session2End,
  onChange,
}: {
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
  onChange: (patch: {
    session1Start?: string;
    session1End?: string;
    hasSession2?: boolean;
    session2Start?: string;
    session2End?: string;
  }) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Session 1 start</Label>
          <Input type="time" value={session1Start} onChange={(e) => onChange({ session1Start: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label>Session 1 end</Label>
          <Input type="time" value={session1End} onChange={(e) => onChange({ session1End: e.target.value })} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Second session</Label>
        <Select value={hasSession2 ? "YES" : "NO"} onValueChange={(v) => onChange({ hasSession2: v === "YES" })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NO">None — single continuous shift (e.g. night shift, no lunch break)</SelectItem>
            <SelectItem value="YES">Yes, a second session (e.g. AM/PM split)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasSession2 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Session 2 start</Label>
            <Input type="time" value={session2Start} onChange={(e) => onChange({ session2Start: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Session 2 end</Label>
            <Input type="time" value={session2End} onChange={(e) => onChange({ session2End: e.target.value })} required />
          </div>
        </div>
      )}
    </div>
  );
}
