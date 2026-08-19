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
import { minutesToHHMM } from "@/lib/dtr-time";

export type ScheduleFormValue = {
  scheduleMode: "STANDARD" | "CUSTOM";
  session1Start: string;
  session1End: string;
  hasSession2: boolean;
  session2Start: string;
  session2End: string;
};

export function defaultScheduleFormValue(employee: {
  scheduleMode: "STANDARD" | "CUSTOM";
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
}): ScheduleFormValue {
  return {
    scheduleMode: employee.scheduleMode,
    session1Start: employee.session1Start !== null ? minutesToHHMM(employee.session1Start) : "08:00",
    session1End: employee.session1End !== null ? minutesToHHMM(employee.session1End) : "12:00",
    hasSession2:
      employee.scheduleMode === "STANDARD" ? true : employee.session2Start !== null && employee.session2End !== null,
    session2Start: employee.session2Start !== null ? minutesToHHMM(employee.session2Start) : "13:00",
    session2End: employee.session2End !== null ? minutesToHHMM(employee.session2End) : "17:00",
  };
}

export function ScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleFormValue;
  onChange: (patch: Partial<ScheduleFormValue>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Schedule</Label>
        <Select
          value={value.scheduleMode}
          onValueChange={(v) => onChange({ scheduleMode: v as "STANDARD" | "CUSTOM" })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="STANDARD">Standard office hours (8:00–12:00 &amp; 1:00–5:00)</SelectItem>
            <SelectItem value="CUSTOM">Custom schedule</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.scheduleMode === "CUSTOM" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Session 1 start</Label>
              <Input
                type="time"
                value={value.session1Start}
                onChange={(e) => onChange({ session1Start: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Session 1 end</Label>
              <Input
                type="time"
                value={value.session1End}
                onChange={(e) => onChange({ session1End: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Second session</Label>
            <Select
              value={value.hasSession2 ? "YES" : "NO"}
              onValueChange={(v) => onChange({ hasSession2: v === "YES" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NO">None — single continuous shift (e.g. night shift, no lunch break)</SelectItem>
                <SelectItem value="YES">Yes, a second session (e.g. AM/PM split)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {value.hasSession2 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Session 2 start</Label>
                <Input
                  type="time"
                  value={value.session2Start}
                  onChange={(e) => onChange({ session2Start: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Session 2 end</Label>
                <Input
                  type="time"
                  value={value.session2End}
                  onChange={(e) => onChange({ session2End: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            If a session&apos;s end time is earlier than its start time, it&apos;s treated as crossing midnight
            (night shift).
          </p>
        </>
      )}
    </div>
  );
}
