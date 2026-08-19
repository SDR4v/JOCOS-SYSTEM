import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NewEmployeeDialog } from "./employee-dialogs";
import { EmployeesTable } from "./employees-table";

export default async function EmployeesPage() {
  await requireAdmin();

  const employees = await prisma.employee.findMany({
    include: { user: true },
    orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} COS workers on the roster</p>
        </div>
        <NewEmployeeDialog />
      </div>

      <EmployeesTable employees={employees.map((e) => ({ ...e, user: e.user ? { username: e.user.username } : null }))} />
    </div>
  );
}
