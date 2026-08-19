"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditEmployeeDialog, CreateLoginDialog } from "./employee-dialogs";
import { ScheduleDialog } from "./schedule-dialog";
import { toggleEmployeeStatus } from "./actions";

type EmployeeRow = {
  id: string;
  employeeNo: string;
  officeAssignment: string;
  name: string;
  positionTitle: string;
  salaryGrade: number;
  status: "ACTIVE" | "INACTIVE";
  scheduleMode: "STANDARD" | "CUSTOM";
  session1Start: number | null;
  session1End: number | null;
  session2Start: number | null;
  session2End: number | null;
  user: { username: string } | null;
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

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, employee no., office, or position..."
        className="max-w-sm"
      />

      <div className="rounded-lg border bg-white">
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
                <TableCell className="text-sm">{employee.officeAssignment}</TableCell>
                <TableCell>{employee.employeeNo}</TableCell>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell className="text-sm">{employee.positionTitle}</TableCell>
                <TableCell>{employee.salaryGrade}</TableCell>
                <TableCell>
                  <Badge variant={employee.status === "ACTIVE" ? "default" : "secondary"}>
                    {employee.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {employee.user ? (
                    <span className="text-sm text-muted-foreground">{employee.user.username}</span>
                  ) : (
                    <CreateLoginDialog employeeId={employee.id} employeeName={employee.name} />
                  )}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <ScheduleDialog employee={employee} />
                  <EditEmployeeDialog employee={employee} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleToggle(employee.id)}
                  >
                    {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
