"use client";

import { useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TimeInputWithClear } from "@/components/time-input-with-clear";
import { minutesToHHMM, type DateScheduleOverrideFields } from "@/lib/dtr-time";
import { formatDisplayDate } from "@/lib/period";

export type DateScheduleAction = (
  date: string,
  input: { session1Start: string; session1End: string; session2Start: string; session2End: string },
) => Promise<{ error: string | null; value: DateScheduleOverrideFields | null }>;

// A one-off schedule for just this calendar date — sits to the left of the
// Date cell so it's set right where the times are entered, instead of a
// separate dialog buried behind the weekly-pattern schedule editor. Defaults
// to blank (meaning "use the usual schedule"); filling in any time makes
// this date override it, and clearing everything reverts to the default.
export function DayScheduleButton({
  date,
  override,
  action,
  onSaved,
}: {
  date: string;
  override: DateScheduleOverrideFields | null;
  action: DateScheduleAction;
  onSaved: (value: DateScheduleOverrideFields | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [session1Start, setSession1Start] = useState(override?.session1Start != null ? minutesToHHMM(override.session1Start) : "");
  const [session1End, setSession1End] = useState(override?.session1End != null ? minutesToHHMM(override.session1End) : "");
  const [session2Start, setSession2Start] = useState(override?.session2Start != null ? minutesToHHMM(override.session2Start) : "");
  const [session2End, setSession2End] = useState(override?.session2End != null ? minutesToHHMM(override.session2End) : "");

  function resetFields() {
    setSession1Start(override?.session1Start != null ? minutesToHHMM(override.session1Start) : "");
    setSession1End(override?.session1End != null ? minutesToHHMM(override.session1End) : "");
    setSession2Start(override?.session2Start != null ? minutesToHHMM(override.session2Start) : "");
    setSession2End(override?.session2End != null ? minutesToHHMM(override.session2End) : "");
  }

  function handleSave() {
    startTransition(async () => {
      const result = await action(date, { session1Start, session1End, session2Start, session2End });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onSaved(result.value);
      toast.success(result.value ? "Schedule set for this date" : "Reverted to the default schedule");
      setOpen(false);
    });
  }

  function handleClear() {
    setSession1Start("");
    setSession1End("");
    setSession2Start("");
    setSession2End("");
    startTransition(async () => {
      const result = await action(date, { session1Start: "", session1End: "", session2Start: "", session2End: "" });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onSaved(null);
      toast.success("Reverted to the default schedule");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetFields();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            title={override ? "This date has a one-off schedule — click to edit" : "Set a one-off schedule for just this date"}
            className={
              override
                ? "flex size-6 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary"
                : "flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-accent hover:text-muted-foreground"
            }
          >
            <CalendarClock className="size-3.5" />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule for {formatDisplayDate(date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Leave everything blank to use the usual schedule. Fill in a time to override just this one date — it
            won&apos;t change any other day.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>AM Start</Label>
              <TimeInputWithClear value={session1Start} onChange={setSession1Start} />
            </div>
            <div className="space-y-1.5">
              <Label>AM End</Label>
              <TimeInputWithClear value={session1End} onChange={setSession1End} />
            </div>
            <div className="space-y-1.5">
              <Label>PM Start</Label>
              <TimeInputWithClear value={session2Start} onChange={setSession2Start} />
            </div>
            <div className="space-y-1.5">
              <Label>PM End</Label>
              <TimeInputWithClear value={session2End} onChange={setSession2End} />
            </div>
          </div>
        </div>
        <DialogFooter>
          {override && (
            <Button type="button" variant="outline" loading={pending} onClick={handleClear}>
              Clear override
            </Button>
          )}
          <Button type="button" loading={pending} onClick={handleSave}>
            {pending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
