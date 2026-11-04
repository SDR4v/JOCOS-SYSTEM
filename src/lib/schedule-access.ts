import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ScheduleAccess = {
  userId: string;
  userName: string;
  isAdmin: boolean;
  // The one office a non-admin may post for. Null for an admin, who can post for any.
  office: string | null;
};

// HR, or an employee HR has designated to post their own office's schedule.
export async function requireSchedulePoster(): Promise<ScheduleAccess> {
  const user = await requireUser();
  const userName = user.name ?? user.username;
  if (user.role === "ADMIN") return { userId: user.id, userName, isAdmin: true, office: null };

  const employee = user.employeeId
    ? await prisma.employee.findUnique({
        where: { id: user.employeeId },
        select: { canPostSchedule: true, officeAssignment: true },
      })
    : null;
  if (!employee?.canPostSchedule) redirect("/");
  return { userId: user.id, userName, isAdmin: false, office: employee.officeAssignment };
}

export function canAccessOffice(access: ScheduleAccess, office: string): boolean {
  return access.isAdmin || access.office === office;
}
