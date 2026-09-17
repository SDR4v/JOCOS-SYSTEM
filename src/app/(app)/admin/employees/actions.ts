"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";

const employeeSchema = z.object({
  employeeNo: z.string().trim().min(1, "Employee No. is required"),
  officeAssignment: z.string().trim().min(1, "Office assignment is required"),
  name: z.string().trim().min(1, "Name is required"),
  positionTitle: z.string().trim().min(1, "Position title is required"),
  salaryGrade: z.coerce.number().int().min(1).max(33),
});

export type FormState = { error: string | null };

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const employee = await prisma.employee.create({ data: parsed.data });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: employee.id,
    action: "CREATE",
    summary: `Added employee ${employee.name} (${employee.employeeNo})`,
  });
  revalidatePath("/admin/employees");
  return { error: null };
}

export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing employee id" };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const employee = await prisma.employee.update({ where: { id }, data: parsed.data });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: employee.id,
    action: "UPDATE",
    summary: `Updated employee ${employee.name} (${employee.employeeNo})`,
  });
  revalidatePath("/admin/employees");
  return { error: null };
}

export async function toggleEmployeeStatus(id: string) {
  const admin = await requireAdmin();
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id } });
  const newStatus = employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  await prisma.employee.update({ where: { id }, data: { status: newStatus } });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: employee.id,
    action: "UPDATE",
    summary: `Marked ${employee.name} as ${newStatus === "ACTIVE" ? "Active" : "Inactive"}`,
  });
  revalidatePath("/admin/employees");
}

// Soft delete — hides the employee from the roster without touching the
// DTR/payroll/leave history other records still reference. Also forces
// INACTIVE so they immediately drop out of payroll, holiday-sync, etc.,
// the same as any other deactivated employee.
export async function removeEmployee(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return { error: "Employee not found" };
  if (employee.deletedAt) return { error: "This employee has already been removed" };

  await prisma.employee.update({
    where: { id },
    data: { status: "INACTIVE", deletedById: admin.id, deletedAt: new Date() },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: employee.id,
    action: "DELETE",
    summary: `Removed employee ${employee.name} (${employee.employeeNo})`,
  });

  revalidatePath("/admin/employees");
  return { error: null };
}

// Un-hides a removed employee. Status stays INACTIVE — an admin re-activates
// separately, same as restoring a Wellness Leave request doesn't re-apply
// its prior effects.
export async function restoreEmployee(id: string): Promise<FormState> {
  const admin = await requireAdmin();

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) return { error: "Employee not found" };
  if (!employee.deletedAt) return { error: "This employee isn't removed" };

  await prisma.employee.update({ where: { id }, data: { deletedById: null, deletedAt: null } });
  await logAudit({
    actorId: admin.id,
    entityType: "Employee",
    entityId: employee.id,
    action: "UPDATE",
    summary: `Restored employee ${employee.name} (${employee.employeeNo})`,
  });

  revalidatePath("/admin/employees");
  return { error: null };
}

const loginSchema = z.object({
  employeeId: z.string().min(1),
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function createMemberLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return { error: "That username is already taken" };

  const employee = await prisma.employee.findUnique({
    where: { id: parsed.data.employeeId },
    select: { name: true },
  });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      username: parsed.data.username,
      passwordHash,
      role: "MEMBER",
      employeeId: parsed.data.employeeId,
    },
  });
  await logAudit({
    actorId: admin.id,
    entityType: "User",
    entityId: user.id,
    action: "CREATE",
    summary: `Created login '${user.username}' for ${employee?.name ?? "employee"}`,
  });

  revalidatePath("/admin/employees");
  return { error: null };
}

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Passwords are stored as a one-way bcrypt hash, never in a form that could
// be read back — so there's no "view password" action, only reset. This
// sets a brand-new password without needing to know the old one.
export async function resetEmployeePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    include: { employee: true },
  });
  if (!user) return { error: "Login not found" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logAudit({
    actorId: admin.id,
    entityType: "User",
    entityId: user.id,
    action: "UPDATE",
    summary: `Reset password for ${user.employee?.name ?? user.username}`,
  });

  revalidatePath("/admin/employees");
  return { error: null };
}
