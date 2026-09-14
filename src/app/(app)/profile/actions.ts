"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logAudit } from "@/lib/audit";

// The client already resizes/re-encodes to a small square JPEG before
// upload — this is just a backstop against a request that skips that step.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type FormState = { error: string | null };

export async function uploadAvatar(formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload" };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { error: "Only JPEG, PNG, or WebP images are accepted" };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: "Image is too large" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await prisma.userAvatar.upsert({
    where: { userId: user.id },
    update: { mimeType: file.type, fileData: buffer },
    create: { userId: user.id, mimeType: file.type, fileData: buffer },
  });
  await logAudit({
    actorId: user.id,
    entityType: "UserAvatar",
    entityId: user.id,
    action: "UPDATE",
    summary: `${user.name} updated their profile photo`,
  });

  revalidatePath("/", "layout");
  return { error: null };
}

export async function removeAvatar(): Promise<FormState> {
  const user = await requireUser();

  const existing = await prisma.userAvatar.findUnique({ where: { userId: user.id } });
  if (!existing) return { error: "No profile photo to remove" };

  await prisma.userAvatar.delete({ where: { userId: user.id } });
  await logAudit({
    actorId: user.id,
    entityType: "UserAvatar",
    entityId: user.id,
    action: "DELETE",
    summary: `${user.name} removed their profile photo`,
  });

  revalidatePath("/", "layout");
  return { error: null };
}
