"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { TriangleAlert } from "lucide-react";
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
import { parseISODate } from "@/lib/period";
import { getSemester, semesterLabel, type Semester } from "@/lib/wellness-leave";
import { createMyWellnessLeaveRequest, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function NewMyWellnessLeaveRequestDialog({
  remaining,
}: {
  remaining: Record<Semester, number | null>;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [pending, startTransition] = useTransition();

  const semester = startDate ? getSemester(parseISODate(startDate)) : null;
  const semesterRemaining = semester ? remaining[semester] : null;
  const outOfBalance = semesterRemaining !== null && semesterRemaining <= 0;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMyWellnessLeaveRequest(initialState, formData);
      if (!result.error) {
        toast.success("Wellness Leave request submitted for HR review");
        setOpen(false);
        setStartDate("");
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" required />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">At most 3 consecutive days, within a single semester.</p>
          {outOfBalance && semester && (
            <p className="flex items-start gap-1.5 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              No Wellness Leave days remaining for {semesterLabel(semester)} — this request can&apos;t be filed.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending} disabled={outOfBalance}>
              {pending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
