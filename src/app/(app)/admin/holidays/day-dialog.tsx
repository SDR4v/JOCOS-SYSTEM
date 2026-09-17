"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createHoliday, deleteHoliday } from "./actions";

type HolidayType = "REGULAR" | "SPECIAL_NON_WORKING" | "SUSPENDED";

// Regular vs Special (Non-working) has no effect here — either way the DTR
// gets marked Holiday (no work, no pay), see syncHolidayAttendance — so both
// show and pick as plain "Holiday". SPECIAL_NON_WORKING is kept in the type
// (not offered in the picker below) only so any pre-existing calendar
// entries still saved with that value keep rendering correctly.
const TYPE_LABELS: Record<HolidayType, string> = {
  REGULAR: "Holiday",
  SPECIAL_NON_WORKING: "Holiday",
  SUSPENDED: "Suspended Work (paid)",
};

export type DayHoliday = { id: string; name: string; type: HolidayType };

export function DayDialog({
  date,
  displayLabel,
  holiday,
  children,
}: {
  date: string;
  displayLabel: string;
  holiday: DayHoliday | null;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children}
      <DialogContent>
        {holiday ? (
          <ExistingHoliday displayLabel={displayLabel} holiday={holiday} onClose={() => setOpen(false)} />
        ) : (
          <NewHoliday date={date} displayLabel={displayLabel} onClose={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExistingHoliday({
  displayLabel,
  holiday,
  onClose,
}: {
  displayLabel: string;
  holiday: DayHoliday;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteHoliday(holiday.id);
      if (!result.error) {
        toast.success("Holiday removed");
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{displayLabel}</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <p className="text-lg font-medium">{holiday.name}</p>
        <Badge variant={holiday.type === "SUSPENDED" ? "secondary" : "default"}>{TYPE_LABELS[holiday.type]}</Badge>
        <p className="text-xs text-muted-foreground">
          {holiday.type === "SUSPENDED"
            ? "Every active employee's DTR for this day is marked Work Suspended (full pay, no work expected). Removing it reverts those days back to unset."
            : "Every active employee's DTR for this day is marked Holiday (no work, no pay). Removing it reverts those days back to unset."}
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" loading={pending} onClick={handleDelete}>
          <Trash2 />
          {pending ? "Removing..." : "Remove holiday"}
        </Button>
      </DialogFooter>
    </>
  );
}

function NewHoliday({ date, displayLabel, onClose }: { date: string; displayLabel: string; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<HolidayType>("REGULAR");

  function handleSubmit() {
    startTransition(async () => {
      const result = await createHoliday({ date, name, type });
      if (!result.error) {
        toast.success("Holiday added — DTR and the JOCOS report are updated for every active employee");
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a holiday — {displayLabel}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="holiday-name">Name</Label>
          <Input
            id="holiday-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="holiday-type">Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as HolidayType)}>
            <SelectTrigger id="holiday-type" className="w-full">
              <SelectValue>{TYPE_LABELS[type]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">{TYPE_LABELS.REGULAR}</SelectItem>
              <SelectItem value="SUSPENDED">{TYPE_LABELS.SUSPENDED}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" disabled={pending || !name.trim()} onClick={handleSubmit}>
          {pending ? "Adding..." : "Add holiday"}
        </Button>
      </DialogFooter>
    </>
  );
}
