"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarClock, Search, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { humanizeEnum } from "@/lib/utils";
import { EditEmployeeDialog, CreateLoginDialog, ResetPasswordDialog } from "./employee-dialogs";
import { toggleEmployeeStatus, removeEmployee, toggleSchedulePoster } from "./actions";

type EmployeeRow = {
  id: string;
  employeeNo: string;
  officeAssignment: string;
  name: string;
  positionTitle: string;
  salaryGrade: number;
  status: "ACTIVE" | "INACTIVE";
  canPostSchedule: boolean;
  user: { id: string; username: string } | null;
};

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeNo.toLowerCase().includes(q) ||
        e.officeAssignment.toLowerCase().includes(q) ||
        e.positionTitle.toLowerCase().includes(q),
    );
  }, [employees, query]);

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleEmployeeStatus(id);
      toast.success("Employee status updated");
    });
  }

  function handleTogglePoster(employee: EmployeeRow) {
    startTransition(async () => {
      const result = await toggleSchedulePoster(employee.id);
      if (!result.error) {
        toast.success(
          employee.canPostSchedule
            ? `${employee.name} can no longer post the office schedule`
            : `${employee.name} can now post ${employee.officeAssignment}'s schedule`,
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeEmployee(id);
      if (!result.error) toast.success("Employee removed");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, employee no., office, or position..."
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Office Assignment</TableHead>
              <TableHead>No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Position Title</TableHead>
              <TableHead>SG</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                  No employees match &quot;{query}&quot;.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="max-w-[200px] text-sm whitespace-normal">{employee.officeAssignment}</TableCell>
                <TableCell>{employee.employeeNo}</TableCell>
                <TableCell className="font-medium whitespace-normal">{employee.name}</TableCell>
                <TableCell className="max-w-[200px] text-sm whitespace-normal">{employee.positionTitle}</TableCell>
                <TableCell>{employee.salaryGrade}</TableCell>
                <TableCell>
                  <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>
                    {humanizeEnum(employee.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {employee.user ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{employee.user.username}</span>
                      <ResetPasswordDialog userId={employee.user.id} employeeName={employee.name} />
                    </div>
                  ) : (
                    <CreateLoginDialog employeeId={employee.id} employeeName={employee.name} />
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <EditEmployeeDialog employee={employee} />
                  <Button
                    type="button"
                    variant={employee.canPostSchedule ? "secondary" : "outline"}
                    size="sm"
                    loading={pending}
                    disabled={!employee.user}
                    title={
                      !employee.user
                        ? "Create a login for this employee first"
                        : employee.canPostSchedule
                          ? "Posts this office's schedule. Click to stop."
                          : "Let this employee post their office's monthly schedule"
                    }
                    onClick={() => handleTogglePoster(employee)}
                  >
                    <CalendarClock />
                    {employee.canPostSchedule ? "Posts schedule" : "Let post schedule"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={pending}
                    onClick={() => handleToggle(employee.id)}
                  >
                    {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={pending}
                    onClick={() => handleRemove(employee.id)}
                  >
                    <Trash2 />
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {employees.length} shown
      </p>
    </div>
  );
}
