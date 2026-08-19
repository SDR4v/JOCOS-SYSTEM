"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

type Balance = { allotted: number; used: number };
type EmployeeRow = { id: string; name: string; officeAssignment: string };

export function BalancesTable({
  employees,
  balanceMap,
}: {
  employees: EmployeeRow[];
  balanceMap: Record<string, Balance>;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.officeAssignment.toLowerCase().includes(q),
    );
  }, [employees, query]);

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employees by name or office..."
          className="pl-8"
        />
      </div>

      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">1st Sem Used</TableHead>
              <TableHead className="text-right">1st Sem Remaining</TableHead>
              <TableHead className="text-right">2nd Sem Used</TableHead>
              <TableHead className="text-right">2nd Sem Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No employees match &quot;{query}&quot;.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((employee) => {
              const sem1 = balanceMap[`${employee.id}-1`];
              const sem2 = balanceMap[`${employee.id}-2`];
              return (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell className="text-right">{sem1 ? sem1.used : "—"}</TableCell>
                  <TableCell className="text-right">{sem1 ? sem1.allotted - sem1.used : "—"}</TableCell>
                  <TableCell className="text-right">{sem2 ? sem2.used : "—"}</TableCell>
                  <TableCell className="text-right">{sem2 ? sem2.allotted - sem2.used : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {employees.length} shown
      </p>
    </div>
  );
}
