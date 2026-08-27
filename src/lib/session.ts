import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Both the root layout and every page call this per request (directly or via
// requireAdmin) — cache() dedupes those into a single DB round trip instead
// of re-checking employee status twice on every navigation.
export const requireUser = cache(async function requireUser() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // The JWT session survives even after an employee is deactivated or
  // removed mid-session — re-check on every request so that takes effect
  // immediately instead of only blocking their next fresh login.
  if (session.user.employeeId) {
    const employee = await prisma.employee.findUnique({
      where: { id: session.user.employeeId },
      select: { status: true, deletedAt: true },
    });
    if (!employee || employee.status !== "ACTIVE" || employee.deletedAt) {
      redirect("/login");
    }
  }

  return session.user;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
