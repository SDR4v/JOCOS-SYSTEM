import { prisma } from "@/lib/prisma";

// In-app only — no email/push. Read fresh on each page load/navigation,
// same as the existing pending-DTR-requests nav badge.
export function notifyUser(recipientId: string, message: string, link?: string) {
  return prisma.notification.create({ data: { recipientId, message, link } });
}

export async function notifyAdmins(message: string, link?: string) {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((admin) => ({ recipientId: admin.id, message, link })),
  });
}
