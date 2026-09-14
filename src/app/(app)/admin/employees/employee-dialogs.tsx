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
import { createEmployee, updateEmployee, createMemberLogin, resetEmployeePassword, type FormState } from "./actions";

const initialState: FormState = { error: null };

type EmployeeFormValues = {
  id?: string;
  employeeNo: string;
  officeAssignment: string;
  name: string;
  positionTitle: string;
  salaryGrade: number;
};

function EmployeeFields({ defaults }: { defaults?: Partial<EmployeeFormValues> }) {
  return (
    <div className="grid gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="officeAssignment">Office Assignment</Label>
        <Input
          id="officeAssignment"
          name="officeAssignment"
          defaultValue={defaults?.officeAssignment}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="employeeNo">Employee No.</Label>
          <Input id="employeeNo" name="employeeNo" defaultValue={defaults?.employeeNo} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="salaryGrade">Salary Grade</Label>
          <Input
            id="salaryGrade"
            name="salaryGrade"
            type="number"
            min={1}
            max={33}
            defaultValue={defaults?.salaryGrade}
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" defaultValue={defaults?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="positionTitle">Position Title</Label>
        <Input id="positionTitle" name="positionTitle" defaultValue={defaults?.positionTitle} required />
      </div>
    </div>
  );
}

export function NewEmployeeDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createEmployee(initialState, formData);
      if (!result.error) {
        toast.success("Employee added");
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Employee</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Employee</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <EmployeeFields />
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

export function EditEmployeeDialog({ employee }: { employee: EmployeeFormValues }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEmployee(initialState, formData);
      if (!result.error) {
        toast.success("Employee updated");
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
          <Button variant="outline" size="sm">
            Edit
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={employee.id} />
          <EmployeeFields defaults={employee} />
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

export function CreateLoginDialog({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createMemberLogin(initialState, formData);
      if (!result.error) {
        toast.success("Login created");
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
          <Button variant="outline" size="sm">
            Create Login
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create login for {employeeName}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" name="username" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Temporary Password</Label>
            <Input id="password" name="password" type="text" required />
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// There's no "view password" here on purpose — passwords are stored as a
// one-way hash, so not even an admin can look up what it currently is. This
// only sets a brand-new one.
export function ResetPasswordDialog({ userId, employeeName }: { userId: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await resetEmployeePassword(initialState, formData);
      if (!result.error) {
        toast.success("Password reset");
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
          <Button variant="outline" size="sm">
            Reset Password
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {employeeName}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <div className="space-y-1.5">
            <Label htmlFor="password">New Password</Label>
            <Input id="password" name="password" type="text" required />
            <p className="text-xs text-muted-foreground">Share this new password with the employee directly.</p>
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>
              {pending ? "Resetting..." : "Reset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
