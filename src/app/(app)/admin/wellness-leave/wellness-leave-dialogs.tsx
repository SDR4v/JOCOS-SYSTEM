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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeCombobox, type EmployeeOption } from "@/components/employee-combobox";
import {
  createWellnessLeaveRequest,
  approveWellnessLeaveRequest,
  rejectWellnessLeaveRequest,
  type FormState,
} from "./actions";

const initialState: FormState = { error: null };

export function NewWellnessLeaveRequestDialog({ employees }: { employees: EmployeeOption[] }) {
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createWellnessLeaveRequest(initialState, formData);
      if (!result.error) {
        toast.success("Wellness Leave request created");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New Request</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Wellness Leave Request</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="space-y-1.5">
            <Label htmlFor="employeeId">Employee</Label>
            <EmployeeCombobox
              id="employeeId"
              employees={employees}
              value={employeeId}
              onValueChange={setEmployeeId}
              placeholder="Search employee..."
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">At most 3 consecutive days, within a single semester.</p>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !employeeId}>
              {pending ? "Saving..." : "Create Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ApproveRejectButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function approve() {
    startTransition(async () => {
      const result = await approveWellnessLeaveRequest(id);
      if (!result.error) toast.success("Request approved");
      else toast.error(result.error);
    });
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectWellnessLeaveRequest(id);
      if (!result.error) toast.success("Request rejected");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button type="button" size="sm" disabled={pending} onClick={approve}>
        Approve
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reject}>
        Reject
      </Button>
    </div>
  );
}
