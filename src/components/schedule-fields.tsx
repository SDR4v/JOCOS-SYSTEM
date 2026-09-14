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
import { humanizeEnum } from "@/lib/utils";

export type DayScheduleMode = "STANDARD" | "CUSTOM";

export type DayScheduleFormValue = {
  dayOfWeek: number;
  dayMode: DayScheduleMode;
  hasSession1: boolean;
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
};

export type ScheduleFormValue = {
  scheduleMode: "STANDARD" | "CUSTOM" | "PER_DAY";
  hasSession1: boolean;
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
    dayMode: "STANDARD",
    hasSession1: true,
    session1Start: "08:00",
    session1End: "12:00",
    hasSession2: true,
    session2Start: "13:00",
    session2End: "17:00",
  };
}

type StoredSession = {
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
};

// AM is stored under session1, PM under session2 — a lone session that's
// PM-designated (AM toggled No) is saved with session1 null and its actual
// times under session2 (see buildStoredSession in lib/dtr-time). The form
// always edits a lone session through its "session1" fields regardless of
// which half it's in (see SessionInputs below), so pull from whichever slot
// is actually populated.
function formFieldsFromStored(
  stored: StoredSession,
): Pick<DayScheduleFormValue, "hasSession1" | "session1Start" | "session1End" | "hasSession2" | "session2Start" | "session2End"> {
  const hasSession1 = stored.session1Start !== null && stored.session1End !== null;
  const hasSession2 = stored.session2Start !== null && stored.session2End !== null;

  if (hasSession1) {
    return {
      hasSession1: true,
      session1Start: minutesToHHMM(stored.session1Start!),
      session1End: minutesToHHMM(stored.session1End!),
      hasSession2,
      session2Start: hasSession2 ? minutesToHHMM(stored.session2Start!) : "13:00",
      session2End: hasSession2 ? minutesToHHMM(stored.session2End!) : "17:00",
    };
  }
  return {
    hasSession1: false,
    session1Start: hasSession2 ? minutesToHHMM(stored.session2Start!) : "13:00",
    session1End: hasSession2 ? minutesToHHMM(stored.session2End!) : "17:00",
    hasSession2: false,
    session2Start: "13:00",
    session2End: "17:00",
  };
}

export function defaultScheduleFormValue(employee: EmployeeScheduleSource): ScheduleFormValue {
  const days = DAY_NAMES.map((_, dayOfWeek) => {
    const existing = employee.daySchedules?.find((d) => d.dayOfWeek === dayOfWeek);
    if (!existing || (existing.session1Start === null && existing.session2Start === null)) {
      return emptyDay(dayOfWeek);
    }
    return { dayOfWeek, dayMode: "CUSTOM" as const, ...formFieldsFromStored(existing) };
  });

  const topFields =
    employee.scheduleMode === "STANDARD"
      ? {
          hasSession1: true as const,
          session1Start: "08:00",
          session1End: "12:00",
          hasSession2: true,
          session2Start: "13:00",
          session2End: "17:00",
        }
      : formFieldsFromStored(employee);

  return { scheduleMode: employee.scheduleMode, ...topFields, days };
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
            <SelectValue>{(value: string) => humanizeEnum(value)}</SelectValue>
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
          hasSession1={value.hasSession1}
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
                  value={day.dayMode}
                  onValueChange={(v) => updateDay(day.dayOfWeek, { dayMode: v as DayScheduleMode })}
                >
                  <SelectTrigger size="sm" className="w-48">
                    <SelectValue>{(value: string) => humanizeEnum(value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">Standard hours (8–12 &amp; 1–5)</SelectItem>
                    <SelectItem value="CUSTOM">Custom hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {day.dayMode === "CUSTOM" && (
                <SessionInputs
                  hasSession1={day.hasSession1}
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
          If a time out is earlier than its time in, it&apos;s treated as crossing midnight (night shift).
        </p>
      )}
    </div>
  );
}

type SessionInputsPatch = {
  hasSession1?: boolean;
  session1Start?: string;
  session1End?: string;
  hasSession2?: boolean;
  session2Start?: string;
  session2End?: string;
};

// "08:00" -> "AM", "18:00" -> "PM" — reads the field's own actual value so
// the label is always accurate (a real night shift's lone session starts in
// the PM and ends in the AM, and each field reflects that independently),
// rather than assuming the whole session is one or the other.
function amPmPrefix(value: string): "AM" | "PM" | null {
  if (!value) return null;
  const hour = Number(value.slice(0, 2));
  return hour < 12 ? "AM" : "PM";
}

// AM and PM are independently optional (at least one must stay on) — a
// PM-only worker (e.g. starts at 1pm) turns AM off instead of being forced
// to invent morning hours that would otherwise get graded as a missed
// shift. Whichever block is the day's ONLY one is stored in the session1
// fields underneath (that's the slot a lone session occupies).
//
// Labeling: the lone-session fields still show a live AM/PM prefix — taken
// from what's actually typed, not from the AM/PM toggle above — because the
// DTR entry grid always has a lone session live in its AM Arrival/AM
// Departure columns regardless of what time of day it actually is (a
// 6pm-midnight shift included). The note beneath explains that mapping.
function SessionInputs({
  hasSession1,
  session1Start,
  session1End,
  hasSession2,
  session2Start,
  session2End,
  onChange,
}: {
  hasSession1: boolean;
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
  onChange: (patch: SessionInputsPatch) => void;
}) {
  function setHasAM(has: boolean) {
    if (has) {
      onChange({ hasSession1: true, session1Start: "08:00", session1End: "12:00" });
    } else {
      onChange({ hasSession1: false, session1Start: "13:00", session1End: "17:00", hasSession2: false });
    }
  }

  const soloStart = hasSession1 ? session2Start : session1Start;
  const soloEnd = hasSession1 ? session2End : session1End;
  const showSoloTimes = hasSession1 ? hasSession2 : true;

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>AM</Label>
        <Select value={hasSession1 ? "YES" : "NO"} onValueChange={(v) => setHasAM(v === "YES")}>
          <SelectTrigger className="w-full">
            <SelectValue>{(value: string) => humanizeEnum(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NO">None — a single shift later in the day (e.g. PM-only, or a night shift)</SelectItem>
            <SelectItem value="YES">Yes, works in the AM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasSession1 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>AM Time In</Label>
            <Input type="time" value={session1Start} onChange={(e) => onChange({ session1Start: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>AM Time Out</Label>
            <Input type="time" value={session1End} onChange={(e) => onChange({ session1End: e.target.value })} required />
          </div>
        </div>
      )}

      {hasSession1 && (
        <div className="space-y-1.5">
          <Label>PM</Label>
          <Select value={hasSession2 ? "YES" : "NO"} onValueChange={(v) => onChange({ hasSession2: v === "YES" })}>
            <SelectTrigger className="w-full">
              <SelectValue>{(value: string) => humanizeEnum(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NO">None — a single continuous shift (e.g. night shift, no lunch break)</SelectItem>
              <SelectItem value="YES">Yes, works in the PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {showSoloTimes && (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{[hasSession1 ? "PM" : amPmPrefix(soloStart), "Time In"].filter(Boolean).join(" ")}</Label>
              <Input
                type="time"
                value={soloStart}
                onChange={(e) => onChange(hasSession1 ? { session2Start: e.target.value } : { session1Start: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{[hasSession1 ? "PM" : amPmPrefix(soloEnd), "Time Out"].filter(Boolean).join(" ")}</Label>
              <Input
                type="time"
                value={soloEnd}
                onChange={(e) => onChange(hasSession1 ? { session2End: e.target.value } : { session1End: e.target.value })}
                required
              />
            </div>
          </div>
          {!hasSession1 && (
            <p className="text-xs text-muted-foreground">
              This is the day&apos;s only shift — on the DTR it&apos;s entered under{" "}
              <strong>AM Arrival / AM Departure</strong>, even though the actual time is in the afternoon or evening.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
