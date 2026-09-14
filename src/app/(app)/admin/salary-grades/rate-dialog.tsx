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
import { upsertSalaryGradeRate, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function RateDialog({
  defaultYear,
  rate,
}: {
  defaultYear: number;
  rate?: { year: number; salaryGrade: number; monthlyAmount: number };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await upsertSalaryGradeRate(initialState, formData);
      if (!result.error) {
        toast.success("Rate saved");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={rate ? "outline" : "default"} size="sm">
            {rate ? "Edit" : "Add Rate"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rate ? "Edit Salary Grade Rate" : "Add Salary Grade Rate"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" defaultValue={rate?.year ?? defaultYear} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="salaryGrade">Salary Grade</Label>
              <Input
                id="salaryGrade"
                name="salaryGrade"
                type="number"
                min={1}
                max={33}
                defaultValue={rate?.salaryGrade}
                required
                readOnly={!!rate}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="monthlyAmount">Monthly Amount (₱)</Label>
            <Input
              id="monthlyAmount"
              name="monthlyAmount"
              type="number"
              step="0.01"
              defaultValue={rate?.monthlyAmount}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
