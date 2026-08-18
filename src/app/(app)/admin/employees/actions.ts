"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const employeeSchema = z.object({
  employeeNo: z.string().trim().min(1, "Employee No. is required"),
  officeAssignment: z.string().trim().min(1, "Office assignment is required"),
  name: z.string().trim().min(1, "Name is required"),
  positionTitle: z.string().trim().min(1, "Position title is required"),
  salaryGrade: z.coerce.number().int().min(1).max(33),
});

export type FormState = { error: string | null };

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.employee.create({ data: parsed.data });
  revalidatePath("/admin/employees");
  return { error: null };
}

export async function updateEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing employee id" };

  const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.employee.update({ where: { id }, data: parsed.data });
  revalidatePath("/admin/employees");
  return { error: null };
}

export async function toggleEmployeeStatus(id: string) {
  await requireAdmin();
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id } });
  await prisma.employee.update({
    where: { id },
    data: { status: employee.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });
  revalidatePath("/admin/employees");
}

const loginSchema = z.object({
  employeeId: z.string().min(1),
  username: z.string().trim().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function createMemberLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) return { error: "That username is already taken" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      username: parsed.data.username,
      passwordHash,
      role: "MEMBER",
      employeeId: parsed.data.employeeId,
    },
  });

  revalidatePath("/admin/employees");
  return { error: null };
}
