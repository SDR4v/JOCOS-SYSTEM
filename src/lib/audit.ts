import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/enums";

// One row per create/update/delete made through an action. `summary` is a
// ready-to-display human-readable line built by the caller — cheap to
// write, and the only thing the Activity page needs to render.
export function logAudit(entry: {
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  summary: string;
}) {
  return prisma.auditLog.create({ data: entry });
}
