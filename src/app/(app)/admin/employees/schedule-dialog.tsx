"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScheduleFields, defaultScheduleFormValue, type ScheduleFormValue } from "@/components/schedule-fields";
import { updateEmployeeSchedule } from "./actions";

export function ScheduleDialog({
  employee,
}: {
  employee: {
    id: string;
    name: string;
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
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<ScheduleFormValue>(() => defaultScheduleFormValue(employee));
  const [pending, startTransition] = useTransition();

  function updateValue(patch: Partial<ScheduleFormValue>) {
    setValue((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateEmployeeSchedule({ employeeId: employee.id, ...value });
      if (!result.error) {
        toast.success("Schedule updated");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm">Schedule</Button>} />
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee.name}&apos;s Work Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <ScheduleFields value={value} onChange={updateValue} />
          <DialogFooter>
            <Button type="button" onClick={handleSave} disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
