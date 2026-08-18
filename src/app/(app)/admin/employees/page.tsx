import { requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewEmployeeDialog, EditEmployeeDialog, CreateLoginDialog } from "./employee-dialogs";
import { toggleEmployeeStatus } from "./actions";

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
            {employees.map((employee) => (
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
                  <EditEmployeeDialog employee={employee} />
                  <form
                    action={async () => {
                      "use server";
                      await toggleEmployeeStatus(employee.id);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      {employee.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
