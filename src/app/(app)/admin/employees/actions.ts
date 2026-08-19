"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { hhmmToMinutes } from "@/lib/dtr-time";

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

const scheduleSchema = z
  .object({
    employeeId: z.string().min(1),
    scheduleMode: z.enum(["STANDARD", "CUSTOM"]),
    session1Start: z.string().optional(),
    session1End: z.string().optional(),
    hasSession2: z.boolean(),
    session2Start: z.string().optional(),
    session2End: z.string().optional(),
  })
  .refine((v) => v.scheduleMode !== "CUSTOM" || (v.session1Start && v.session1End), {
    message: "Session 1 start and end are required for a custom schedule",
  })
  .refine((v) => v.scheduleMode !== "CUSTOM" || !v.hasSession2 || (v.session2Start && v.session2End), {
    message: "Session 2 start and end are required when a second session is set",
  });

export async function updateEmployeeSchedule(input: unknown): Promise<FormState> {
  await requireAdmin();

  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { employeeId, scheduleMode, session1Start, session1End, hasSession2, session2Start, session2End } = parsed.data;
  const isCustom = scheduleMode === "CUSTOM";

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      scheduleMode,
      session1Start: isCustom ? hhmmToMinutes(session1Start!) : null,
      session1End: isCustom ? hhmmToMinutes(session1End!) : null,
      session2Start: isCustom && hasSession2 ? hhmmToMinutes(session2Start!) : null,
      session2End: isCustom && hasSession2 ? hhmmToMinutes(session2End!) : null,
    },
  });

  revalidatePath("/admin/employees");
  return { error: null };
}
