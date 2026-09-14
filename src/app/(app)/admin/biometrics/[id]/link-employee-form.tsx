"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeCombobox, type EmployeeOption } from "@/components/employee-combobox";
import { linkPunchesToEmployee } from "../actions";

export function LinkEmployeeForm({
  uploadId,
  rawName,
  employees,
  defaultEmployeeId,
}: {
  uploadId: string;
  rawName: string;
  employees: EmployeeOption[];
  defaultEmployeeId?: string;
}) {
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId ?? "");
  const [pending, startTransition] = useTransition();

  function handleLink() {
    if (!employeeId) return;
    startTransition(async () => {
      const result = await linkPunchesToEmployee(uploadId, rawName, employeeId);
      if (!result.error) toast.success("Linked");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <EmployeeCombobox employees={employees} value={employeeId} onValueChange={setEmployeeId} className="w-64" />
      <Button type="button" size="sm" loading={pending} disabled={!employeeId} onClick={handleLink}>
        <Link2 />
        Link
      </Button>
    </div>
  );
}
