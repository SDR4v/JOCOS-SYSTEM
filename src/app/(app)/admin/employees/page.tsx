import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NewEmployeeDialog } from "./employee-dialogs";
import { EmployeesTable } from "./employees-table";
import { RemovedEmployeesTable } from "./removed-employees-table";

export default async function EmployeesPage() {
  await requireAdmin();

  const [employees, removedEmployees] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null },
      include: { user: true },
      orderBy: [{ officeAssignment: "asc" }, { name: "asc" }],
    }),
    prisma.employee.findMany({
      where: { deletedAt: { not: null } },
      include: { deletedBy: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employees</h1>
          <p className="text-sm text-muted-foreground">{employees.length} COS workers on the roster</p>
        </div>
        <NewEmployeeDialog />
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="removed">
            Removed{removedEmployees.length > 0 ? ` (${removedEmployees.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="pt-2">
          <EmployeesTable
            employees={employees.map((e) => ({ ...e, user: e.user ? { id: e.user.id, username: e.user.username } : null }))}
          />
        </TabsContent>

        <TabsContent value="removed" className="space-y-2 pt-2">
          <p className="text-xs text-muted-foreground">
            Removed employees stay here — restore one to bring it back into the roster. Their DTR, payroll, and leave
            history is untouched either way.
          </p>
          <RemovedEmployeesTable
            employees={removedEmployees.map((e) => ({
              id: e.id,
              employeeNo: e.employeeNo,
              name: e.name,
              officeAssignment: e.officeAssignment,
              deletedByName: e.deletedBy?.username ?? null,
              deletedAt: e.deletedAt!,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
