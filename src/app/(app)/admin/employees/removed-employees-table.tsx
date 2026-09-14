"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Undo2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatISODate } from "@/lib/period";
import { restoreEmployee } from "./actions";

type RemovedEmployee = {
  id: string;
  employeeNo: string;
  name: string;
  officeAssignment: string;
  deletedByName: string | null;
  deletedAt: Date;
};

export function RemovedEmployeesTable({ employees }: { employees: RemovedEmployee[] }) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.employeeNo.toLowerCase().includes(q));
  }, [employees, query]);

  function handleRestore(id: string) {
    startTransition(async () => {
      const result = await restoreEmployee(id);
      if (!result.error) toast.success("Employee restored");
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
          placeholder="Search removed employees by name or employee no..."
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
              <TableHead>Removed By</TableHead>
              <TableHead>Removed At</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  {employees.length === 0 ? "No removed employees." : "No removed employees match this search."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="max-w-[200px] text-sm whitespace-normal">{employee.officeAssignment}</TableCell>
                <TableCell>{employee.employeeNo}</TableCell>
                <TableCell className="font-medium whitespace-normal">{employee.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{employee.deletedByName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatISODate(employee.deletedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={pending}
                    onClick={() => handleRestore(employee.id)}
                  >
                    <Undo2 />
                    Restore
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
